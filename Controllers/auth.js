const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @route   POST /api/auth/signup
exports.signup = async (req, res) => {
    try {
        const { name, email, password, passportNumber, role } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        user = new User({
            name,
            email,
            password,
            passportNumber, // Sirf student bhejega
            role: role || 'student'
        });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();
        res.status(201).json({ msg: "Registration successful. Wait for Admin approval." });

    } catch (err) {
        res.status(500).send("Server Error");
    }
};

// @route   POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

        // Check Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

        // CRITICAL: Check if Admin Approved
        if (!user.isApproved) {
            return res.status(403).json({ msg: "Your account is pending admin approval." });
        }

        // Create JWT Token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: { id: user._id, name: user.name, role: user.role, isPaid: user.isPaid }
        });

    } catch (err) {
        res.status(500).send("Server Error");
    }
};