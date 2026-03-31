const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    passportNumber: { type: String, unique: true, sparse: true }, // Sirf student ke liye
    role: {
        type: String,
        enum: ["student", "admin", "university"],
        default: "student"
    },
    isApproved: { type: Boolean, default: false }, // Admin approval
    isPaid: { type: Boolean, default: false },     // 5000 Fees check

    // Documents Array
    documents: [
        {
            title: String,
            institute: String,
            fileUrl: String,           // Student ka upload
            verificationImg: String,   // Admin ka screenshot
            status: { type: String, default: "Pending" }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);