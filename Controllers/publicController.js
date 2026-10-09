const User = require('../models/User');

// "Ahmed Khan" -> "A**** K***"
const maskName = (name = '') =>
    name.split(/\s+/).filter(Boolean)
        .map((w) => w[0] + '*'.repeat(Math.min(Math.max(w.length - 1, 1), 5)))
        .join(' ');

/**
 * @route   GET /api/public/verify/:code
 * @desc    Anyone holding the link/QR can check one document. No login.
 *          Only safe fields are returned (no file URLs, email, passport or phone).
 */
exports.verifyByCode = async (req, res) => {
    try {
        const code = String(req.params.code || '').trim();
        if (!/^[A-Za-z0-9_-]{8,40}$/.test(code)) {
            return res.status(404).json({ success: false, msg: 'This verification link is not valid.' });
        }

        const student = await User.findOne({ 'documents.verifyCode': code, role: 'student' });
        const doc = student && student.documents.find((d) => d.verifyCode === code);

        if (!student || !doc || student.isActive === false) {
            return res.status(404).json({ success: false, msg: 'This verification link is not valid or was turned off.' });
        }

        res.json({
            success: true,
            data: {
                holder: maskName(student.name),
                title: doc.title,
                institute: doc.institute,
                status: doc.status,
                remarks: doc.status === 'Pending' ? '' : doc.remarks || '',
                hasAttestation: Boolean(doc.verificationImg || doc.verifySlip),
                submittedAt: doc.createdAt,
                verifiedAt: doc.status === 'Pending' ? null : doc.verifiedAt || null
            }
        });
    } catch (err) {
        console.error('Public Verify Error:', err.message);
        res.status(500).json({ success: false, msg: 'Server error' });
    }
};
