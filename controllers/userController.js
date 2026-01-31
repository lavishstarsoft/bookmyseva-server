const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../services/logger');

/**
 * Get User Profile
 * @route GET /api/user/me
 * @access Private
 */
exports.getProfile = async (req, res, next) => {
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
 * Update User Profile
 * @route PUT /api/user/profile
 * @access Private
 */
exports.updateProfile = async (req, res, next) => {
    try {
        const { name, bio, avatar } = req.body;

        // Find user
        const user = await User.findById(req.user.id);
        if (!user) {
            return next(new AppError('User not found', 404));
        }

        // Update fields if provided (with sanitization)
        if (name) user.name = name.trim().substring(0, 50);
        if (avatar) user.avatar = avatar.trim();
        if (bio !== undefined) user.bio = bio.trim().substring(0, 500);

        await user.save();

        logger.info('Profile updated', { userId: user._id });

        res.status(200).json({ 
            success: true,
            message: 'Profile updated successfully', 
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                bio: user.bio,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Change Password
 * @route PUT /api/user/change-password
 * @access Private
 */
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return next(new AppError('Please provide current and new password', 400));
        }

        // Password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return next(new AppError(
                'Password must be at least 8 characters with uppercase, lowercase, number and special character',
                400
            ));
        }

        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return next(new AppError('User not found', 404));
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            logger.logAuth('Password change failed - wrong current password', user._id, req.ip, false);
            return next(new AppError('Incorrect current password', 400));
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return next(new AppError('New password must be different from current password', 400));
        }

        // Hash new password with stronger salt rounds
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        user.passwordChangedAt = Date.now();
        await user.save();

        logger.logAuth('Password changed successfully', user._id, req.ip, true);

        res.status(200).json({ 
            success: true,
            message: 'Password changed successfully' 
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Login History
 * @route GET /api/user/login-history
 * @access Private
 */
exports.getLoginHistory = async (req, res, next) => {
    try {
        const { limit = 20, page = 1 } = req.query;
        
        const user = await User.findById(req.user.id).select('loginHistory');
        if (!user) {
            return next(new AppError('User not found', 404));
        }

        // Sort by timestamp desc and paginate
        const sortedHistory = user.loginHistory
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const startIndex = (page - 1) * limit;
        const paginatedHistory = sortedHistory.slice(startIndex, startIndex + parseInt(limit));

        res.status(200).json({
            success: true,
            data: paginatedHistory,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: sortedHistory.length,
                pages: Math.ceil(sortedHistory.length / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};
