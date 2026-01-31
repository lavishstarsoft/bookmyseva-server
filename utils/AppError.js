/**
 * Custom Application Error Class
 * Extends native Error with additional properties for operational error handling
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Distinguishes operational errors from programming errors

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
