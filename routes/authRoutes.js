const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { authValidation } = require('../middleware/validators');

// Public routes with rate limiting
router.post('/login', authLimiter, authValidation.login, authController.login);
router.post('/logout', verifyToken, authController.logout);

// Protected routes
router.get('/me', verifyToken, authController.getMe);
router.post('/refresh-token', verifyToken, authController.refreshToken);

// Development only route
if (process.env.NODE_ENV !== 'production') {
    router.post('/seed', authController.seedAdmin);
}

module.exports = router;
