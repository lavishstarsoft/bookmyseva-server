const mongoose = require('mongoose');

const gitaContentSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['gita', 'kids-gita'],
        required: true
    },
    telugu: {
        type: String,
        required: true // Sloka text for Gita, or Telugu desc for Kids
    },
    // Main Gita Fields
    chapter: { type: Number },
    verse: { type: Number },
    translation: { type: String }, // English
    theme: { type: String },

    // Kids Gita Fields
    title: { type: String },
    simpleTranslation: { type: String },
    emoji: { type: String },
    color: { type: String, default: 'bg-blue-500' }, // Tailwind class

    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'gita_content' });

module.exports = mongoose.model('GitaContent', gitaContentSchema);
