const express = require('express');
const router = express.Router();
const { verifyByCode } = require('../Controllers/publicController');

router.get('/verify/:code', verifyByCode);

module.exports = router;
