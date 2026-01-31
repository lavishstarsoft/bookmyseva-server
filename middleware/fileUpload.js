const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');

/**
 * Allowed MIME types for images
 */
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
];

/**
 * Allowed MIME types for documents
 */
const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
];

/**
 * Allowed MIME types for all files
 */
const ALLOWED_FILE_TYPES = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_DOCUMENT_TYPES,
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'video/mp4',
    'video/webm'
];

/**
 * File size limits
 */
const FILE_SIZE_LIMITS = {
    image: 5 * 1024 * 1024,      // 5MB for images
    document: 10 * 1024 * 1024,   // 10MB for documents
    video: 50 * 1024 * 1024,      // 50MB for videos
    audio: 20 * 1024 * 1024,      // 20MB for audio
    default: 10 * 1024 * 1024     // 10MB default
};

/**
 * Get file size limit based on MIME type
 */
const getFileSizeLimit = (mimetype) => {
    if (ALLOWED_IMAGE_TYPES.includes(mimetype)) {
        return FILE_SIZE_LIMITS.image;
    }
    if (mimetype.startsWith('video/')) {
        return FILE_SIZE_LIMITS.video;
    }
    if (mimetype.startsWith('audio/')) {
        return FILE_SIZE_LIMITS.audio;
    }
    return FILE_SIZE_LIMITS.default;
};

/**
 * Sanitize filename to prevent directory traversal attacks
 */
const sanitizeFilename = (filename) => {
    // Remove directory paths
    const basename = path.basename(filename);
    // Remove special characters except dots, hyphens, and underscores
    return basename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Multer storage configuration (memory storage for R2 upload)
 */
const storage = multer.memoryStorage();

/**
 * Image file filter
 */
const imageFileFilter = (req, file, cb) => {
    // Check MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        return cb(new AppError('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.', 400), false);
    }

    // Check file extension matches MIME type
    const ext = path.extname(file.originalname).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!validExtensions.includes(ext)) {
        return cb(new AppError('Invalid file extension.', 400), false);
    }

    // Sanitize filename
    file.originalname = sanitizeFilename(file.originalname);
    cb(null, true);
};

/**
 * General file filter
 */
const generalFileFilter = (req, file, cb) => {
    // Check MIME type
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
        return cb(new AppError(`Invalid file type: ${file.mimetype}. Please upload a supported file format.`, 400), false);
    }

    // Sanitize filename
    file.originalname = sanitizeFilename(file.originalname);
    cb(null, true);
};

/**
 * Create multer upload middleware for images
 */
const uploadImage = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.image,
        files: 1 // Single file upload
    },
    fileFilter: imageFileFilter
});

/**
 * Create multer upload middleware for multiple images
 */
const uploadImages = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.image,
        files: 10 // Maximum 10 files
    },
    fileFilter: imageFileFilter
});

/**
 * Create multer upload middleware for general files
 */
const uploadFile = multer({
    storage: storage,
    limits: {
        fileSize: FILE_SIZE_LIMITS.default,
        files: 1
    },
    fileFilter: generalFileFilter
});

/**
 * Middleware to validate uploaded file
 */
const validateUpload = (req, res, next) => {
    if (!req.file) {
        return next(new AppError('No file uploaded', 400));
    }

    // Additional security: Check file signature (magic bytes)
    const fileSignatures = {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'image/gif': [0x47, 0x49, 0x46],
        'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
        'application/pdf': [0x25, 0x50, 0x44, 0x46] // %PDF
    };

    const signature = fileSignatures[req.file.mimetype];
    if (signature) {
        const fileBuffer = req.file.buffer;
        const isValid = signature.every((byte, index) => fileBuffer[index] === byte);
        
        if (!isValid) {
            return next(new AppError('File content does not match its extension. Possible malicious file.', 400));
        }
    }

    next();
};

/**
 * Handle multer errors
 */
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError('File too large. Please upload a smaller file.', 400));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return next(new AppError('Too many files. Please upload fewer files.', 400));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError('Unexpected field name in upload.', 400));
        }
        return next(new AppError(`Upload error: ${err.message}`, 400));
    }
    next(err);
};

module.exports = {
    uploadImage,
    uploadImages,
    uploadFile,
    validateUpload,
    handleMulterError,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_FILE_TYPES,
    FILE_SIZE_LIMITS,
    sanitizeFilename
};
