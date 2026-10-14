const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const universityController = require('../Controllers/universityController');

// A logged-in user is not sufficient: all university workspace endpoints are
// restricted to active university accounts that have been approved by an admin.
const approvedUniversityOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'university') {
        return res.status(403).json({ success: false, msg: 'This area is available to university accounts only.' });
    }
    if (req.user.isApproved !== true) {
        return res.status(403).json({ success: false, msg: 'Your university account is pending administrator approval.' });
    }
    if (req.user.isActive === false) {
        return res.status(403).json({ success: false, msg: 'Your university account is inactive. Contact the administrator.' });
    }
    return next();
};

router.get('/profile', protect, approvedUniversityOnly, universityController.getUniversityProfile);
router.patch('/profile', protect, approvedUniversityOnly, universityController.updateUniversityProfile);
router.put('/settings/password', protect, approvedUniversityOnly, universityController.changeUniversityPassword);
router.get('/overview', protect, approvedUniversityOnly, universityController.getUniversityOverview);
router.get('/history', protect, approvedUniversityOnly, universityController.getUniversityHistory);
router.post('/search-student', protect, approvedUniversityOnly, universityController.searchStudentByPassport);

module.exports = router;
