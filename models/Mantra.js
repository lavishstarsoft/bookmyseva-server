const mongoose = require('mongoose');

const mantraSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    transliteration: { // Adding transliteration as discussed in plan
        type: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'mantras' });

module.exports = mongoose.model('Mantra', mantraSchema);
