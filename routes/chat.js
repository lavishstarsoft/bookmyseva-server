const express = require('express');
const router = express.Router();
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const BotIntent = require('../models/BotIntent');
const QuickAction = require('../models/QuickAction');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { chatValidation } = require('../middleware/validators');
const { chatLimiter, adminLimiter } = require('../middleware/rateLimiter');
const { catchAsync } = require('../middleware/errorHandler');
const AppError = require('../utils/AppError');

// ===== PUBLIC ROUTES (for chat widget) =====

// Get active quick actions (public - for chat widget)
router.get('/quick-actions', chatLimiter, catchAsync(async (req, res) => {
    const quickActions = await QuickAction.find({ isActive: true })
        .sort({ order: 1 })
        .select('label action icon')
        .lean();
    res.json(quickActions);
}));

// ===== ADMIN ROUTES =====

// Get all chat sessions (Admin)
router.get('/sessions', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const { status, limit = 50, page = 1 } = req.query;
    const query = {};
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [sessions, total] = await Promise.all([
        ChatSession.find(query)
            .sort({ lastActivity: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        ChatSession.countDocuments(query)
    ]);

    res.json({
        success: true,
        data: sessions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
}));

// Get chat history for a specific session (Admin)
router.get('/history/:sessionId', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const { sessionId } = req.params;
    
    // Validate sessionId format
    if (!sessionId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new AppError('Invalid session ID format', 400);
    }

    const messages = await ChatMessage.find({ sessionId })
        .sort({ createdAt: 1 })
        .lean();
    
    res.json({ success: true, data: messages });
}));

// Delete a session (Admin)
router.delete('/sessions/:id', verifyToken, verifyAdmin, adminLimiter, catchAsync(async (req, res) => {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new AppError('Invalid session ID format', 400);
    }

    const session = await ChatSession.findByIdAndDelete(id);
    if (!session) {
        throw new AppError('Session not found', 404);
    }
    
    await ChatMessage.deleteMany({ sessionId: id });
    
    res.json({ success: true, message: 'Session deleted successfully' });
}));

// Get chat analytics (Admin)
router.get('/analytics', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const [
        totalSessions,
        activeSessions,
        totalMessages,
        userMessages,
        botMessages,
        adminMessages,
        topIntents
    ] = await Promise.all([
        ChatSession.countDocuments(),
        ChatSession.countDocuments({ isActive: true }),
        ChatMessage.countDocuments(),
        ChatMessage.countDocuments({ sender: 'user' }),
        ChatMessage.countDocuments({ sender: 'bot' }),
        ChatMessage.countDocuments({ sender: 'admin' }),
        BotIntent.find()
            .sort({ matchCount: -1 })
            .limit(5)
            .select('intent matchCount')
            .lean()
    ]);

    res.json({
        success: true,
        data: {
            totalSessions,
            activeSessions,
            totalMessages,
            userMessages,
            botMessages,
            adminMessages,
            topIntents
        }
    });
}));

// ===== BOT INTENTS CRUD (Admin Only) =====

// Get all bot intents
router.get('/intents', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const intents = await BotIntent.find()
        .sort({ priority: -1, createdAt: -1 })
        .lean();
    res.json({ success: true, data: intents });
}));

// Create a new bot intent
router.post('/intents', verifyToken, verifyAdmin, chatValidation.intent, catchAsync(async (req, res) => {
    const { intent, keywords, response, quickReplies, priority, isActive } = req.body;
    
    const newIntent = new BotIntent({
        intent,
        keywords,
        response,
        quickReplies: quickReplies || [],
        priority: priority || 0,
        isActive: isActive !== false
    });
    
    await newIntent.save();
    res.status(201).json({ success: true, data: newIntent });
}));

// Update a bot intent
router.put('/intents/:id', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new AppError('Invalid intent ID format', 400);
    }

    const updatedIntent = await BotIntent.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
    );
    
    if (!updatedIntent) {
        throw new AppError('Intent not found', 404);
    }
    
    res.json({ success: true, data: updatedIntent });
}));

// Delete a bot intent
router.delete('/intents/:id', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new AppError('Invalid intent ID format', 400);
    }

    const deletedIntent = await BotIntent.findByIdAndDelete(id);
    if (!deletedIntent) {
        throw new AppError('Intent not found', 404);
    }
    
    res.json({ success: true, message: 'Intent deleted successfully' });
}));

// ===== QUICK ACTIONS CRUD (Admin Only) =====

// Get all quick actions (Admin - full details)
router.get('/quick-actions/all', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const quickActions = await QuickAction.find()
        .sort({ order: 1, createdAt: -1 })
        .lean();
    res.json({ success: true, data: quickActions });
}));

// Create a new quick action
router.post('/quick-actions', verifyToken, verifyAdmin, chatValidation.quickAction, catchAsync(async (req, res) => {
    const newAction = new QuickAction(req.body);
    await newAction.save();
    res.status(201).json({ success: true, data: newAction });
}));

// Update a quick action
router.put('/quick-actions/:id', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new AppError('Invalid quick action ID format', 400);
    }

    const updatedAction = await QuickAction.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
    );
    
    if (!updatedAction) {
        throw new AppError('Quick action not found', 404);
    }
    
    res.json({ success: true, data: updatedAction });
}));

// Delete a quick action
router.delete('/quick-actions/:id', verifyToken, verifyAdmin, catchAsync(async (req, res) => {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new AppError('Invalid quick action ID format', 400);
    }

    const deletedAction = await QuickAction.findByIdAndDelete(id);
    if (!deletedAction) {
        throw new AppError('Quick action not found', 404);
    }
    
    res.json({ success: true, message: 'Quick action deleted successfully' });
}));

module.exports = router;

