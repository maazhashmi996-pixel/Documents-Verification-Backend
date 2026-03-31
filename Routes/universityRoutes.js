const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { searchStudentByPassport, getUniversityProfile } = require('../Controllers/universityController');

// University Profile
router.get('/profile', auth, getUniversityProfile);

// Search Student by Passport (POST request use kar rahay hain taake data body mein aye)
router.post('/search', auth, searchStudentByPassport);

module.exports = router;