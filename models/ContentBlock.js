const mongoose = require('mongoose');

// versatile schema for various content sections
const contentBlockSchema = new mongoose.Schema({
    identifier: {
        type: String,
        required: true,
        unique: true // e.g., 'home-hero-slider', 'daily-sloka-1', 'mantra-marquee'
    },
    type: {
        type: String, // 'slider', 'text', 'image', 'sloka'
        required: true
    },
    title: String,
    content: mongoose.Schema.Types.Mixed,
    // Flexible content: could be an array of image URLs (slider), 
    // or an object with Telugu/English text (sloka)

    isActive: {
        type: Boolean,
        default: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'content_blocks' });

module.exports = mongoose.model('ContentBlock', contentBlockSchema);
