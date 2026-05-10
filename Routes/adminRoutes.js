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

/**
 * @route   GET /api/admin/stats
 * @desc    Dashboard stats aur overall counts (Revenue, Trends)
 */
router.get('/stats', protect, adminOnly, adminController.getAdminStats);

/**
 * @route   GET /api/admin/students
 * @desc    Tamam students aur universities ki list fetch karne ke liye
 */
router.get('/students', protect, adminOnly, adminController.getAllStudents);

/**
 * @route   GET /api/admin/student-profile/:id
 * @desc    Kisi aik student ka mukammal data profile view ke liye
 */
router.get('/student-profile/:id', protect, adminOnly, adminController.getStudentDetails);

// ============================================================
// 2. USER MANAGEMENT (APPROVE, REJECT, DELETE & STATUS)
// ============================================================

/**
 * @route   GET /api/admin/pending-users
 */
router.get('/pending-users', protect, adminOnly, adminController.getPendingUsers);

/**
 * @route   PUT /api/admin/approve/:id
 */
router.put('/approve/:id', protect, adminOnly, adminController.approveUser);

/**
 * @route   PUT /api/admin/reject/:id
 */
router.put('/reject/:id', protect, adminOnly, adminController.rejectUser);

/**
 * @route   PATCH /api/admin/users/:id/toggle-status
 * @desc    Frontend Toggle Status match (Active/Inactive)
 */
router.patch('/users/:id/toggle-status', protect, adminOnly, adminController.toggleUserStatus);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Frontend Delete match (Student/University)
 */
router.delete('/users/:id', protect, adminOnly, adminController.deleteUser);

/**
 * @route   PATCH /api/admin/user-status/:id
 * @desc    Legacy Status Toggle route for backward compatibility
 */
router.patch('/user-status/:id', protect, adminOnly, adminController.toggleUserStatus);

/**
 * @route   DELETE /api/admin/delete-user/:id
 * @desc    Legacy Delete route for backward compatibility
 */
router.delete('/delete-user/:id', protect, adminOnly, adminController.deleteUser);

// ============================================================
// 3. DOCUMENT VERIFICATION & MANAGEMENT
// ============================================================

/**
 * @route   DELETE /api/admin/delete-document/:studentId/:docId
 * @desc    Specific document delete karne ke liye (Original naming preserved)
 */
router.delete('/delete-document/:studentId/:docId', protect, adminOnly, adminController.deleteStudentDocument);

/**
 * @route   DELETE /api/admin/verify-single-doc/delete/:studentId/:docIndex
 * @desc    Unique path for single document deletion to avoid route clash
 */
router.delete(
    '/verify-single-doc/delete/:studentId/:docIndex',
    protect,
    adminOnly,
    adminController.verifySingleDocument
);

/**
 * @route   PUT /api/admin/verify-single-doc/:studentId/:docId
 * @desc    PRODUCTION READY: Verification path with dual IDs to prevent 404
 */
router.put(
    '/verify-single-doc/:studentId/:docId',
    protect,
    adminOnly,
    upload.single('attestedDoc'),
    adminController.verifySingleDocument
);

/**
 * @route   PUT /api/admin/verify-doc/:studentId/:docId
 * @desc    Document verification with manual Screenshot upload (Legacy Flow)
 */
router.put(
    '/verify-doc/:studentId/:docId',
    protect,
    adminOnly,
    upload.single('file'),
    adminController.verifyDocument
);

// ============================================================
// 4. FINANCIAL & FEE MANAGEMENT
// ============================================================

/**
 * @route   GET /api/admin/fee-records
 */
router.get('/fee-records', protect, adminOnly, adminController.getAllFeeRecords);

/**
 * @route   PUT /api/admin/update-fee/:studentId
 */
router.put('/update-fee/:studentId', protect, adminOnly, adminController.updateFeeStatus);

module.exports = router;