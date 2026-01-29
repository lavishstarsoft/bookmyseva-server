const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        default: 'superadmin',
        enum: ['superadmin', 'admin', 'user']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    loginHistory: [{
        ip: String,
        browser: String,
        os: String,
        device: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }]
}, { collection: 'admin_users' });

module.exports = mongoose.model('User', userSchema);
