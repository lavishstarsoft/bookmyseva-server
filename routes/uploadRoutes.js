const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { verifyToken } = require('../middleware/auth');
const { uploadImage, uploadFile, validateUpload, handleMulterError } = require('../middleware/fileUpload');
const { uploadLimiter } = require('../middleware/rateLimiter');

// All upload routes require authentication and rate limiting
router.use(verifyToken);
router.use(uploadLimiter);

// Image upload with validation
router.post('/upload',
    uploadImage.single('image'),
    handleMulterError,
    validateUpload,
    uploadController.uploadImage
);

// General file upload with validation
router.post('/upload-file',
    uploadFile.single('file'),
    handleMulterError,
    validateUpload,
    uploadController.uploadFile
);

module.exports = router;
