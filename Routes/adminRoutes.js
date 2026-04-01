const express = require('express');
const router = express.Router();

// --- MIDDLEWARES ---
// 'protect' token verify karta hai, 'adminOnly' check karta hai ke role admin hai ya nahi
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/cloudinaryConfig'); // Cloudinary/Multer config

// --- CONTROLLERS ---
const {
    getAdminStats,      // Dashboard summary cards ke liye
    getAllStudents,     // Search aur directory ke liye
    getPendingUsers,    // Approval list ke liye
    approveUser,        // Approve button ke liye
    verifyDocument      // Doc verification + screenshot upload
} = require('../controllers/adminController');

// ============================================================
// 1. ANALYTICS & DIRECTORY ROUTES
// ============================================================

// @desc    Get VIP Dashboard Stats (Revenue, Students, Trends)
// @access  Private/Admin
router.get('/stats', protect, adminOnly, getAdminStats);

// @desc    Get All Students (Supports search by name/passport)
// @access  Private/Admin
router.get('/students', protect, adminOnly, getAllStudents);


// ============================================================
// 2. USER APPROVAL ROUTES
// ============================================================

// @desc    Sary pending (isApproved: false) users ki list dekhna
// @access  Private/Admin
router.get('/pending-users', protect, adminOnly, getPendingUsers);

// @desc    User (Student/University) ko approve karna
// @access  Private/Admin
router.put('/approve/:id', protect, adminOnly, approveUser);


// ============================================================
// 3. DOCUMENT VERIFICATION ROUTES
// ============================================================

// @desc    Student ka document verify karna + Screenshot upload karna
// 'file' wo key hai jo frontend FormData mein use hogi
// @access  Private/Admin
router.put('/verify-doc/:studentId/:docId', protect, adminOnly, upload.single('file'), verifyDocument);


module.exports = router;