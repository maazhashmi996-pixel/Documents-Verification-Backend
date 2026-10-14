const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UniversityLookupActivity = require('../models/UniversityLookupActivity');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const saveLookupActivity = async (record) => {
    try {
        await UniversityLookupActivity.create(record);
    } catch (err) {
        // Logging is important, but an analytics write should not take down an authorised lookup.
        console.error('University lookup activity could not be saved:', err.message);
    }
};

const countStatuses = (documents = []) => documents.reduce((counts, document) => {
    const status = String(document.status || 'Pending').toLowerCase();
    counts.documentCount += 1;
    if (status === 'verified') counts.verifiedCount += 1;
    else if (status === 'rejected') counts.rejectedCount += 1;
    else counts.pendingCount += 1;
    return counts;
}, { documentCount: 0, verifiedCount: 0, pendingCount: 0, rejectedCount: 0 });

/**
 * @route POST /api/university/search-student
 * @desc Search one student by exact passport number and record an audit event.
 */
const searchStudentByPassport = async (req, res) => {
    const rawPassport = req.body?.passportNumber || req.query?.passportNumber || req.body?.searchQuery;
    const passportNumber = typeof rawPassport === 'string' ? rawPassport.trim() : '';

    if (!passportNumber || passportNumber.length > 40) {
        return res.status(400).json({ success: false, msg: 'Enter a valid passport number (maximum 40 characters).' });
    }

    try {
        const university = req.user;
        const passportSuffix = passportNumber.slice(-4).toUpperCase();
        const student = await User.findOne({
            passportNumber: { $regex: new RegExp(`^${escapeRegex(passportNumber)}$`, 'i') },
            role: 'student',
            isActive: { $ne: false }
        }).select('name email passportNumber documents profileStatus remarks');

        if (!student) {
            await saveLookupActivity({
                universityId: university._id,
                passportSuffix,
                matched: false
            });
            return res.status(404).json({ success: false, msg: 'No student found with this passport number.' });
        }

        const documents = Array.isArray(student.documents) ? student.documents : [];
        const documentCounts = countStatuses(documents);
        const slipExists = documents.some((doc) =>
            doc.name === 'verifySlip' ||
            doc.documentType === 'verifySlip' ||
            doc.isAdminUploaded === true ||
            doc.verifySlip ||
            doc.adminScreenshot ||
            doc.adminSlip
        );

        await saveLookupActivity({
            universityId: university._id,
            studentId: student._id,
            passportSuffix,
            matched: true,
            ...documentCounts
        });

        return res.json({
            success: true,
            data: {
                fullName: student.name,
                email: student.email,
                passportNumber: student.passportNumber,
                documents,
                profileStatus: student.profileStatus || 'Active',
                remarks: student.remarks || '',
                isAuthentic: student.profileStatus !== 'Flagged',
                isSlipLinked: slipExists
            },
            message: documents.length
                ? 'Student records retrieved successfully.'
                : 'The student record exists, but no documents have been submitted.'
        });
    } catch (err) {
        console.error('University Search Error:', err.message);
        return res.status(500).json({ success: false, msg: 'Could not complete the student lookup. Please try again.' });
    }
};

const getUniversityProfile = async (req, res) => {
    try {
        const university = await User.findById(req.user.id)
            .select('name instituteName email phone role isApproved rejectionRemarks isActive createdAt updatedAt');
        if (!university || university.role !== 'university') {
            return res.status(404).json({ success: false, msg: 'University account not found.' });
        }
        return res.json(university);
    } catch (err) {
        console.error('University profile fetch error:', err.message);
        return res.status(500).json({ success: false, msg: 'Could not load your university profile.' });
    }
};

const updateUniversityProfile = async (req, res) => {
    try {
        // An approved institution's legal identity is not self-editable. Name changes
        // must be reviewed by an administrator so the approval badge cannot be reused
        // after a university changes its identity.
        if (req.body?.name !== undefined || req.body?.instituteName !== undefined) {
            return res.status(403).json({ success: false, msg: 'Institution name changes require administrator review.' });
        }

        const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : undefined;
        if (phone === undefined) {
            return res.status(400).json({ success: false, msg: 'Provide a contact phone number to update your profile.' });
        }
        if (phone.length > 30) {
            return res.status(400).json({ success: false, msg: 'Phone number must be 30 characters or fewer.' });
        }

        const university = await User.findOneAndUpdate(
            { _id: req.user.id, role: 'university' },
            { $set: { phone } },
            { new: true, runValidators: true }
        ).select('name instituteName email phone role isApproved rejectionRemarks isActive createdAt updatedAt');

        if (!university) return res.status(404).json({ success: false, msg: 'University account not found.' });
        return res.json({ success: true, msg: 'Contact details updated.', profile: university });
    } catch (err) {
        console.error('University profile update error:', err.message);
        return res.status(500).json({ success: false, msg: 'Could not update your university profile.' });
    }
};

const changeUniversityPassword = async (req, res) => {
    try {
        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, msg: 'Current password and new password are required.' });
        }
        if (newPassword.length < 8 || newPassword.length > 128) {
            return res.status(400).json({ success: false, msg: 'New password must be between 8 and 128 characters.' });
        }

        const university = await User.findOne({ _id: req.user.id, role: 'university' }).select('+password');
        if (!university) return res.status(404).json({ success: false, msg: 'University account not found.' });

        const matches = await bcrypt.compare(currentPassword, university.password);
        if (!matches) return res.status(400).json({ success: false, msg: 'Your current password is incorrect.' });

        university.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
        await university.save();
        return res.json({ success: true, msg: 'Password updated successfully.' });
    } catch (err) {
        console.error('University password update error:', err.message);
        return res.status(500).json({ success: false, msg: 'Could not update your password.' });
    }
};

