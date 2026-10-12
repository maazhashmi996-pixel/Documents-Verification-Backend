const User = require('../models/User');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const { isConfigured, sendDocumentStatusEmail } = require('../utils/mailer');


exports.getAdminStats = async (req, res) => {
    try {
        const [totalStudents, totalUniversities, pendingApprovals, paidStudents, studentRecords] = await Promise.all([
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'university' }),
            User.countDocuments({ role: 'university', isApproved: false, $or: [{ rejectionRemarks: null }, { rejectionRemarks: '' }] }),
            User.countDocuments({ role: 'student', isPaid: true }),
            User.find({ role: 'student' }).select('documents').lean()
        ]);

        const totals = { totalDocuments: 0, pendingDocuments: 0, verifiedDocuments: 0, rejectedDocuments: 0 };
        const monthMap = new Map();
        for (let offset = 5; offset >= 0; offset -= 1) {
            const month = moment().subtract(offset, 'months').startOf('month');
            monthMap.set(month.format('YYYY-MM'), {
                month: month.format('MMM'),
                received: 0,
                pending: 0,
                verified: 0,
                rejected: 0
            });
        }

        const earliestMonth = moment().subtract(5, 'months').startOf('month');
        for (const student of studentRecords) {
            for (const doc of (student.documents || [])) {
                const status = ['Verified', 'Rejected'].includes(doc.status) ? doc.status : 'Pending';
                totals.totalDocuments += 1;
                if (status === 'Verified') totals.verifiedDocuments += 1;
                else if (status === 'Rejected') totals.rejectedDocuments += 1;
                else totals.pendingDocuments += 1;

                const submittedAt = doc.createdAt ? moment(doc.createdAt) : null;
                if (!submittedAt || !submittedAt.isValid() || submittedAt.isBefore(earliestMonth)) continue;
                const bucket = monthMap.get(submittedAt.format('YYYY-MM'));
                if (!bucket) continue;
                bucket.received += 1;
                bucket[status.toLowerCase()] += 1;
            }
        }

        const paymentPending = await User.countDocuments({
            role: 'student',
            'paymentDetails.proofImage': { $exists: true, $nin: ['', null] },
            'paymentDetails.paymentStatus': 'Pending'
        });

        res.json({
            totalStudents,
            totalUniversities,
            pendingApprovals,
            paidStudents,
            paymentPending,
            ...totals,
            monthlyActivity: Array.from(monthMap.values())
        });
    } catch (err) {
        console.error('Admin stats error:', err.message);
        res.status(500).json({ msg: 'Stats calculation failed' });
    }
};

exports.getAllStudents = async (req, res) => {
    try {
        const { search = '', role, documentStatus, approvalStatus } = req.query;
        const searchText = String(search || '').trim();
        const query = { role: ['student', 'university'].includes(role) ? role : { $in: ['student', 'university'] } };

        if (searchText) {
            const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { passportNumber: { $regex: escaped, $options: 'i' } },
                { instituteName: { $regex: escaped, $options: 'i' } },
                { phone: { $regex: escaped, $options: 'i' } }
            ];
        }

        if (documentStatus && ['Pending', 'Verified', 'Rejected'].includes(documentStatus)) {
            query.documents = { $elemMatch: { status: documentStatus } };
        }

        if (role === 'university' && ['pending', 'approved', 'rejected'].includes(approvalStatus)) {
            if (approvalStatus === 'approved') query.isApproved = true;
            if (approvalStatus === 'pending') {
                query.isApproved = false;
                query.$and = [...(query.$and || []), { $or: [{ rejectionRemarks: null }, { rejectionRemarks: '' }] }];
            }
            if (approvalStatus === 'rejected') {
                query.isApproved = false;
                query.rejectionRemarks = { $exists: true, $nin: [null, ''] };
            }
        }

        const users = await User.find(query).select('-password -__v').sort({ createdAt: -1 }).lean();
        res.json({ users, total: users.length });
    } catch (err) {
        console.error('Admin directory error:', err.message);
        res.status(500).json({ msg: 'Error fetching directory records' });
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
            role: 'university',
            $or: [{ rejectionRemarks: null }, { rejectionRemarks: '' }]
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
        if (user.role !== 'university') return res.status(400).json({ msg: "Only university accounts need approval" });
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
        if (typeof remarks !== 'string' || remarks.trim().length < 5) {
            return res.status(400).json({ msg: 'Detailed remarks of at least 5 characters are required for rejection.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });
        if (user.role !== 'university') return res.status(400).json({ msg: "Only university accounts can be rejected" });

        user.isApproved = false;
        user.rejectionRemarks = remarks.trim();
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
        if (user.role === 'admin') return res.status(403).json({ msg: 'Administrator accounts cannot be toggled here.' });
        user.isActive = user.isActive === false;
        await user.save();
        res.json({ msg: `User is ${user.isActive ? 'Active' : 'Inactive'}`, isActive: user.isActive });
    } catch (err) {
        res.status(500).json({ msg: "Error updating user status" });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: "User not found" });
        if (user.role === 'admin' || String(user._id) === String(req.user._id)) {
            return res.status(403).json({ msg: 'Administrator accounts cannot be deleted from the directory.' });
        }
        await user.deleteOne();
        res.json({ msg: "User record deleted permanently" });
    } catch (err) {
        res.status(500).json({ msg: "Error deleting user" });
    }
};

