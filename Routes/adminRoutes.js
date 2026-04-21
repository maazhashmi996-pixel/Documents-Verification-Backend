const express = require('express');
const router = express.Router();

// --- MIDDLEWARES ---
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/cloudinaryConfig');

// --- CONTROLLER IMPORT ---
const adminController = require('../Controllers/adminController');

// ============================================================
// 1. ANALYTICS & DIRECTORY ROUTES
// ============================================================
router.get('/stats', protect, adminOnly, adminController.getAdminStats);
router.get('/students', protect, adminOnly, adminController.getAllStudents);

// ============================================================
// 2. USER APPROVAL ROUTES
// ============================================================
router.get('/pending-users', protect, adminOnly, adminController.getPendingUsers);
router.put('/approve/:id', protect, adminOnly, adminController.approveUser);

// ============================================================
// 3. DOCUMENT VERIFICATION ROUTES (UPDATED)
// ============================================================

/**
 * @route   PUT /api/admin/verify-single-doc/:docId
 * @desc    Verify a document and add remarks
 * @access  Private/Admin
 */
router.put(
    '/verify-single-doc/:docId',
    protect,
    adminOnly,
    upload.single('attestedDoc'),
    adminController.verifySingleDocument // Remarks wala naya controller function
);

/**
 * @route   PUT /api/admin/verify-doc/:studentId/:docId
 * @desc    Verify with Screenshot upload (Cloudinary)
 */
router.put(
    '/verify-doc/:studentId/:docId',
    protect,
    adminOnly,
    upload.single('file'),
    adminController.verifyDocument
);

module.exports = router;