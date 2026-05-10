const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @route   POST /api/auth/signup
// @desc    Register a User (Student/University/Admin) with Approval Logic
exports.signup = async (req, res) => {
    try {
        // 1. Destructure all fields including 'phone'
        const { name, email, phone, password, passportNumber, role, instituteName } = req.body;

        // 2. Check if user already exists
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: "User already exists" });

        // --- NEW LOGIC START: Role-based Phone & Passport Validation ---
        if (role === 'student') {
            if (!phone || phone.trim() === "") {
                return res.status(400).json({ msg: "Phone number is required for students" });
            }
            if (!passportNumber || passportNumber.trim() === "") {
                return res.status(400).json({ msg: "Passport number is required for students" });
            }
        }
        // --- NEW LOGIC END ---

        // 3. SINGLE ADMIN PROTOCOL
        // System mein sirf ek hi master admin ho sakta hai
        if (role === 'admin') {
            const existingAdmin = await User.findOne({ role: 'admin' });
            if (existingAdmin) {
                return res.status(403).json({
                    msg: "Admin registration is locked. An admin already exists in the system."
                });
            }
        }

        // 4. Approval Status Logic
        // Admin automatically 'true' hoga, Student aur University 'false' rahengy 
        const isApprovedStatus = (role === 'admin');

        // 5. Create New User Instance
        // Agar role student nahi hai, toh phone empty string save hogi ya undefined
        user = new User({
            name,
            email,
            phone: role === 'student' ? phone : undefined,
            password,
            passportNumber: role === 'student' ? passportNumber : undefined,
            instituteName: role === 'university' ? instituteName : undefined,
            role: role || 'student',
            isApproved: isApprovedStatus
        });

        // 6. Hash Password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // 7. Save to Database
        await user.save();

        let successMsg = "Registration successful. Please wait for Admin approval before logging in.";
        if (role === 'admin') successMsg = "Admin account created successfully. You can login now.";
        if (role === 'university') successMsg = "University registration request sent to Admin. Waiting for approval.";

        res.status(201).json({ msg: successMsg });

    } catch (err) {
        console.error("Signup Error:", err.message);
        // Detail validation error sending
        if (err.name === 'ValidationError') {
            return res.status(400).json({ msg: err.message });
        }
        res.status(500).send("Server Error during signup");
    }
};

// @route   POST /api/auth/login
// @desc    Login User & Return JWT (Strict Approval Check)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

        // 2. Check Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

        // 3. Admin Approval Check
        // Agar isApproved false hai (Student/University), toh login block kar do
        if (!user.isApproved) {
            return res.status(403).json({
                msg: "Your account is pending approval. Please contact the administrator or wait for verification."
            });
        }

        // 4. Create JWT Token
        // Token mein ID aur Role include kiya hai for frontend role-base routing
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // 5. Success Response (Including phone and filtering sensitive data)
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                email: user.email,
                phone: user.phone, // Include phone in response if needed
                isPaid: user.isPaid || false
            }
        });

    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).send("Server Error during login");
    }
};