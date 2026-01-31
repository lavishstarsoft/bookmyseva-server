const logger = require('../services/logger');
const AppError = require('../utils/AppError');

/**
 * Handle CastError from MongoDB (invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
};

/**
 * Handle Duplicate Field Error from MongoDB
 */
const handleDuplicateFieldsDB = (err) => {
    const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || 'unknown';
    const message = `Duplicate field value: ${value}. Please use another value.`;
    return new AppError(message, 400);
};

/**
 * Handle Validation Error from MongoDB/Mongoose
 */
const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

/**
 * Handle JWT Error
 */
const handleJWTError = () => {
    return new AppError('Invalid token. Please log in again.', 401);
};

/**
 * Handle JWT Expired Error
 */
const handleJWTExpiredError = () => {
    return new AppError('Your token has expired. Please log in again.', 401);
};

/**
 * Send Error Response in Development
 */
const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        success: false,
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

/**
 * Send Error Response in Production
 */
const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message
        });
    } else {
        // Programming or other unknown error: don't leak error details
        // 1) Log error
        logger.error('UNEXPECTED ERROR 💥', {
            error: err,
            stack: err.stack
        });

        // 2) Send generic message
        res.status(500).json({
            success: false,
            status: 'error',
            message: 'Something went wrong! Please try again later.'
        });
    }
};

/**
 * Global Error Handling Middleware
 */
const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log all errors
    logger.error(`${err.statusCode} - ${err.message}`, {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userId: req.user?.id,
        stack: err.stack
    });

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        // Handle specific error types
        if (err.name === 'CastError') error = handleCastErrorDB(error);
        if (err.code === 11000) error = handleDuplicateFieldsDB(error);
        if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
        if (err.name === 'JsonWebTokenError') error = handleJWTError();
        if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

        sendErrorProd(error, res);
    }
};

/**
 * Catch Async Errors Wrapper
 * Wraps async functions to catch errors and pass to global error handler
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

/**
 * Handle 404 Not Found
 */
const notFound = (req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
};

module.exports = {
    globalErrorHandler,
    catchAsync,
    notFound,
    AppError
};
