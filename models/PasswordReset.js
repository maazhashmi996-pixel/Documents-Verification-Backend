const mongoose = require('mongoose');

// Temporary record for "forgot password". Removed automatically after expiresAt (TTL index).
const PasswordResetSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.models.PasswordReset || mongoose.model('PasswordReset', PasswordResetSchema);
