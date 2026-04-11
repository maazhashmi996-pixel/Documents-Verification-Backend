const express = require('express');
const router = express.Router();

// --- MIDDLEWARES ---
// Rasta (path) check karlein ke 'middleware/auth' hi hai ya 'middleware/authMiddleware'
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/cloudinaryConfig');

// --- CONTROLLER IMPORT ---
const adminController = require('../Controllers/adminController');

// ============================================================
// 1. ANALYTICS & DIRECTORY ROUTES
// ============================================================

// Dashboard Stats
router.get('/stats', protect, adminOnly, adminController.getAdminStats);

// All Students (Search/List)
router.get('/students', protect, adminOnly, adminController.getAllStudents);

// ============================================================
// 2. USER APPROVAL ROUTES
// ============================================================

// Pending Users List
router.get('/pending-users', protect, adminOnly, adminController.getPendingUsers);

// Approve Student/University
router.put('/approve/:id', protect, adminOnly, adminController.approveUser);

// ============================================================
// 3. DOCUMENT VERIFICATION ROUTES
// ============================================================

// Verify Doc + Screenshot Upload
// Frontend se 'file' ki key mein image bhejna
router.put('/verify-doc/:studentId/:docId', protect, adminOnly, upload.single('file'), adminController.verifyDocument);

module.exports = router;