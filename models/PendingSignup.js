const mongoose = require('mongoose');

// Temporary record kept only until the email verification code is entered.
// MongoDB removes it automatically once expiresAt passes (TTL index).
const PendingSignupSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['student', 'admin'], required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    passportNumber: { type: String, trim: true },
    password: { type: String, required: true }, // already hashed
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.models.PendingSignup || mongoose.model('PendingSignup', PendingSignupSchema);
