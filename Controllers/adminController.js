const User = require('../models/User');
const moment = require('moment');

/**
 * @route   GET /api/admin/stats
 * @desc    VIP Dashboard Summary (Revenue, Students, Universities, Trends)
 */
exports.getAdminStats = async (req, res) => {
    try {
        const { period } = req.query;
        let startDate;

        // Filter Logic based on time period
        if (period === 'day') startDate = moment().startOf('day').toDate();
        else if (period === 'week') startDate = moment().subtract(7, 'days').startOf('day').toDate();
        else if (period === 'month') startDate = moment().subtract(30, 'days').startOf('day').toDate();
        else startDate = new Date(0); // All time

        // 1. Total Counts
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalUniversities = await User.countDocuments({ role: 'university' });

        // 2. Pending Approvals
        const pendingApprovals = await User.countDocuments({
            isApproved: false,
            role: { $in: ['student', 'university'] }
        });

        // 3. Revenue Calculation (5000 per paid student)
        const paidUsersCount = await User.countDocuments({
            role: 'student',
            isPaid: true,
            createdAt: { $gte: startDate }
        });
        const totalRevenue = paidUsersCount * 5000;

        // 4. Calculate Revenue Trends
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
        console.error("Stats Error:", err.message);
        res.status(500).json({ msg: "Stats calculation failed", error: err.message });
    }
};

/**
 * @route   GET /api/admin/students
 * @desc    Get All Users (Students & Universities) with Search
 */
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

        const students = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(students);
    } catch (err) {
        console.error("Fetch Students Error:", err.message);
        res.status(500).json({ msg: "Error fetching students" });
    }
};

/**
 * @route   GET /api/admin/pending-users
 * @desc    Get list of all users awaiting approval
 */
exports.getPendingUsers = async (req, res) => {
    try {
        const pendingUsers = await User.find({
            isApproved: false,
            role: { $in: ['student', 'university'] }
        })
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(pendingUsers);
    } catch (err) {
        console.error("Pending Users Error:", err.message);
        res.status(500).json({ msg: "Error fetching pending users" });
    }
};

/**
 * @route   PUT /api/admin/approve/:id
 * @desc    Approve student or university account
 */
exports.approveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        user.isApproved = true;
        await user.save();

        res.json({
            msg: `${user.name || user.instituteName} (${user.role}) approved successfully.`,
            user: { id: user._id, isApproved: user.isApproved }
        });
    } catch (err) {
        console.error("Approval Error:", err.message);
        res.status(500).send("Server Error during approval");
    }
};

/**
 * @route   PUT /api/admin/verify-single-doc/:docId
 * @desc    Verify a document (Smart Handler for Student ID or Document ID)
 */
exports.verifySingleDocument = async (req, res) => {
    try {
        const { docId } = req.params;
        const { remarks, status, docIndex } = req.body || {};

        // Step 1: Check if the ID is a Student ID
        let student = await User.findById(docId);

        if (student && student.documents && student.documents.length > 0) {
            const idx = docIndex !== undefined ? parseInt(docIndex) : 0;

            if (student.documents[idx]) {
                student.documents[idx].status = status || 'Verified';
                student.documents[idx].remarks = remarks || 'Confidence Starts Here: Document Verified.';
                student.documents[idx].verifiedAt = new Date();

                // FIXED: Agar admin ne file upload ki hai toh link save karo
                if (req.file) {
                    student.documents[idx].verifySlip = req.file.path;
                }

                await student.save();
                return res.json({ success: true, msg: "Document authenticated via Student Profile", student });
            }
        }

        // Step 2: Update by specific Document ID using $set
        const updateData = {
            "documents.$.status": status || 'Verified',
            "documents.$.remarks": remarks || 'Confidence Starts Here: Document Verified.',
            "documents.$.verifiedAt": new Date()
        };

        // FIXED: File path handling for specific Doc ID update
        if (req.file) {
            updateData["documents.$.verifySlip"] = req.file.path;
        }

        const updatedStudent = await User.findOneAndUpdate(
            { "documents._id": docId },
            { $set: updateData },
            { new: true, returnDocument: 'after' }
        );

        if (!updatedStudent) {
            return res.status(404).json({ success: false, msg: "Document not found in registry" });
        }

        res.json({
            success: true,
            msg: "Document authenticated with remarks and slip",
            student: updatedStudent
        });
    } catch (err) {
        console.error("Single Verify Error:", err.message);
        res.status(500).json({ success: false, msg: "Server Error during verification" });
    }
};

/**
 * @route   PUT /api/admin/verify-doc/:studentId/:docId
 * @desc    Verify document and attach screenshot (Cloudinary)
 */
exports.verifyDocument = async (req, res) => {
    try {
        const { studentId, docId } = req.params;

        if (!req.file) {
            return res.status(400).json({ msg: "Verification screenshot is required" });
        }

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ msg: "Student not found" });

        const doc = student.documents.id(docId);
        if (!doc) return res.status(404).json({ msg: "Document not found" });

        // FIELD CONSISTENCY: University dashboard verifySlip check kar raha hai
        doc.verifySlip = req.file.path;
        doc.verificationImg = req.file.path; // Old field for safety
        doc.status = "Verified";
        doc.verifiedAt = new Date();

        await student.save();
        res.json({ msg: "Document verified successfully with proof!", student });
    } catch (err) {
        console.error("Verification Error:", err.message);
        res.status(500).send("Server Error during document verification");
    }
};