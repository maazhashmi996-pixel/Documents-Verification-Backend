const crypto = require('crypto');

exports.OTP_MINUTES = 10;
exports.MAX_ATTEMPTS = 5;
exports.RESEND_SECONDS = 60;

exports.generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

exports.hashOtp = (email, otp, purpose = 'signup') =>
    crypto.createHmac('sha256', process.env.JWT_SECRET || 'otp-secret').update(`${purpose}:${email}:${otp}`).digest('hex');

exports.safeEqual = (a, b) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};
