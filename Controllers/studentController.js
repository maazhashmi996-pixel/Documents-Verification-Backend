const User = require('../models/User');

/**
 * @route   GET /api/student/dashboard
 * @desc    Student ka apna profile aur documents ka data dekhna
 */
exports.getStudentDashboard = async (req, res) => {
    try {
        // req.user.id authMiddleware se aa raha hai
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

/**
 * @route   PUT /api/student/pay-fees
 * @desc    Student ki 5000 PKR fees update karna (Simulation)
 */
exports.makePayment = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user.isPaid) {
            return res.status(400).json({ msg: "Fees already paid." });
        }

        // Yahan aap Stripe ya kisi aur gateway ka logic add kar sakty hain
        user.isPaid = true;
        await user.save();

        res.json({ msg: "Payment of 5000 PKR successful! You can now upload documents.", isPaid: user.isPaid });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

/**
 * @route   POST /api/student/upload-doc
 * @desc    Student ka document upload karna (Title, Institute aur File ke sath)
 */
exports.uploadDocument = async (req, res) => {
    try {
        const { title, institute } = req.body;
        const studentId = req.user.id;

        // 1. Check if file exists in request
        if (!req.file) {
            return res.status(400).json({ msg: "Please upload a document file (PDF, JPG, or PNG)." });
        }

        const user = await User.findById(studentId);

        // 2. Check if student is approved by Admin
        if (!user.isApproved) {
            return res.status(403).json({ msg: "Account not approved. Contact Admin." });
        }

        // 3. Check if student has paid 5000 PKR
        if (!user.isPaid) {
            return res.status(403).json({ msg: "Please pay 5000 PKR fees before uploading." });
        }

        // 4. Create new document object
        const newDoc = {
            title: title || "Untitled Document",
            institute: institute || "Not Specified",
            fileUrl: req.file.path, // Cloudinary ka secure URL
            status: 'Pending',
            verificationImg: "" // Initial khali hoga jab tak admin upload na kary
        };

        // 5. Save to Array
        user.documents.push(newDoc);
        await user.save();

        res.json({
            msg: "Document uploaded successfully!",
            document: newDoc
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

/**
 * @route   DELETE /api/student/document/:docId
 * @desc    Student apna document delete kar saky (Optional functionality)
 */
exports.deleteDocument = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Document filter karky nikal dena
        user.documents = user.documents.filter(doc => doc._id.toString() !== req.params.docId);

        await user.save();
        res.json({ msg: "Document removed successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};