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

// Create a review
router.post('/', async (req, res) => {
    try {
        const { name, email, rating, comment, city } = req.body;
        const newReview = new Review({
            name,
            email,
            rating,
            comment,
            city,
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
