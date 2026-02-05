const express = require('express');
const router = express.Router();
const Review = require('../models/Review');

// Get all reviews (Admin: all, Public: approved) 
// Simplification: query param ?status=approved for public
router.get('/', async (req, res) => {
    try {
        const { status, limit = 50, featured } = req.query;
        const query = {};

        if (status) query.status = status;
        if (featured === 'true') query.featured = true;

        const reviews = await Review.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error: error.message });
    }
});

// Get all reviews for admin (alias route)
// Get all reviews for admin (alias route) with pagination and filtering
router.get('/all', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;
        const query = {};

        if (status && status !== 'all') {
            if (status === 'featured') {
                query.featured = true;
            } else {
                query.status = status;
            }
        }

        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            query.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { comment: searchRegex },
                { service: searchRegex },
                { city: searchRegex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [reviews, total, pendingCount, featuredCount, approvedCount, avgStats] = await Promise.all([
            Review.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Review.countDocuments(query),
            Review.countDocuments({ status: 'pending' }),
            Review.countDocuments({ featured: true }),
            Review.countDocuments({ status: 'approved' }),
            Review.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" } } }])
        ]);

        res.json({
            reviews,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit))
            },
            stats: {
                total: await Review.countDocuments(), // Total reviews count
                pending: pendingCount,
                featured: featuredCount,
                approved: approvedCount,
                averageRating: avgStats[0]?.avg ? parseFloat(avgStats[0].avg.toFixed(1)) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error: error.message });
    }
});

// Create a review
router.post('/', async (req, res) => {
    try {
        const { name, email, rating, comment, city, service } = req.body;
        const newReview = new Review({
            name,
            email,
            rating,
            comment,
            city,
            service, // Added service field
            status: 'pending' // Default to pending
        });
        await newReview.save();
        res.status(201).json({ message: 'Review submitted successfully', review: newReview });
    } catch (error) {
        res.status(500).json({ message: 'Error creating review', error: error.message });
    }
});

// Update review status (Admin)
router.put('/:id', async (req, res) => {
    try {
        const { status, featured } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (featured !== undefined) updateData.featured = featured;

        const updatedReview = await Review.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        res.json(updatedReview);
    } catch (error) {
        res.status(500).json({ message: 'Error updating review', error: error.message });
    }
});

// PATCH route for specific feature toggles (used by Superadmin)
router.patch('/:id/feature', async (req, res) => {
    try {
        const { approved, featured } = req.body;
        const updateData = {};

        if (approved !== undefined) {
            updateData.status = approved ? 'approved' : 'pending';
        }
        if (featured !== undefined) {
            updateData.featured = featured;
        }

        const updatedReview = await Review.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!updatedReview) {
            return res.status(404).json({ message: 'Review not found' });
        }

        res.json(updatedReview);
    } catch (error) {
        res.status(500).json({ message: 'Error updating review feature', error: error.message });
    }
});

// Delete a review
router.delete('/:id', async (req, res) => {
    try {
        await Review.findByIdAndDelete(req.params.id);
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting review', error: error.message });
    }
});

module.exports = router;
