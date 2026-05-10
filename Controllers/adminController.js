const User = require('../models/User');
const moment = require('moment');

// ============================================================
// 1. ANALYTICS & DIRECTORY ROUTES
// ============================================================

exports.getAdminStats = async (req, res) => {
    try {
        const { period } = req.query;
        let startDate;

        if (period === 'day') startDate = moment().startOf('day').toDate();
        else if (period === 'week') startDate = moment().subtract(7, 'days').startOf('day').toDate();
        else if (period === 'month') startDate = moment().subtract(30, 'days').startOf('day').toDate();
        else startDate = new Date(0);

        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalUniversities = await User.countDocuments({ role: 'university' });

        const pendingApprovals = await User.countDocuments({
            isApproved: false,
            role: { $in: ['student', 'university'] }
        });

        const paidUsersCount = await User.countDocuments({
            role: 'student',
            isPaid: true,
            createdAt: { $gte: startDate }
        });
        const totalRevenue = paidUsersCount * 5000;

        const diffDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 0;
        const lastPeriodStart = diffDays > 0
            ? moment(startDate).subtract(diffDays, 'days').toDate()
            : new Date(0);

        const previousPaidCount = await User.countDocuments({
            role: 'student',
            isPaid: true,
            createdAt: { $gte: lastPeriodStart, $lt: startDate }
        });

        let revenueTrend;
        if (previousPaidCount === 0) {
            revenueTrend = paidUsersCount > 0 ? "+100%" : "+0%";
        } else {
            const percentage = (((paidUsersCount - previousPaidCount) / previousPaidCount) * 100).toFixed(0);
            revenueTrend = percentage >= 0 ? `+${percentage}%` : `${percentage}%`;
        }

        res.json({
            totalStudents,
            totalUniversities,
            totalRevenue,
            pendingApprovals,
            studentTrend: "+12%",
            revenueTrend: revenueTrend
        });
    } catch (err) {
        res.status(500).json({ msg: "Stats calculation failed", error: err.message });
    }
};

exports.getAllStudents = async (req, res) => {
    try {
        const { search } = req.query;
        let query = { role: { $in: ['student', 'university'] } };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { passportNumber: { $regex: search, $options: 'i' } },
                { instituteName: { $regex: search, $options: 'i' } }
            ];
        }

        const students = await User.find(query).select('-password').sort({ createdAt: -1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching students" });
    }
};

exports.getStudentDetails = async (req, res) => {
    try {
        const student = await User.findById(req.params.id).select('-password');
        if (!student) return res.status(404).json({ msg: "Student details not found" });
        res.json(student);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching profile details" });
    }
};

// ============================================================
// 2. USER MANAGEMENT (APPROVE, REJECT, DELETE & STATUS)
// ============================================================

exports.getPendingUsers = async (req, res) => {
    try {
        const pendingUsers = await User.find({
            isApproved: false,
            role: { $in: ['student', 'university'] }
        }).select('-password').sort({ createdAt: -1 });
        res.json(pendingUsers);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching pending users" });
    }
};

exports.approveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });
        user.isApproved = true;
        user.rejectionRemarks = null;
        await user.save();
        res.json({ msg: "Approved successfully", isApproved: true });
    } catch (err) {
        res.status(500).json({ msg: "Server Error during approval" });
    }
};

exports.rejectUser = async (req, res) => {
    try {
        const { remarks } = req.body;
        if (!remarks) return res.status(400).json({ msg: "Remarks are required for rejection" });

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        user.isApproved = false;
        user.rejectionRemarks = remarks;
        await user.save();
        res.json({ msg: "User rejected successfully", remarks: user.rejectionRemarks });
    } catch (err) {
        res.status(500).json({ msg: "Error rejecting user" });
    }
};

exports.toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });
        user.isActive = !user.isActive;
        await user.save();
        res.json({ msg: `User is ${user.isActive ? 'Active' : 'Inactive'}`, isActive: user.isActive });
    } catch (err) {
        res.status(500).json({ msg: "Error updating user status" });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json({ msg: "User record deleted permanently" });
    } catch (err) {
        res.status(500).json({ msg: "Error deleting user" });
    }
};

// ============================================================
// 3. DOCUMENT VERIFICATION & SINGLE DOC DELETION
// ============================================================

exports.verifySingleDocument = async (req, res) => {
    try {
        const { studentId, docId } = req.params;
        const { remarks, status } = req.body;

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ success: false, msg: "Student profile not found" });

        let targetDoc;
        if (!isNaN(docId)) {
            const idx = parseInt(docId);
            targetDoc = student.documents[idx];
        } else {
            targetDoc = student.documents.id(docId);
        }

        if (!targetDoc) return res.status(404).json({ success: false, msg: "Specific document not found" });

        targetDoc.status = status || 'Verified';
        targetDoc.remarks = remarks || (status === 'Rejected' ? 'Document Rejected' : 'Verified');
        targetDoc.verifiedAt = new Date();

        if (req.file) {
            targetDoc.verifySlip = req.file.path;
            targetDoc.verificationImg = req.file.path;
        }

        student.isSlipLinked = true;
        await student.save();

        res.json({ success: true, msg: `Document ${targetDoc.status} Successfully`, student });

    } catch (err) {
        console.error("Single Verify Error:", err.message);
        res.status(500).json({ success: false, msg: "Server error: " + err.message });
    }
};

exports.verifyDocument = async (req, res) => {
    try {
        const { studentId, docId } = req.params;
        if (!req.file) return res.status(400).json({ msg: "Screenshot required" });

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ msg: "Student not found" });

        const doc = student.documents.id(docId);
        if (!doc) return res.status(404).json({ msg: "Document not found" });

        doc.verifySlip = req.file.path;
        doc.verificationImg = req.file.path;
        doc.status = "Verified";
        doc.verifiedAt = new Date();
        student.isSlipLinked = true;

        await student.save();
        res.json({ msg: "Verified successfully!", student });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};

exports.deleteStudentDocument = async (req, res) => {
    try {
        const { studentId, docId } = req.params;
        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ msg: "Student not found" });

        if (!isNaN(docId)) {
            student.documents.splice(parseInt(docId), 1);
        } else {
            student.documents = student.documents.filter(d => d._id.toString() !== docId);
        }

        await student.save();
        res.json({ msg: "Document deleted", documents: student.documents });

    } catch (err) {
        res.status(500).json({ msg: "Server error", error: err.message });
    }
};

// ============================================================
// 4. FINANCIAL & FEE MANAGEMENT
// ============================================================

exports.getAllFeeRecords = async (req, res) => {
    try {
        const users = await User.find({ role: 'student', isPaid: true })
            .select('name email amount createdAt').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching records" });
    }
};

exports.updateFeeStatus = async (req, res) => {
    try {
        const { isPaid } = req.body;
        const student = await User.findById(req.params.studentId);
        if (!student) return res.status(404).json({ msg: "Student not found" });
        student.isPaid = isPaid;
        await student.save();
        res.json({ msg: "Fee status updated", isPaid: student.isPaid });
    } catch (err) {
        res.status(500).json({ msg: "Error updating fee" });
    }
};