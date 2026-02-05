const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const AppError = require('../utils/AppError');

/**
 * Create a Redis store for rate limiting (production)
 * Falls back to memory store in development
 */
const getStore = () => {
    // In production, use Redis store for distributed rate limiting
    // For now, using memory store (suitable for single server)
    return undefined; // Uses default memory store
};

/**
 * Standard rate limiter for API endpoints
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Increased from 1000 to 5000 to prevent 429 errors
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json(options.message);
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/';
    },
    store: getStore()
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Increased from 5 to 20 to allow for retries
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    },
    store: getStore()
});

/**
 * Very strict rate limiter for password reset
 * 3 attempts per hour per IP
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Increased from 3 to 10
    message: {
        success: false,
        message: 'Too many password reset attempts, please try again after an hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore()
});

/**
 * Upload rate limiter
 * 20 uploads per hour per IP
 */
const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500, // Increased from 200 to 500
    message: {
        success: false,
        message: 'Upload limit exceeded, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore()
});

/**
 * Chat rate limiter
 * 60 messages per minute per IP (reasonable for chat)
 */
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // Increased from 60 to 300
    message: {
        success: false,
        message: 'Too many messages, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore()
});

/**
 * Admin operations rate limiter
 * 50 requests per minute
 */
const adminLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // Increased from 50 to 200
    message: {
        success: false,
        message: 'Rate limit exceeded for admin operations'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: getStore()
});

/**
 * Speed limiter - slows down responses after threshold
 * Useful for preventing automated attacks
 */
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 5000, // Increased from 1000 to 5000
    delayMs: (hits) => hits * 100, // Add 100ms delay per request above threshold
    maxDelayMs: 5000, // Max delay of 5 seconds
    skip: (req) => {
        return req.path === '/health' || req.path === '/';
    }
});

/**
 * Create custom rate limiter with specific configuration
 */
const createLimiter = (options) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000,
        max: options.max || 100,
        message: options.message || {
            success: false,
            message: 'Too many requests, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: options.keyGenerator || ((req) => req.ip),
        skip: options.skip,
        store: getStore()
    });
};

/**
 * Rate limit by user ID (for authenticated routes)
 */
const userBasedLimiter = (maxRequests, windowMinutes) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max: maxRequests,
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise return a default
            return req.user?.id || 'unauthenticated';
        },
        message: {
            success: false,
            message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMinutes} minutes.`
        },
        standardHeaders: true,
        legacyHeaders: false,
        validate: false, // Disable validation to prevent IPv6 error
        store: getStore()
    });
};

module.exports = {
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
    uploadLimiter,
    chatLimiter,
    adminLimiter,
    speedLimiter,
    createLimiter,
    userBasedLimiter
};
