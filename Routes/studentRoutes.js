const express = require('express');
const router = express.Router();

// --- MIDDLEWARES ---
// 'auth' ki jagah '{ protect }' use karein kyunke humne middleware update kar diya hai
const { protect } = require('../middleware/auth');
const upload = require('../middleware/cloudinaryConfig');

// --- CONTROLLERS ---
const {
    uploadDocument,
    getStudentDashboard,
    makePayment,
    deleteDocument
} = require('../Controllers/studentController');

// ============================================================
// STUDENT PORTAL ROUTES
// ============================================================

// @desc    Get Student Dashboard Data (Profile, Docs Status)
// @access  Private/Student
router.get('/dashboard', protect, getStudentDashboard);

// @desc    Handle Student Payment
// @access  Private/Student
router.put('/pay', protect, makePayment);

// @desc    Upload Document (Single File)
// @access  Private/Student
router.post('/upload', protect, upload.single('file'), uploadDocument);

// @desc    Delete Specific Document
// @access  Private/Student
router.delete('/document/:docId', protect, deleteDocument);

module.exports = router;