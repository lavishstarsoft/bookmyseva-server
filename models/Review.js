    const mongoose = require('mongoose');

    const reviewSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: false
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        featured: {
            type: Boolean,
            default: false
        }
    }, { timestamps: true });

    module.exports = mongoose.model('Review', reviewSchema);