// ============================================================
// 3. DOCUMENT VERIFICATION & SINGLE DOC DELETION
// ============================================================

// Best-effort email to the student; never blocks or fails the admin's action
const notifyStudent = (student, doc) => {
    if (!isConfigured() || !['Verified', 'Rejected'].includes(doc.status)) return;
    sendDocumentStatusEmail({
        to: student.email,
        name: student.name,
        title: doc.title,
        status: doc.status,
        remarks: doc.remarks
    }).catch((e) => console.error('Status email failed:', e.message));
};

exports.verifySingleDocument = async (req, res) => {
    try {
        const { studentId, docId } = req.params;
        const { remarks, status } = req.body;
        if (!['Verified', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, msg: 'Document status must be Verified or Rejected.' });
        }
        if (status === 'Rejected' && String(remarks || '').trim().length < 5) {
            return res.status(400).json({ success: false, msg: 'Detailed remarks are required when rejecting a document.' });
        }

        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, msg: 'Student profile not found.' });
        }

        let targetDoc;
        if (/^\d+$/.test(String(docId))) {
            targetDoc = student.documents[Number.parseInt(docId, 10)];
        } else {
            targetDoc = student.documents.id(docId);
        }
        if (!targetDoc) return res.status(404).json({ success: false, msg: 'Specific document not found.' });
        if (status === 'Verified' && !req.file && !targetDoc.verifySlip) {
            return res.status(400).json({ success: false, msg: 'A verification attestation is required before approval.' });
        }

        targetDoc.status = status;
        targetDoc.remarks = String(remarks || '').trim() || 'Verified by administrator.';
        targetDoc.verifiedAt = new Date();
        if (req.file) {
            targetDoc.verifySlip = req.file.path;
            targetDoc.verificationImg = req.file.path;
        }
        if (status === 'Verified') student.isSlipLinked = true;

        await student.save();
        notifyStudent(student, targetDoc);
        res.json({ success: true, msg: `Document ${targetDoc.status} successfully.`, student });
    } catch (err) {
        console.error('Single document review error:', err.message);
        res.status(500).json({ success: false, msg: 'Could not update the document status.' });
    }
};

exports.verifyDocument = async (req, res) => {
    try {
        const { studentId, docId } = req.params;
        if (!req.file) return res.status(400).json({ msg: 'Verification attestation is required.' });
        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') return res.status(404).json({ msg: 'Student not found.' });
        const doc = student.documents.id(docId);
        if (!doc) return res.status(404).json({ msg: 'Document not found.' });
        doc.verifySlip = req.file.path;
        doc.verificationImg = req.file.path;
        doc.status = 'Verified';
        doc.remarks = String(req.body.remarks || 'Verified by administrator.').trim();
        doc.verifiedAt = new Date();
        student.isSlipLinked = true;
        await student.save();
        notifyStudent(student, doc);
        res.json({ success: true, msg: 'Document verified successfully.', student });
    } catch (err) {
        console.error('Document verification error:', err.message);
        res.status(500).json({ success: false, msg: 'Could not verify the document.' });
    }
};

