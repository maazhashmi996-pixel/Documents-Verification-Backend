const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingSignup = require('../models/PendingSignup');
const PasswordReset = require('../models/PasswordReset');
const { sendOtpEmail } = require('../utils/mailer');

const ROLES = ['student', 'university', 'admin'];
const { OTP_MINUTES, MAX_ATTEMPTS, RESEND_SECONDS, generateOtp, hashOtp, safeEqual } = require('../utils/otp');

// Shared checks used both when the code is requested and when the account is finally created
async function checkAvailability({ email, role, passportNumber }) {
    if (await User.findOne({ email })) {
        return { status: 400, msg: 'An account with this email already exists.' };
    }
    if (role === 'student' && passportNumber && await User.findOne({ passportNumber })) {
        return { status: 400, msg: 'This passport number is already registered.' };
    }
    if (role === 'admin' && await User.findOne({ role: 'admin' })) {
        return { status: 403, msg: 'Admin registration is locked. An admin already exists in the system.' };
    }
    return null;
}

// @route   POST /api/auth/signup
// @desc    Student/Admin: validate, email a 6-digit code (account is NOT created yet)
//          University: created directly, waits for admin approval
exports.signup = async (req, res) => {
    try {
        const { name, phone, password, passportNumber, role, instituteName } = req.body;
        const email = (req.body.email || '').toLowerCase().trim();

        if (!ROLES.includes(role)) return res.status(400).json({ msg: 'Please choose a valid account type.' });
        if (!name?.trim() || !email || !password) return res.status(400).json({ msg: 'Name, email and password are required.' });
        if (password.length < 6) return res.status(400).json({ msg: 'Password must be at least 6 characters.' });

        if (role === 'student') {
            if (!phone?.trim()) return res.status(400).json({ msg: 'Phone number is required for students.' });
            if (!passportNumber?.trim()) return res.status(400).json({ msg: 'Passport number is required for students.' });
        }

        const cleanPassport = role === 'student' ? passportNumber.trim().toUpperCase() : undefined;

        const blocked = await checkAvailability({ email, role, passportNumber: cleanPassport });
        if (blocked) return res.status(blocked.status).json({ msg: blocked.msg });

        const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

        // ---------- UNIVERSITY: no email code, admin approves ----------
        if (role === 'university') {
            await User.create({
                name: name.trim(),
                email,
                password: hashedPassword,
                instituteName: instituteName?.trim() || name.trim(),
                role: 'university',
                isApproved: false
            });
            return res.status(201).json({
                requiresOtp: false,
                msg: 'University registration request sent to Admin. Waiting for approval.'
            });
        }

        // ---------- STUDENT / ADMIN: email verification ----------
        const otp = generateOtp();
        await PendingSignup.findOneAndUpdate(
            { email },
            {
                email,
                role,
                name: name.trim(),
                phone: role === 'student' ? phone.trim() : undefined,
                passportNumber: cleanPassport,
                password: hashedPassword,
                otpHash: hashOtp(email, otp),
                attempts: 0,
                lastSentAt: new Date(),
                expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000)
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        try {
            await sendOtpEmail({ to: email, name: name.trim(), otp, role, minutes: OTP_MINUTES });
        } catch (mailErr) {
            console.error('Mail Error:', mailErr.message);
            await PendingSignup.deleteOne({ email });
            return res.status(500).json({ msg: 'We could not send the verification email. Please check the email address and try again.' });
        }

        res.status(200).json({
            requiresOtp: true,
            email,
            expiresInSeconds: OTP_MINUTES * 60,
            resendAfterSeconds: RESEND_SECONDS,
            msg: `We sent a 6-digit code to ${email}.`
        });
    } catch (err) {
        console.error('Signup Error:', err.message);
        if (err.name === 'ValidationError') return res.status(400).json({ msg: err.message });
        if (err.code === 11000) return res.status(400).json({ msg: 'An account with these details already exists.' });
        res.status(500).json({ msg: 'Server error during signup.' });
    }
};

// @route   POST /api/auth/verify-otp
// @desc    Check the code and only then create the account
exports.verifyOtp = async (req, res) => {
    try {
        const email = (req.body.email || '').toLowerCase().trim();
        const otp = String(req.body.otp || '').trim();

        if (!email || !/^\d{6}$/.test(otp)) return res.status(400).json({ msg: 'Enter the 6-digit code.' });

        const pending = await PendingSignup.findOne({ email });
        if (!pending || pending.expiresAt < new Date()) {
            if (pending) await pending.deleteOne();
            return res.status(400).json({ msg: 'This code has expired. Please sign up again.', expired: true });
        }

        if (pending.attempts >= MAX_ATTEMPTS) {
            await pending.deleteOne();
            return res.status(429).json({ msg: 'Too many wrong attempts. Please sign up again.', expired: true });
        }

        if (!safeEqual(pending.otpHash, hashOtp(email, otp))) {
            pending.attempts += 1;
            await pending.save();
            const left = MAX_ATTEMPTS - pending.attempts;
            return res.status(400).json({ msg: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` });
        }

        // Code is correct: re-check availability, then create the real account
        const blocked = await checkAvailability({ email, role: pending.role, passportNumber: pending.passportNumber });
        if (blocked) {
            await pending.deleteOne();
            return res.status(blocked.status).json({ msg: blocked.msg });
        }

        await User.create({
            name: pending.name,
            email: pending.email,
            phone: pending.phone,
            passportNumber: pending.passportNumber,
            password: pending.password,
            role: pending.role,
            isApproved: true // email verification replaces admin approval
        });
        await pending.deleteOne();

        res.status(201).json({
            msg: pending.role === 'admin'
                ? 'Admin account created. You can sign in now.'
                : 'Email verified. Your student account is ready.'
        });
    } catch (err) {
        console.error('Verify OTP Error:', err.message);
        if (err.code === 11000) return res.status(400).json({ msg: 'An account with these details already exists.' });
        res.status(500).json({ msg: 'Server error during verification.' });
    }
};

// @route   POST /api/auth/resend-otp
exports.resendOtp = async (req, res) => {
    try {
        const email = (req.body.email || '').toLowerCase().trim();
        const pending = await PendingSignup.findOne({ email });
        if (!pending) return res.status(400).json({ msg: 'Signup session not found. Please sign up again.', expired: true });

        const waited = (Date.now() - pending.lastSentAt.getTime()) / 1000;
        if (waited < RESEND_SECONDS) {
            return res.status(429).json({ msg: `Please wait ${Math.ceil(RESEND_SECONDS - waited)}s before requesting a new code.` });
        }

        const otp = generateOtp();
        pending.otpHash = hashOtp(email, otp);
        pending.attempts = 0;
        pending.lastSentAt = new Date();
        pending.expiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
        await pending.save();

        await sendOtpEmail({ to: email, name: pending.name, otp, role: pending.role, minutes: OTP_MINUTES });
        res.json({ msg: 'A new code has been sent.', expiresInSeconds: OTP_MINUTES * 60, resendAfterSeconds: RESEND_SECONDS });
    } catch (err) {
        console.error('Resend OTP Error:', err.message);
        res.status(500).json({ msg: 'Could not send the code. Please try again.' });
    }
};

// @route   POST /api/auth/login
// @desc    Login for ONE role only: a student cannot use the admin card and so on
exports.login = async (req, res) => {
    try {
        const { password, role } = req.body;
        const email = (req.body.email || '').toLowerCase().trim();

        if (!ROLES.includes(role)) return res.status(400).json({ msg: 'Please sign in from one of the login cards.' });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password || '', user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        // Role lock: the account must belong to the card it is used on
        if (user.role !== role) {
            return res.status(403).json({
                msg: `This is a ${user.role} account. Please sign in using the ${user.role} login.`
            });
        }

        if (user.isActive === false) {
            return res.status(403).json({ msg: 'Your account has been suspended. Please contact the admin.' });
        }

        // Only universities still wait for admin approval
        if (user.role === 'university' && !user.isApproved) {
            return res.status(403).json({
                msg: user.rejectionRemarks
                    ? `Your registration was rejected: ${user.rejectionRemarks}`
                    : 'Your university account is pending admin approval.'
            });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                email: user.email,
                phone: user.phone,
                isPaid: user.isPaid || false
            }
        });
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ msg: 'Server error during login.' });
    }
};

// @route   POST /api/auth/forgot-password
// @desc    Email a reset code. Always answers the same way so nobody can probe which emails exist.
exports.forgotPassword = async (req, res) => {
    const generic = {
        msg: 'If an account exists for this email, a reset code has been sent.',
        expiresInSeconds: OTP_MINUTES * 60,
        resendAfterSeconds: RESEND_SECONDS
    };
    try {
        const email = (req.body.email || '').toLowerCase().trim();
        const { role } = req.body;
        if (!email || !ROLES.includes(role)) return res.status(400).json({ msg: 'Email and account type are required.' });

        const user = await User.findOne({ email });
        if (!user || user.role !== role || user.isActive === false) return res.json(generic);

        const existing = await PasswordReset.findOne({ email });
        if (existing && (Date.now() - existing.lastSentAt.getTime()) / 1000 < RESEND_SECONDS) return res.json(generic);

        const otp = generateOtp();
        await PasswordReset.findOneAndUpdate(
            { email },
            {
                email,
                otpHash: hashOtp(email, otp, 'reset'),
                attempts: 0,
                lastSentAt: new Date(),
                expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000)
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        try {
            await sendOtpEmail({ to: email, name: user.name, otp, role, minutes: OTP_MINUTES, purpose: 'reset' });
        } catch (mailErr) {
            console.error('Mail Error:', mailErr.message);
            await PasswordReset.deleteOne({ email });
            return res.status(500).json({ msg: 'We could not send the email right now. Please try again later.' });
        }
        res.json(generic);
    } catch (err) {
        console.error('Forgot Password Error:', err.message);
        res.status(500).json({ msg: 'Server error. Please try again.' });
    }
};

// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const email = (req.body.email || '').toLowerCase().trim();
        const otp = String(req.body.otp || '').trim();
        const { role, newPassword } = req.body;

        if (!email || !ROLES.includes(role)) return res.status(400).json({ msg: 'Email and account type are required.' });
        if (!/^\d{6}$/.test(otp)) return res.status(400).json({ msg: 'Enter the 6-digit code.' });
        if (!newPassword || newPassword.length < 6) return res.status(400).json({ msg: 'Password must be at least 6 characters.' });

        const record = await PasswordReset.findOne({ email });
        if (!record || record.expiresAt < new Date()) {
            if (record) await record.deleteOne();
            return res.status(400).json({ msg: 'This code has expired. Please request a new one.', expired: true });
        }
        if (record.attempts >= MAX_ATTEMPTS) {
            await record.deleteOne();
            return res.status(429).json({ msg: 'Too many wrong attempts. Please request a new code.', expired: true });
        }
        if (!safeEqual(record.otpHash, hashOtp(email, otp, 'reset'))) {
            record.attempts += 1;
            await record.save();
            const left = MAX_ATTEMPTS - record.attempts;
            return res.status(400).json({ msg: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` });
        }

        const user = await User.findOne({ email });
        if (!user || user.role !== role) {
            await record.deleteOne();
            return res.status(400).json({ msg: 'This code has expired. Please request a new one.', expired: true });
        }

        user.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
        await user.save();
        await record.deleteOne();
        res.json({ msg: 'Password updated. You can sign in with your new password.' });
    } catch (err) {
        console.error('Reset Password Error:', err.message);
        res.status(500).json({ msg: 'Server error. Please try again.' });
    }
};
