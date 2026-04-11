const express = require('express');
const router = express.Router();

// --- MIDDLEWARES ---
const { protect } = require('../middleware/auth');
const upload = require('../middleware/cloudinaryConfig');

// --- CONTROLLERS ---
const {
    uploadDocument,
    getStudentDashboard,
    submitPaymentProof, // Updated: Controller ke naye naam se match kar diya
    deleteDocument
} = require('../Controllers/studentController');

// ============================================================
// STUDENT PORTAL ROUTES
// ============================================================

// @desc    Get Student Dashboard Data (Profile, Docs Status)
// @access  Private/Student
router.get('/dashboard', protect, getStudentDashboard);

// @desc    Handle Student Payment Proof Submission
// @access  Private/Student
// POST method use kiya hai kyunke hum screenshot (file) upload kar rahe hain
router.post('/submit-payment', protect, upload.single('file'), submitPaymentProof);

// @desc    Upload Document (Single File)
// @access  Private/Student
// Ismein controller check karega ke 'isPaid' true hai ya nahi
router.post('/upload', protect, upload.single('file'), uploadDocument);

// @desc    Delete Specific Document
// @access  Private/Student
router.delete('/document/:docId', protect, deleteDocument);

module.exports = router;