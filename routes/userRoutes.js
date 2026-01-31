const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');
const { userValidation, authValidation, queryValidation } = require('../middleware/validators');
const { userBasedLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(verifyToken);

// Profile routes
router.get('/me', userController.getProfile);
router.put('/profile', userValidation.updateProfile, userController.updateProfile);

// Password change with rate limiting (5 attempts per 15 minutes)
router.put('/change-password', 
    userBasedLimiter(5, 15), 
    authValidation.changePassword, 
    userController.changePassword
);

// Login history with pagination
router.get('/login-history', queryValidation.pagination, userController.getLoginHistory);

module.exports = router;
