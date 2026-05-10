const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: function () {
            return this.role === 'student';
        },
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    passportNumber: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        required: function () {
            return this.role === 'student';
        }
    },
    role: {
        type: String,
        enum: ["student", "admin", "university"],
        default: "student"
    },

    // --- ADMIN APPROVAL PROTOCOL ---
    isApproved: {
        type: Boolean,
        default: false
    },
    // Account level rejection ke liye (Frontend par show karne ke liye)
    rejectionRemarks: {
        type: String,
        default: null
    },

    // --- PORTAL SYNC FLAG ---
    isSlipLinked: {
        type: Boolean,
        default: false
    },

    // --- PAYMENT SYSTEM ---
    isPaid: {
        type: Boolean,
        default: false
    },
    paymentDetails: {
        transactionId: {
            type: String,
            default: ""
        },
        proofImage: {
            type: String,
            default: ""
        },
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
        type: String,
        trim: true
    },

    // --- DOCUMENTS ARRAY ---
    documents: [
        {
            title: { type: String },
            institute: { type: String },
            fileUrl: { type: String },
            verifySlip: { type: String, default: "" },
            verificationImg: { type: String, default: "" },
            remarks: {
                type: String,
                default: ""
            },
            status: {
                type: String,
                enum: ["Pending", "Verified", "Rejected"],
                default: "Pending"
            },
            verifiedAt: { type: Date },
            createdAt: { type: Date, default: Date.now }
        }
    ],

    // Account level active/inactive status
    isActive: {
        type: Boolean,
        default: true
    }

}, {
    timestamps: true
});

// --- OPTIMIZATION & INDEXING ---
UserSchema.index({ role: 1, isApproved: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ "paymentDetails.paymentStatus": 1 });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);