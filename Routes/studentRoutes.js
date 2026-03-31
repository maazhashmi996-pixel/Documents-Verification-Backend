const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/cloudinaryConfig');
const {
    uploadDocument,
    getStudentDashboard,
    makePayment,
    deleteDocument
} = require('../Controllers/studentController');

router.get('/dashboard', auth, getStudentDashboard);
router.put('/pay', auth, makePayment);
router.post('/upload', auth, upload.single('file'), uploadDocument);
router.delete('/document/:docId', auth, deleteDocument);

module.exports = router;