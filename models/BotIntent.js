const mongoose = require('mongoose');

const botIntentSchema = new mongoose.Schema({
    intent: {
        type: String,
        required: true,
        unique: true
    },
    keywords: [{
        type: String,
        required: true
    }],
    response: {
        type: String,
        required: true
    },
    quickReplies: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    priority: {
        type: Number,
        default: 0  // Higher priority intents are checked first
    },
    matchCount: {
        type: Number,
        default: 0  // Track how often this intent is matched
    },
    lastMatched: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes
botIntentSchema.index({ isActive: 1, priority: -1 });
botIntentSchema.index({ keywords: 1 });

module.exports = mongoose.model('BotIntent', botIntentSchema);
