const express = require('express');
const router = express.Router();

// --- MIDDLEWARES ---
const { protect, studentOnly } = require('../middleware/auth');
const upload = require('../middleware/cloudinaryConfig');

// --- CONTROLLERS ---
const {
    uploadDocument,
    getStudentDashboard,
    submitPaymentProof,
    deleteDocument,
    verifyPassportNumber, // Naya controller function university data ke liye
    shareDocument,
    unshareDocument
} = require('../Controllers/studentController');

// ============================================================
// STUDENT PORTAL ROUTES
// ============================================================

/**
 * @route   GET /api/student/dashboard
 * @desc    Get Student Dashboard Data (Profile, Docs Status)
 * @access  Private/Student
 */
router.get('/dashboard', protect, studentOnly, getStudentDashboard);

/**
 * @route   GET /api/student/verify-passport
 * @desc    Verify Passport from University Database
 * @access  Private/Student
 * @query   ?passport=123456
 */
router.get('/verify-passport', protect, verifyPassportNumber);

/**
 * @route   POST /api/student/submit-payment
 * @desc    Handle Student Payment Proof Submission
 * @access  Private/Student
 */
router.post('/submit-payment', protect, studentOnly, upload.single('file'), submitPaymentProof);

/**
 * @route   POST /api/student/upload
 * @desc    Upload Document (Single File)
 * @access  Private/Student
 */
router.post('/upload', protect, studentOnly, upload.single('file'), uploadDocument);

/**
 * @route   DELETE /api/student/document/:docId
 * @desc    Delete Specific Document
 * @access  Private/Student
 */
router.delete('/document/:docId', protect, studentOnly, deleteDocument);

// Public verification link (QR) for one document
router.post('/document/:docId/share', protect, studentOnly, shareDocument);
router.delete('/document/:docId/share', protect, studentOnly, unshareDocument);

module.exports = router;