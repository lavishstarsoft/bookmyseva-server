const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
    userId: {
        type: String,
        default: null  // null for anonymous users
    },
    guestDetails: {
        name: String,
        phone: String,
        email: String
    },
    guestId: {
        type: String,
        index: true
    },
    socketId: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    context: {
        type: mongoose.Schema.Types.Mixed,
        default: {}  // Stores conversation context
    },
    escalated: {
        type: Boolean,
        default: false
    },
    escalatedAt: {
        type: Date,
        default: null
    },
    whatsappNumber: {
        type: String,
        default: null
    },
    userAgent: {
        type: String
    },
    ipAddress: {
        type: String
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
chatSessionSchema.index({ socketId: 1 });
chatSessionSchema.index({ userId: 1, isActive: 1 });
chatSessionSchema.index({ lastActivity: -1 });

// Auto-expire inactive sessions after 24 hours
chatSessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