const getUniversityOverview = async (req, res) => {
    try {
        const universityId = req.user._id;
        const now = new Date();
        const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalLookups,
            matchedLookups,
            recentLookups,
            uniqueStudentIds,
            lookupMonthlyRows,
            recentActivity,
            totalStudents,
            totalUniversities,
            approvedUniversities,
            documentSummaryRows,
            documentMonthlyRows
        ] = await Promise.all([
            UniversityLookupActivity.countDocuments({ universityId }),
            UniversityLookupActivity.countDocuments({ universityId, matched: true }),
            UniversityLookupActivity.countDocuments({ universityId, createdAt: { $gte: last30Days } }),
            UniversityLookupActivity.distinct('studentId', { universityId, matched: true, studentId: { $ne: null } }),
            UniversityLookupActivity.aggregate([
                { $match: { universityId, createdAt: { $gte: startMonth } } },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        total: { $sum: 1 },
                        matched: { $sum: { $cond: ['$matched', 1, 0] } }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            UniversityLookupActivity.find({ universityId })
                .sort({ createdAt: -1 })
                .limit(6)
                .select('passportSuffix matched documentCount verifiedCount pendingCount rejectedCount createdAt')
                .lean(),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'university' }),
            User.countDocuments({ role: 'university', isApproved: true, isActive: { $ne: false } }),
            User.aggregate([
                { $match: { role: 'student' } },
                { $unwind: '$documents' },
                {
                    $group: {
                        _id: null,
                        totalDocuments: { $sum: 1 },
                        verifiedDocuments: { $sum: { $cond: [{ $eq: ['$documents.status', 'Verified'] }, 1, 0] } },
                        rejectedDocuments: { $sum: { $cond: [{ $eq: ['$documents.status', 'Rejected'] }, 1, 0] } },
                        pendingDocuments: { $sum: { $cond: [{ $eq: ['$documents.status', 'Pending'] }, 1, 0] } }
                    }
                }
            ]),
            User.aggregate([
                { $match: { role: 'student' } },
                { $unwind: '$documents' },
                { $match: { 'documents.createdAt': { $gte: startMonth } } },
                {
                    $group: {
                        _id: { year: { $year: '$documents.createdAt' }, month: { $month: '$documents.createdAt' } },
                        total: { $sum: 1 },
                        verified: { $sum: { $cond: [{ $eq: ['$documents.status', 'Verified'] }, 1, 0] } },
                        pending: { $sum: { $cond: [{ $eq: ['$documents.status', 'Pending'] }, 1, 0] } },
                        rejected: { $sum: { $cond: [{ $eq: ['$documents.status', 'Rejected'] }, 1, 0] } }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ])
        ]);

        const lookupMonthMap = new Map(lookupMonthlyRows.map((row) => [
            `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
            { total: row.total, matched: row.matched, notFound: row.total - row.matched }
        ]));
        const documentMonthMap = new Map(documentMonthlyRows.map((row) => [
            `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
            { total: row.total, verified: row.verified, pending: row.pending, rejected: row.rejected }
        ]));
        const monthlyActivity = [];
        const platformMonthlyActivity = [];
        for (let offset = 5; offset >= 0; offset -= 1) {
            const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
            const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            const label = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(date);
            const lookupCounts = lookupMonthMap.get(key) || { total: 0, matched: 0, notFound: 0 };
            const documentCounts = documentMonthMap.get(key) || { total: 0, verified: 0, pending: 0, rejected: 0 };
            monthlyActivity.push({ key, label, ...lookupCounts });
            platformMonthlyActivity.push({ key, label, ...documentCounts });
        }

        const documentSummary = documentSummaryRows[0] || {
            totalDocuments: 0,
            verifiedDocuments: 0,
            pendingDocuments: 0,
            rejectedDocuments: 0
        };

        return res.json({
            stats: {
                totalLookups,
                matchedLookups,
                notFoundLookups: totalLookups - matchedLookups,
                uniqueStudents: uniqueStudentIds.length,
                lookupsLast30Days: recentLookups,
                totalStudents,
                totalUniversities,
                approvedUniversities,
                totalDocuments: documentSummary.totalDocuments,
                verifiedDocuments: documentSummary.verifiedDocuments,
                pendingDocuments: documentSummary.pendingDocuments,
                rejectedDocuments: documentSummary.rejectedDocuments
            },
            monthlyActivity,
            platformMonthlyActivity,
            recentActivity
        });
    } catch (err) {
        console.error('University overview error:', err.message);
        return res.status(500).json({ success: false, msg: 'Could not load university overview.' });
    }
};

const getUniversityHistory = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(5, Number.parseInt(req.query.limit, 10) || 20));
        const filter = { universityId: req.user._id };
        const [total, items] = await Promise.all([
            UniversityLookupActivity.countDocuments(filter),
            UniversityLookupActivity.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .select('passportSuffix matched documentCount verifiedCount pendingCount rejectedCount createdAt')
                .lean()
        ]);
        return res.json({ items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
    } catch (err) {
        console.error('University history error:', err.message);
        return res.status(500).json({ success: false, msg: 'Could not load lookup history.' });
    }
};

module.exports = {
    searchStudentByPassport,
    getUniversityProfile,
    updateUniversityProfile,
    changeUniversityPassword,
    getUniversityOverview,
    getUniversityHistory
};
