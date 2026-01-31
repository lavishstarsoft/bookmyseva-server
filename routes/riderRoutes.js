const express = require('express');
const router = express.Router();
const riderController = require('../controllers/riderController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { riderValidation, queryValidation } = require('../middleware/validators');
const { adminLimiter } = require('../middleware/rateLimiter');

// All rider routes require authentication
router.use(verifyToken, verifyAdmin);

// Get all riders with pagination
router.get('/', queryValidation.pagination, riderController.getAllRiders);

// Create rider with validation and rate limiting
router.post('/', adminLimiter, riderValidation.create, riderController.createRider);

// Update rider with validation
router.put('/:id', adminLimiter, riderValidation.update, riderController.updateRider);

// Delete rider with rate limiting
router.delete('/:id', adminLimiter, riderController.deleteRider);

module.exports = router;
