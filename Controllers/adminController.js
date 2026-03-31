const User = require('../models/User');

/**
 * @route   GET /api/admin/pending-users
 * @desc    Sary pending students aur universities ki list (isApproved: false)
 */
exports.getPendingUsers = async (req, res) => {
    try {
        // Sirf admin hi ye list dekh sakta hai
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: "Access denied. Admins only." });
        }

        const users = await User.find({ isApproved: false }).select('-password');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

/**
 * @route   PUT /api/admin/approve/:id
 * @desc    Student ya University ko approve karna taake wo login kar sakein
 */
exports.approveUser = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: "Access denied." });
        }

        let user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        user.isApproved = true;
        await user.save();

        res.json({ msg: `${user.name} has been approved successfully.` });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

/**
 * @route   GET /api/admin/all-students
 * @desc    Admin ko sary students unky documents ke sath dikhana (Verification ke liye)
 */
exports.getAllStudentsData = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: "Access denied." });
        }

        // Sirf students ka data fetch karein
        const students = await User.find({ role: 'student' }).select('-password');
        res.json(students);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};

/**
 * @route   PUT /api/admin/verify-doc/:studentId/:docId
 * @desc    Specific document verify karna aur admin ka screenshot upload karna
 */
exports.verifyDocument = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ msg: "Access denied." });
        }

        const { studentId, docId } = req.params;

        // Check if file (screenshot) was uploaded
        if (!req.file) {
            return res.status(400).json({ msg: "Please upload a verification screenshot." });
        }

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ msg: "Student not found" });

        // Mongoose sub-document find karein array mein se
        const doc = student.documents.id(docId);
        if (!doc) return res.status(404).json({ msg: "Document not found" });

        // Update document fields
        doc.verificationImg = req.file.path; // Cloudinary URL
        doc.status = "Verified";

        await student.save();

        res.json({
            msg: "Document verified and screenshot uploaded successfully!",
            student
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
};