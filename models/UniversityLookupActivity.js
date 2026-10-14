const mongoose = require('mongoose');

/**
 * Privacy-conscious audit record for university passport lookups.
 * We intentionally keep only the last four characters of the searched passport,
 * counts at the time of lookup, and an internal student reference for distinct
 * record metrics. The full passport number and student contact details are not
 * stored in activity history.
 */
const UniversityLookupActivitySchema = new mongoose.Schema({
    universityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    passportSuffix: {
        type: String,
        required: true,
        maxlength: 4
    },
    matched: {
        type: Boolean,
        default: false,
        required: true
    },
    documentCount: { type: Number, default: 0, min: 0 },
    verifiedCount: { type: Number, default: 0, min: 0 },
    pendingCount: { type: Number, default: 0, min: 0 },
    rejectedCount: { type: Number, default: 0, min: 0 }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

UniversityLookupActivitySchema.index({ universityId: 1, createdAt: -1 });
UniversityLookupActivitySchema.index({ universityId: 1, matched: 1, createdAt: -1 });
UniversityLookupActivitySchema.index({ universityId: 1, studentId: 1 }, { sparse: true });

module.exports = mongoose.models.UniversityLookupActivity || mongoose.model('UniversityLookupActivity', UniversityLookupActivitySchema);
