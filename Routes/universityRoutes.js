const express = require('express');
const router = express.Router();

/**
 * FIXED: Middleware import fix
 * Aapki middleware file mein 'protect' naam ka function hai, 
 * isliye hum usay destructuring se nikaal rahe hain.
 */
const { protect } = require('../middleware/auth');

/**
 * @import University Controller
 */
const universityController = require('../Controllers/universityController');

/**
 * @route   GET /api/university/profile
 * @desc    University profile aur approval status check karne ke liye
 * @access  Private
 */
router.get('/profile', protect, universityController.getUniversityProfile);

/**
 * @route   POST /api/university/search-student
 * @desc    Passport number ke zariye student ka verified data search karna
 * @access  Private (Only Approved Universities)
 */
router.post('/search-student', protect, universityController.searchStudentByPassport);

module.exports = router;