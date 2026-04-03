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
        return res.status(401).json({ msg: "No token, authorization denied" });
    }

    try {
        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        /**
         * 3. Database se user nikalna taake latest role/status check ho sakay.
         * Note: Decoded object mein payload ka structure check karein (decoded.user.id ya decoded.id)
         */
        const userId = decoded.user ? decoded.user.id : decoded.id;
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(401).json({ msg: "User no longer exists in our database" });
        }

        // Pura user object request mein daal diya taake next middleware isay use kar sakay
        req.user = user;
        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);

        // Specific error messages
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ msg: "Token has expired, please login again" });
        }

        res.status(401).json({ msg: "Token is not valid" });
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
            msg: `Access denied. Role '${req.user ? req.user.role : 'unknown'}' is not authorized.`
        });
    }
};