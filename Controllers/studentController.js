const User = require('../models/User');

/**
 * @route   GET /api/student/dashboard
 * @desc    Student ka profile aur documents ka data dekhna
 */
exports.getStudentDashboard = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json(user);
    } catch (err) {
        console.error("Dashboard Error:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};

/**
 * @route   POST /api/student/submit-payment
 * @desc    Student payment proof (Screenshot + TID) submit karega
 * @access  Private/Student
 */
exports.submitPaymentProof = async (req, res) => {
    try {
        const { transactionId } = req.body;
        const proofImage = req.file ? req.file.path : null; // Cloudinary URL

        if (!transactionId || !proofImage) {
            return res.status(400).json({ msg: "Please provide Transaction ID and Screenshot proof." });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        // Update Payment Details for Admin Review
        user.paymentDetails = {
            transactionId,
            proofImage,
            paymentStatus: 'Pending',
            submittedAt: Date.now()
        };

        // Note: isPaid abhi false hi rahega jab tak Admin approve na karde
        await user.save();

        res.json({
            msg: "Payment proof submitted! Please wait for Admin approval.",
            paymentStatus: user.paymentDetails.paymentStatus
        });
    } catch (err) {
        console.error("Payment Proof Error:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};

/**
 * @route   POST /api/student/upload
 * @desc    Document upload (Sirf tabhi jab isPaid true ho)
 */
exports.uploadDocument = async (req, res) => {
    try {
        const { title, institute } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ msg: "User not found." });

        // 1. Check if Account is Approved
        if (!user.isApproved) {
            return res.status(403).json({ msg: "Your account is pending admin approval." });
        }

        // 2. Check if Payment is Approved by Admin
        if (!user.isPaid) {
            let statusMsg = "Please pay 5000 PKR fees before uploading.";
            if (user.paymentDetails.paymentStatus === 'Pending') {
                statusMsg = "Your payment is currently being verified by Admin. Please wait.";
            }
            return res.status(403).json({ msg: statusMsg });
        }

        if (!req.file) {
            return res.status(400).json({ msg: "Please upload a document file." });
        }

        const newDoc = {
            title: title || "Untitled Document",
            institute: institute || "Not Specified",
            fileUrl: req.file.path,
            status: 'Pending',
            createdAt: new Date()
        };

        user.documents.push(newDoc);
        await user.save();

        res.json({ msg: "Document uploaded successfully!", document: newDoc });
    } catch (err) {
        console.error("❌ Upload Error:", err);
        res.status(500).json({ msg: "Internal Server Error" });
    }
};

/**
 * @route   DELETE /api/student/document/:docId
 * @desc    Student document delete karega
 */
exports.deleteDocument = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        user.documents = user.documents.filter(
            doc => doc._id.toString() !== req.params.docId
        );

        await user.save();
        res.json({ msg: "Document removed successfully." });
    } catch (err) {
        console.error("Delete Error:", err.message);
        res.status(500).json({ msg: "Server Error" });
    }
};