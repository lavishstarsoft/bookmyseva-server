const mongoose = require('mongoose');

const frontendUserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        default: ''
    },
    avatar: {
        type: String,
        default: ''
    },
    // For future Google/Social Auth
    authProvider: {
        type: String,
        default: 'email'
    },
    authProviderId: {
        type: String
    },
    // OTP Local Verification
    otp: {
        type: String,
        select: false // Do not return by default
    },
    otpExpires: {
        type: Date,
        select: false
    },
    status: {
        type: String,
        default: 'Active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'frontend_users' });

module.exports = mongoose.model('FrontendUser', frontendUserSchema);
