const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    sender: {
        type: String,
        enum: ['user', 'bot', 'admin'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    attachments: [{
        type: String
    }],
    intent: {
        type: String,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
chatMessageSchema.index({ sessionId: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
