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

        // 2. Pending Approvals (Student + University dono ka sum)
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
            totalUniversities, // Ab ye sahi count dikhayega
            totalRevenue,
            pendingApprovals,
            studentTrend: "+12%", // Aap isay bhi dynamic kar sakte hain
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

        // UPDATE: 'student' ki jagah dono roles fetch kiye taake university bhi nazar aaye
        let query = { role: { $in: ['student', 'university'] } };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }, // Search by Email add kiya
                { passportNumber: { $regex: search, $options: 'i' } },
                { instituteName: { $regex: search, $options: 'i' } } // University name search
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
 * @desc    Get list of all users awaiting approval (Students & Universities)
 */
exports.getPendingUsers = async (req, res) => {
    try {
        // Fix: Role filter hataya taake University requests bhi ayein
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
 * @route   PUT /api/admin/verify-doc/:studentId/:docId
 * @desc    Verify document and attach screenshot
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

        doc.verificationImg = req.file.path; // Cloudinary or Local path
        doc.status = "Verified";

        await student.save();
        res.json({ msg: "Document verified successfully!", student });
    } catch (err) {
        console.error("Verification Error:", err.message);
        res.status(500).send("Server Error during document verification");
    }
};