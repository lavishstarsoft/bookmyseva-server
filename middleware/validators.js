const { body, param, query, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Process validation results and return errors
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
            field: err.path,
            message: err.msg
        }));
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: errorMessages
        });
    }
    next();
};

/**
 * Sanitize and validate MongoDB ObjectId
 */
const validateObjectId = (paramName = 'id') => [
    param(paramName)
        .trim()
        .isMongoId()
        .withMessage(`Invalid ${paramName} format`),
    validate
];

/**
 * Auth Validation Rules
 */
const authValidation = {
    login: [
        body('email')
            .trim()
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('password')
            .notEmpty()
            .withMessage('Password is required'),
        validate
    ],
    register: [
        body('name')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters')
            .escape(),
        body('email')
            .trim()
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('Password must contain uppercase, lowercase, number and special character'),
        validate
    ],
    changePassword: [
        body('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('New password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('Password must contain uppercase, lowercase, number and special character'),
        validate
    ]
};

/**
 * User Validation Rules
 */
const userValidation = {
    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters')
            .escape(),
        body('bio')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Bio cannot exceed 500 characters'),
        body('avatar')
            .optional()
            .trim()
            .isURL()
            .withMessage('Avatar must be a valid URL'),
        validate
    ]
};

/**
 * Blog Validation Rules
 */
const blogValidation = {
    create: [
        body('title')
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage('Title must be between 5 and 200 characters'),
        body('content')
            .notEmpty()
            .withMessage('Content is required'),
        body('slug')
            .optional()
            .trim()
            .matches(/^[a-z0-9-]+$/)
            .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
        body('category')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Category cannot exceed 50 characters'),
        body('tags')
            .optional()
            .isArray({ max: 10 })
            .withMessage('Maximum 10 tags allowed'),
        body('status')
            .optional()
            .isIn(['draft', 'published', 'archived'])
            .withMessage('Invalid status'),
        validate
    ],
    update: [
        param('id').isMongoId().withMessage('Invalid blog ID'),
        body('title')
            .optional()
            .trim()
            .isLength({ min: 5, max: 200 })
            .withMessage('Title must be between 5 and 200 characters'),
        body('slug')
            .optional()
            .trim()
            .matches(/^[a-z0-9-]+$/)
            .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
        validate
    ]
};

/**
 * Category Validation Rules
 */
const categoryValidation = {
    create: [
        body('name')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Category name must be between 2 and 50 characters'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage('Description cannot exceed 200 characters'),
        validate
    ],
    update: [
        param('id').isMongoId().withMessage('Invalid category ID'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Category name must be between 2 and 50 characters'),
        validate
    ]
};

/**
 * Product Validation Rules
 */
const productValidation = {
    create: [
        body('name')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Product name must be between 2 and 100 characters'),
        body('price')
            .isFloat({ min: 0 })
            .withMessage('Price must be a positive number'),
        body('category')
            .trim()
            .notEmpty()
            .withMessage('Category is required'),
        body('salePrice')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Sale price must be a positive number'),
        body('stockCount')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Stock count must be a non-negative integer'),
        validate
    ]
};

/**
 * Chat Validation Rules
 */
const chatValidation = {
    intent: [
        body('intent')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Intent name must be between 2 and 50 characters'),
        body('keywords')
            .isArray({ min: 1, max: 20 })
            .withMessage('Keywords must be an array with 1-20 items'),
        body('response')
            .trim()
            .isLength({ min: 5, max: 1000 })
            .withMessage('Response must be between 5 and 1000 characters'),
        body('priority')
            .optional()
            .isInt({ min: 0, max: 100 })
            .withMessage('Priority must be between 0 and 100'),
        validate
    ],
    quickAction: [
        body('label')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Label must be between 2 and 50 characters'),
        body('action')
            .trim()
            .notEmpty()
            .withMessage('Action is required'),
        validate
    ]
};

/**
 * Rider Validation Rules
 */
const riderValidation = {
    create: [
        body('name')
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        body('phone')
            .trim()
            .matches(/^[+]?[0-9]{10,15}$/)
            .withMessage('Please provide a valid phone number'),
        body('location')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Location cannot exceed 100 characters'),
        body('vehicleType')
            .optional()
            .trim()
            .isLength({ max: 50 })
            .withMessage('Vehicle type cannot exceed 50 characters'),
        validate
    ],
    update: [
        param('id').isMongoId().withMessage('Invalid rider ID'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 50 })
            .withMessage('Name must be between 2 and 50 characters'),
        body('phone')
            .optional()
            .trim()
            .matches(/^[+]?[0-9]{10,15}$/)
            .withMessage('Please provide a valid phone number'),
        body('status')
            .optional()
            .isIn(['Active', 'Inactive', 'Suspended'])
            .withMessage('Invalid status'),
        validate
    ]
};

/**
 * Query Parameter Validation
 */
const queryValidation = {
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        validate
    ],
    search: [
        query('q')
            .optional()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Search query cannot exceed 100 characters')
            .escape(),
        validate
    ]
};

/**
 * Sanitize user input - removes any potential XSS
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
};

module.exports = {
    validate,
    validateObjectId,
    authValidation,
    userValidation,
    blogValidation,
    categoryValidation,
    productValidation,
    chatValidation,
    riderValidation,
    queryValidation,
    sanitizeInput
};
