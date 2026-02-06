const express = require('express');
const router = express.Router();
const customerAuthController = require('../controllers/customerAuthController');
const { apiLimiter } = require('../middleware/rateLimiter');

console.log('[DEBUG_LOAD] customerAuthRoutes loaded');

// Rate limit OTP requests strictly
router.post('/send-otp', customerAuthController.sendOtp);
router.post('/verify-otp', apiLimiter, customerAuthController.verifyOtp);

module.exports = router;
