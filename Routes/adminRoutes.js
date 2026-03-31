const express = require('express');
const router = express.Router();

// Middlewares
const auth = require('../middleware/authMiddleware'); // Token check karne k liye
const upload = require('../middleware/cloudinaryConfig'); // File upload karne k liye

// Controllers
const {
    getPendingUsers,
    approveUser,
    getAllStudentsData,
    verifyDocument
} = require('../controllers/adminController');

// --- 1. USER APPROVAL ROUTES ---

// @desc    Sary pending (isApproved: false) users ki list dekhna
router.get('/pending-users', auth, getPendingUsers);

// @desc    User (Student/University) ko approve karna taake wo login kar sakain
router.put('/approve/:id', auth, approveUser);


// --- 2. DOCUMENT VERIFICATION ROUTES ---

// @desc    Sary students aur unky uploaded documents ki list dekhna
router.get('/all-students', auth, getAllStudentsData);

// @desc    Student ka document verify karna + Screenshot upload karna
// 'file' wo key hai jo hum frontend (FormData) sy bhaijain gy
router.put('/verify-doc/:studentId/:docId', auth, upload.single('file'), verifyDocument);


module.exports = router;