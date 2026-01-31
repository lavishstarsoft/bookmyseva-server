const express = require('express');
const router = express.Router();
const Enquiry = require('../models/Enquiry');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { catchAsync } = require('../middleware/errorHandler');

// All enquiry routes require admin authentication
router.use(verifyToken, verifyAdmin);

// Get all enquiries
router.get('/', adminLimiter, catchAsync(async (req, res) => {
    const { status, limit = 100, page = 1 } = req.query;
    
    const query = status ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [enquiries, total] = await Promise.all([
        Enquiry.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Enquiry.countDocuments(query)
    ]);
    
    res.json({
        success: true,
        enquiries: enquiries || [],
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit))
        }
    });
}));

// Get single enquiry
router.get('/:id', adminLimiter, catchAsync(async (req, res) => {
    const enquiry = await Enquiry.findById(req.params.id).lean();
    
    if (!enquiry) {
        return res.status(404).json({ 
            success: false, 
            message: 'Enquiry not found' 
        });
    }
    
    res.json({ success: true, enquiry });
}));

// Update enquiry status
router.put('/:id/status', adminLimiter, catchAsync(async (req, res) => {
    const { status, contactNote } = req.body;
    
    const updateData = { status };
    
    if (status === 'Contacted' && contactNote) {
        updateData.contactNote = contactNote;
        updateData.contactedAt = new Date();
    }
    
    const enquiry = await Enquiry.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
    );
    
    if (!enquiry) {
        return res.status(404).json({ 
            success: false, 
            message: 'Enquiry not found' 
        });
    }
    
    res.json({ success: true, enquiry });
}));

// Delete enquiry
router.delete('/:id', adminLimiter, catchAsync(async (req, res) => {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    
    if (!enquiry) {
        return res.status(404).json({ 
            success: false, 
            message: 'Enquiry not found' 
        });
    }
    
    res.json({ success: true, message: 'Enquiry deleted successfully' });
}));

// Create enquiry (public - for frontend form submission)
router.post('/', catchAsync(async (req, res) => {
    const { festivalId, festivalName, userDetails, formData } = req.body;
    
    const enquiry = new Enquiry({
        festivalId,
        festivalName,
        userDetails,
        formData,
        status: 'New'
    });
    
    await enquiry.save();
    
    res.status(201).json({ 
        success: true, 
        message: 'Enquiry submitted successfully',
        enquiry 
    });
}));

module.exports = router;
