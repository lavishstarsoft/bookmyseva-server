const mongoose = require('mongoose');

const quickActionSchema = new mongoose.Schema({
    icon: {
        type: String,
        required: true,
        default: '💬'
    },
    title: {
        type: String,
        required: true
    },
    subtitle: {
        type: String,
        default: ''
    },
    order: {
        type: Number,
        required: true,
        default: 0
    },
    type: {
        type: String,
        enum: ['message', 'flow', 'navigate', 'external', 'input', 'handoff'],
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    config: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    showWhen: {
        type: String,
        enum: ['always', 'business_hours', 'after_hours'],
        default: 'always'
    },
    clickCount: {
        type: Number,
        default: 0
    },
    lastUsed: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for sorting
quickActionSchema.index({ order: 1, isActive: 1 });

module.exports = mongoose.model('QuickAction', quickActionSchema);
