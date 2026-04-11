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
    // --- ADMIN APPROVAL PROTOCOL ---
    // Ye tab true hoga jab admin profile verify karega
    isApproved: {
        type: Boolean,
        default: false
    },
    // --- PAYMENT SYSTEM ---
    isPaid: {
        type: Boolean,
        default: false
    },
    // Naya object: Payment proof save karne ke liye
    paymentDetails: {
        transactionId: {
            type: String,
            default: ""
        },
        proofImage: {
            type: String,
            default: ""
        }, // Cloudinary URL for screenshot
        paymentStatus: {
            type: String,
            enum: ["None", "Pending", "Approved", "Rejected"],
            default: "None"
        },
        submittedAt: {
            type: Date
        }
    },

    // University Specific Field
    instituteName: {
        type: String
    },

    // --- DOCUMENTS ARRAY ---
    documents: [
        {
            title: { type: String },
            institute: { type: String },
            fileUrl: { type: String },
            verificationImg: { type: String },
            status: {
                type: String,
                enum: ["Pending", "Verified", "Rejected"],
                default: "Pending"
            },
            createdAt: { type: Date, default: Date.now }
        }
    ]
}, {
    timestamps: true
});

// Optimization
UserSchema.index({ role: 1, isApproved: 1 });
UserSchema.index({ "paymentDetails.paymentStatus": 1 });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);