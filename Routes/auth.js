const express = require('express');
const router = express.Router();
const { signup, verifyOtp, resendOtp, login, forgotPassword, resetPassword } = require('../Controllers/auth');

router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
