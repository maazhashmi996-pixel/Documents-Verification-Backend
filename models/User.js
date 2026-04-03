const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    // Passport Number: Sirf students ke liye unique hoga. 
    // Sparse: true ka matlab hai ke jin ke paas ye field nahi (University/Admin), unka index create nahi hoga.
    passportNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    role: {
        type: String,
        enum: ["student", "admin", "university"],
        default: "student"
    },
    // Admin approval protocol
    isApproved: {
        type: Boolean,
        default: false
    },
    // Payment status for students (5000 PKR)
    isPaid: {
        type: Boolean,
        default: false
    },

    // University Specific Field (Request identification ke liye zaroori hai)
    instituteName: {
        type: String
    },

    // Documents Array (Tracking system)
    documents: [
        {
            title: { type: String },
            institute: { type: String },
            fileUrl: { type: String },           // Student upload path
            verificationImg: { type: String },   // Admin verification screenshot
            status: {
                type: String,
                enum: ["Pending", "Verified", "Rejected"],
                default: "Pending"
            },
            createdAt: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true // adds createdAt and updatedAt fields automatically
});

// Optimization: Indexing for faster queries on role and approval status
UserSchema.index({ role: 1, isApproved: 1 });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);