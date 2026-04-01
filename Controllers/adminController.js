const User = require('../models/User');
const moment = require('moment');

/**
 * @route   GET /api/admin/stats
 * @desc    VIP Dashboard Summary (Revenue, Students, Trends)
 */
exports.getAdminStats = async (req, res) => {
    try {
        const { period } = req.query;
        let startDate;

        // Filter Logic
        if (period === 'day') startDate = moment().startOf('day').toDate();
        else if (period === 'week') startDate = moment().subtract(7, 'days').toDate();
        else if (period === 'month') startDate = moment().subtract(30, 'days').toDate();
        else startDate = new Date(0); // All time

        // 1. Total Students & Pending Approvals
        const totalStudents = await User.countDocuments({ role: 'student' });
        const pendingApprovals = await User.countDocuments({ role: 'student', isApproved: false });

        // 2. Unique Universities Count
        const universities = await User.distinct('university', { role: 'student' });
        const totalUniversities = universities.filter(Boolean).length;

        // 3. Revenue Calculation (Assuming 5000 per paid student)
        const paidUsersCount = await User.countDocuments({
            role: 'student',
            isPaid: true,
            createdAt: { $gte: startDate }
        });
        const totalRevenue = paidUsersCount * 5000;

        // 4. Calculate Trends (Simple Example: comparing with last period)
        // Aap yahan complex logic bhi laga saktay hain
        const lastPeriodStart = moment(startDate).subtract(moment().diff(startDate, 'days'), 'days').toDate();
        const previousPaidCount = await User.countDocuments({
            role: 'student',
            isPaid: true,
            createdAt: { $gte: lastPeriodStart, $lt: startDate }
        });

        const revenueTrend = previousPaidCount === 0 ? "+100%" :
            `${(((paidUsersCount - previousPaidCount) / previousPaidCount) * 100).toFixed(0)}%`;

        res.json({
            totalStudents,
            totalUniversities,
            totalRevenue,
            pendingApprovals,
            studentTrend: "+12%", // Static for now or calculate like revenue
            revenueTrend: revenueTrend.startsWith('-') ? revenueTrend : `+${revenueTrend}`
        });
    } catch (err) {
        res.status(500).json({ msg: "Stats calculation failed", error: err.message });
    }
};

/**
 * @route   GET /api/admin/students
 * @desc    Search students by Name or Passport with Pagination
 */
exports.getAllStudents = async (req, res) => {
    try {
        const { search } = req.query;
        let query = { role: 'student' };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { passportNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const students = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(students);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching students" });
    }
};

/**
 * @route   PUT /api/admin/approve/:id
 * @desc    Approve student/university
 */
exports.approveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });

        user.isApproved = true;
        await user.save();

        res.json({ msg: `${user.name} approved successfully.`, user });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};

/**
 * @route   PUT /api/admin/verify-doc/:studentId/:docId
 * @desc    Verify document and upload screenshot
 */
exports.verifyDocument = async (req, res) => {
    try {
        const { studentId, docId } = req.params;

        if (!req.file) return res.status(400).json({ msg: "Screenshot is required" });

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ msg: "Student not found" });

        const doc = student.documents.id(docId);
        if (!doc) return res.status(404).json({ msg: "Document not found" });

        doc.verificationImg = req.file.path; // Cloudinary/Local URL
        doc.status = "Verified";

        await student.save();
        res.json({ msg: "Document verified!", student });
    } catch (err) {
        res.status(500).send("Server Error");
    }
};