exports.deleteStudentDocument = async (req, res) => {
    try {
        const { studentId, docId = req.params.docIndex } = req.params;
        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') return res.status(404).json({ msg: "Student not found" });

        if (!isNaN(docId)) {
            const index = Number.parseInt(docId, 10);
            if (index < 0 || index >= student.documents.length) return res.status(404).json({ msg: 'Document not found' });
            student.documents.splice(index, 1);
        } else {
            const previousLength = student.documents.length;
            student.documents = student.documents.filter(d => String(d._id) !== docId);
            if (previousLength === student.documents.length) return res.status(404).json({ msg: 'Document not found' });
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
            .select('name email isPaid paymentDetails createdAt').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ msg: "Error fetching records" });
    }
};

exports.updateFeeStatus = async (req, res) => {
    try {
        const { isPaid } = req.body;
        if (typeof isPaid !== 'boolean') return res.status(400).json({ msg: 'isPaid must be a boolean.' });
        const student = await User.findById(req.params.studentId);
        if (!student || student.role !== 'student') return res.status(404).json({ msg: 'Student not found' });
        if (isPaid && !student.paymentDetails?.proofImage) {
            return res.status(400).json({ msg: 'A payment proof must be submitted before approval.' });
        }
        student.isPaid = isPaid;
        if (student.paymentDetails) {
            student.paymentDetails.paymentStatus = isPaid ? 'Approved' : (student.paymentDetails.proofImage ? 'Pending' : 'None');
        }
        await student.save();
        res.json({ msg: 'Payment status updated', isPaid: student.isPaid, paymentStatus: student.paymentDetails?.paymentStatus || 'None' });
    } catch (err) {
        console.error('Payment status error:', err.message);
        res.status(500).json({ msg: 'Error updating payment status' });
    }
};


// ============================================================
// 5. ADMIN ACCOUNT SETTINGS
// ============================================================

exports.getAdminSettings = async (req, res) => {
    res.json({
        profile: {
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone || '',
            role: req.user.role
        }
    });
};

exports.updateAdminProfile = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const phone = String(req.body.phone || '').trim();
        if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ msg: 'Enter a valid name and email address.' });
        }
        const duplicate = await User.findOne({ email, _id: { $ne: req.user._id } }).select('_id');
        if (duplicate) return res.status(409).json({ msg: 'That email address is already in use.' });

        const admin = await User.findById(req.user._id);
        if (!admin || admin.role !== 'admin') return res.status(403).json({ msg: 'Administrator access required.' });
        admin.name = name;
        admin.email = email;
        admin.phone = phone;
        await admin.save();
        res.json({ msg: 'Administrator profile updated.', profile: { _id: admin._id, name: admin.name, email: admin.email, phone: admin.phone || '', role: admin.role } });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ msg: 'That email address is already in use.' });
        console.error('Admin profile update error:', err.message);
        res.status(500).json({ msg: 'Could not update administrator profile.' });
    }
};

exports.changeAdminPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 10) {
            return res.status(400).json({ msg: 'Enter your current password and a new password with at least 10 characters.' });
        }
        const admin = await User.findById(req.user._id);
        if (!admin || admin.role !== 'admin') return res.status(403).json({ msg: 'Administrator access required.' });
        const matches = await bcrypt.compare(currentPassword, admin.password);
        if (!matches) return res.status(400).json({ msg: 'Current password is incorrect.' });
        admin.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(12));
        await admin.save();
        res.json({ msg: 'Password updated successfully.' });
    } catch (err) {
        console.error('Admin password update error:', err.message);
        res.status(500).json({ msg: 'Could not update administrator password.' });
    }
};
