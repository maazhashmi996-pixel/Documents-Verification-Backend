const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @desc    Protect Middleware (Token Verify karne ke liye)
 * @purpose Har protected route se pehle check karega ke user logged in hai ya nahi
 */
exports.protect = async (req, res, next) => {
    let token;

    // 1. Check for token in different headers (Standard and Custom)
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        // Authorization: Bearer <token>
        token = req.headers.authorization.split(' ')[1];
    } else if (req.header('x-auth-token')) {
        // x-auth-token: <token>
        token = req.header('x-auth-token');
    }

    // Check if no token
    if (!token) {
        return res.status(401).json({
            success: false,
            msg: "No token, authorization denied"
        });
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        /**
         * 3. Database se user nikalna
         * FIX: Dono scenarios handle kiye hain (decoded.id aur decoded.user.id)
         */
        let userId;
        if (decoded.user && decoded.user.id) {
            userId = decoded.user.id;
        } else if (decoded.id) {
            userId = decoded.id;
        } else {
            userId = decoded.sub; // Standard JWT field for subject
        }

        if (!userId) {
            return res.status(401).json({ success: false, msg: "Invalid token payload" });
        }

        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                msg: "User no longer exists in our database"
            });
        }

        // 4. Role Status Check (Optional but Recommended)
        // Agar user block ho gaya ho ya account inactive ho
        if (user.status === 'inactive') {
            return res.status(403).json({ success: false, msg: "Your account is deactivated" });
        }

        // Pura user object request mein daal diya
        req.user = user;
        next();
    } catch (err) {
        console.error("❌ Auth Middleware Error:", err.message);

        // Specific error messages for better Frontend handling
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                msg: "Token has expired, please login again"
            });
        }

        res.status(401).json({ success: false, msg: "Token is not valid" });
    }
};

/**
 * @desc    Admin Only Middleware
 * @purpose Sirf admin role waale users ko access dena
 */
exports.adminOnly = (req, res, next) => {
    // req.user humein upar waale 'protect' middleware se milta hai
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({
            success: false,
            msg: `Access denied. Role '${req.user ? req.user.role : 'unknown'}' is not authorized.`
        });
    }
};