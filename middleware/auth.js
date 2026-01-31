const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../services/logger');

/**
 * Middleware to verify JWT token
 * Attaches user object to request
 */
const verifyToken = async (req, res, next) => {
    try {
        // 1) Get token from header
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new AppError('Access denied. No token provided.', 401));
        }

        // 2) Verify token
        if (!process.env.SECRET_KEY) {
            logger.error('FATAL: SECRET_KEY is not defined in environment');
            return next(new AppError('Server configuration error', 500));
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.SECRET_KEY, {
                issuer: 'bookmyseva',
                audience: 'bookmyseva-users'
            });
        } catch (jwtError) {
            if (jwtError.name === 'TokenExpiredError') {
                return next(new AppError('Your session has expired. Please log in again.', 401));
            }
            if (jwtError.name === 'JsonWebTokenError') {
                logger.logSecurity('Invalid JWT token attempt', {
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });
                return next(new AppError('Invalid token. Please log in again.', 401));
            }
            throw jwtError;
        }

        // 3) Check if user still exists
        const user = await User.findById(decoded.id).select('role isActive passwordChangedAt');
        if (!user) {
            return next(new AppError('User belonging to this token no longer exists.', 401));
        }

        // 4) Check if user is still active
        if (!user.isActive) {
            return next(new AppError('Your account has been deactivated.', 401));
        }

        // 5) Check if user changed password after token was issued
        if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
            return next(new AppError('User recently changed password. Please log in again.', 401));
        }

        // 6) Attach user to request
        req.user = {
            id: decoded.id,
            role: decoded.role
        };
        
        next();
    } catch (error) {
        logger.logError(error, { context: 'verifyToken middleware' });
        return next(new AppError('Authentication failed.', 401));
    }
};

/**
 * Middleware to verify if user is admin
 * Must be used after verifyToken
 */
const verifyAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return next(new AppError('Access denied. User not authenticated.', 401));
        }

        // Check if user has admin role
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            logger.logSecurity('Unauthorized admin access attempt', {
                userId: req.user.id,
                role: req.user.role,
                path: req.originalUrl,
                ip: req.ip
            });
            return next(new AppError('Access denied. Admin privileges required.', 403));
        }

        next();
    } catch (error) {
        logger.logError(error, { context: 'verifyAdmin middleware' });
        return next(new AppError('Authorization failed.', 500));
    }
};

/**
 * Middleware to verify superadmin role
 * Must be used after verifyToken
 */
const verifySuperAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return next(new AppError('Access denied. User not authenticated.', 401));
        }

        if (req.user.role !== 'superadmin') {
            logger.logSecurity('Unauthorized superadmin access attempt', {
                userId: req.user.id,
                role: req.user.role,
                path: req.originalUrl,
                ip: req.ip
            });
            return next(new AppError('Access denied. Super admin privileges required.', 403));
        }

        next();
    } catch (error) {
        logger.logError(error, { context: 'verifySuperAdmin middleware' });
        return next(new AppError('Authorization failed.', 500));
    }
};

/**
 * Restrict access to specific roles
 * Usage: restrictTo('admin', 'superadmin')
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Access denied. User not authenticated.', 401));
        }

        if (!roles.includes(req.user.role)) {
            logger.logSecurity('Unauthorized role access attempt', {
                userId: req.user.id,
                userRole: req.user.role,
                requiredRoles: roles,
                path: req.originalUrl,
                ip: req.ip
            });
            return next(new AppError('You do not have permission to perform this action.', 403));
        }

        next();
    };
};

/**
 * Optional authentication - attaches user if token present, but doesn't fail if not
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY, {
            issuer: 'bookmyseva',
            audience: 'bookmyseva-users'
        });

        const user = await User.findById(decoded.id).select('role isActive');
        if (user && user.isActive) {
            req.user = {
                id: decoded.id,
                role: decoded.role
            };
        }
        
        next();
    } catch (error) {
        // Silent fail for optional auth
        next();
    }
};

module.exports = {
    verifyToken,
    verifyAdmin,
    verifySuperAdmin,
    restrictTo,
    optionalAuth
};
