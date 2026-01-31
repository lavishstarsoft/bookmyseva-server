const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UAParser = require('ua-parser-js');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../services/logger');

/**
 * Login Controller
 * @route POST /api/auth/login
 * @access Public
 */
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return next(new AppError('Please provide email and password', 400));
        }

        // Find user by email (case-insensitive)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            logger.logAuth('Login failed - user not found', email, req.ip, false);
            return next(new AppError('Invalid email or password', 401));
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            logger.logAuth('Login failed - wrong password', user._id, req.ip, false);
            return next(new AppError('Invalid email or password', 401));
        }

        // Generate Token with secure settings
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.SECRET_KEY,
            { 
                expiresIn: process.env.JWT_EXPIRES_IN || '1h',
                issuer: 'bookmyseva',
                audience: 'bookmyseva-users'
            }
        );

        // Parse User Agent
        const parser = new UAParser(req.headers['user-agent']);
        const result = parser.getResult();
        const loginInfo = {
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
            browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
            os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
            device: result.device.model || result.device.type || 'Desktop/Laptop',
            timestamp: new Date()
        };

        // Update User History (Keep last 50)
        user.loginHistory.push(loginInfo);
        if (user.loginHistory.length > 50) {
            user.loginHistory.shift();
        }
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        logger.logAuth('Login successful', user._id, req.ip, true);

        // Return user info and token (exclude sensitive fields)
        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar
            }
        });
    } catch (error) {
        logger.logError(error, { context: 'login' });
        next(error);
    }
};

/**
 * Logout Controller (Token blacklist would be here if implemented)
 * @route POST /api/auth/logout
 * @access Private
 */
exports.logout = async (req, res, next) => {
    try {
        // In a full implementation, add token to blacklist here
        // For now, client-side handles token removal
        
        logger.logAuth('Logout', req.user?.id, req.ip, true);
        
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Current User
 * @route GET /api/auth/me
 * @access Private
 */
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password -loginHistory');
        
        if (!user) {
            return next(new AppError('User not found', 404));
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Refresh Token
 * @route POST /api/auth/refresh-token
 * @access Private
 */
exports.refreshToken = async (req, res, next) => {
    try {
        // User already verified by middleware
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return next(new AppError('User not found', 404));
        }

        // Generate new token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.SECRET_KEY,
            { 
                expiresIn: process.env.JWT_EXPIRES_IN || '1h',
                issuer: 'bookmyseva',
                audience: 'bookmyseva-users'
            }
        );

        res.status(200).json({
            success: true,
            token,
            expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Seed Admin - ONLY FOR DEVELOPMENT
 * @route POST /api/auth/seed
 * @access Public (DISABLED IN PRODUCTION)
 */
exports.seedAdmin = async (req, res, next) => {
    try {
        // CRITICAL: Disable in production
        if (process.env.NODE_ENV === 'production') {
            logger.logSecurity('Seed endpoint access attempt in production', {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            return next(new AppError('This endpoint is disabled in production', 403));
        }

        // Check if admin exists
        const existingAdmin = await User.findOne({ email: 'admin@bookmyseva.com' });

        if (existingAdmin) {
            return res.status(200).json({ 
                success: true,
                message: 'Admin already exists',
                user: {
                    id: existingAdmin._id,
                    email: existingAdmin.email,
                    role: existingAdmin.role
                }
            });
        }

        // Create admin with secure password
        const hashedPassword = await bcrypt.hash('Admin@123!Secure', 12);

        const newUser = new User({
            name: 'Super Admin',
            email: 'admin@bookmyseva.com',
            password: hashedPassword,
            role: 'superadmin'
        });

        await newUser.save();
        
        logger.info('Admin user seeded successfully');
        
        res.status(201).json({ 
            success: true,
            message: 'Admin created successfully',
            user: {
                id: newUser._id,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        logger.logError(error, { context: 'seedAdmin' });
        next(error);
    }
};
