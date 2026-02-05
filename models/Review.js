const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false
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
    service: {
        type: String,
        required: false // Optional, e.g., "Griha Pravesh Pooja"
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

const Review = mongoose.model('Review', reviewSchema);

// Indexes for performance optimization
// 1. Sorting by date (Default view)
reviewSchema.index({ createdAt: -1 });
// 2. Filtering by status (Pending/Approved tabs)
reviewSchema.index({ status: 1 });
// 3. Filtering by featured (Testimonial queries)
reviewSchema.index({ featured: 1 });
// 4. Combined index for admin dashboard filters (Status + Search/Sort)
reviewSchema.index({ status: 1, createdAt: -1 });

module.exports = Review;
