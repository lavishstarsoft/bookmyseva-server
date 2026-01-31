const express = require('express');
const router = express.Router();
const GitaContent = require('../models/GitaContent');
const Mantra = require('../models/Mantra');
const Panchangam = require('../models/Panchangam');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { catchAsync } = require('../middleware/errorHandler');

// =============================================
// GITA CONTENT ROUTES
// =============================================

// Get Gita content (Public - filtered by type)
router.get('/gita-sloka', catchAsync(async (req, res) => {
    const { type = 'gita' } = req.query;
    const content = await GitaContent.find({ type })
        .sort({ chapter: 1, verse: 1, createdAt: -1 })
        .lean();
    res.json(content || []);
}));

// Get all Gita content (Admin)
router.get('/gita', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const { type } = req.query;
    const query = type ? { type } : {};
    const content = await GitaContent.find(query)
        .sort({ chapter: 1, verse: 1, createdAt: -1 })
        .lean();
    res.json(content || []);
}));

// Create Gita content (Admin)
router.post('/gita', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const newContent = new GitaContent(req.body);
    await newContent.save();
    res.status(201).json(newContent);
}));

// Update Gita content (Admin)
router.put('/gita/:id', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const updated = await GitaContent.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
    );
    if (!updated) {
        return res.status(404).json({ message: 'Gita content not found' });
    }
    res.json(updated);
}));

// Delete Gita content (Admin)
router.delete('/gita/:id', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const deleted = await GitaContent.findByIdAndDelete(req.params.id);
    if (!deleted) {
        return res.status(404).json({ message: 'Gita content not found' });
    }
    res.json({ message: 'Gita content deleted successfully' });
}));

// =============================================
// MANTRA ROUTES
// =============================================

// Get daily mantra (Public)
router.get('/daily-mantra', catchAsync(async (req, res) => {
    const mantra = await Mantra.findOne({ isActive: true })
        .sort({ order: 1 })
        .lean();
    res.json(mantra || { message: 'No active mantra found' });
}));

// Get all mantras (Admin)
router.get('/mantras', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const mantras = await Mantra.find()
        .sort({ order: 1, createdAt: -1 })
        .lean();
    res.json(mantras || []);
}));

// Create mantra (Admin)
router.post('/mantras', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const newMantra = new Mantra(req.body);
    await newMantra.save();
    res.status(201).json(newMantra);
}));

// Update mantra (Admin)
router.put('/mantras/:id', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const updated = await Mantra.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
    );
    if (!updated) {
        return res.status(404).json({ message: 'Mantra not found' });
    }
    res.json(updated);
}));

// Delete mantra (Admin)
router.delete('/mantras/:id', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const deleted = await Mantra.findByIdAndDelete(req.params.id);
    if (!deleted) {
        return res.status(404).json({ message: 'Mantra not found' });
    }
    res.json({ message: 'Mantra deleted successfully' });
}));

// =============================================
// PANCHANGAM ROUTES
// =============================================

// Get Panchangam by date (Public)
router.get('/panchangam', catchAsync(async (req, res) => {
    const { date } = req.query;
    
    // Parse date - if not provided, use today
    const targetDate = date ? new Date(date) : new Date();
    
    // Set to start of day for comparison
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const panchangam = await Panchangam.findOne({
        date: { $gte: startOfDay, $lte: endOfDay }
    }).lean();
    
    res.json(panchangam || { message: 'No panchangam data for this date' });
}));

// Get all Panchangam entries (Admin)
router.get('/panchangam/all', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const { startDate, endDate, limit = 30 } = req.query;
    const query = {};
    
    if (startDate && endDate) {
        query.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }
    
    const panchangams = await Panchangam.find(query)
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .lean();
    
    res.json(panchangams || []);
}));

// Create or Update Panchangam (Admin) - Upsert by date
router.post('/panchangam', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const { date, ...data } = req.body;
    
    // Set to start of day for consistent storage
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const panchangam = await Panchangam.findOneAndUpdate(
        { date: targetDate },
        { ...data, date: targetDate, updatedAt: Date.now() },
        { new: true, upsert: true }
    );
    
    res.json(panchangam);
}));

// Delete Panchangam entry (Admin)
router.delete('/panchangam/:id', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const deleted = await Panchangam.findByIdAndDelete(req.params.id);
    if (!deleted) {
        return res.status(404).json({ message: 'Panchangam entry not found' });
    }
    res.json({ message: 'Panchangam entry deleted successfully' });
}));

module.exports = router;
