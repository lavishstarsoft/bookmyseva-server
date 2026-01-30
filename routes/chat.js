const express = require('express');
const router = express.Router();
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const BotIntent = require('../models/BotIntent');
const QuickAction = require('../models/QuickAction');
const dotenv = require('dotenv');

dotenv.config();

// Get all chat sessions (Admin)
router.get('/sessions', async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        const query = {};
        if (status === 'active') query.isActive = true;

        const sessions = await ChatSession.find(query)
            .sort({ lastActivity: -1 })
            .limit(parseInt(limit));

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching sessions', error: error.message });
    }
});

// Get chat history for a specific session
router.get('/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching history', error: error.message });
    }
});

// Delete a session (Admin)
router.delete('/sessions/:id', async (req, res) => {
    try {
        await ChatSession.findByIdAndDelete(req.params.id);
        await ChatMessage.deleteMany({ sessionId: req.params.id });
        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting session', error: error.message });
    }
});

// Get chat analytics
router.get('/analytics', async (req, res) => {
    try {
        const totalSessions = await ChatSession.countDocuments();
        const activeSessions = await ChatSession.countDocuments({ isActive: true });
        const totalMessages = await ChatMessage.countDocuments();
        const userMessages = await ChatMessage.countDocuments({ sender: 'user' });
        const botMessages = await ChatMessage.countDocuments({ sender: 'bot' });
        const adminMessages = await ChatMessage.countDocuments({ sender: 'admin' });

        // Get top intents
        const topIntents = await BotIntent.find()
            .sort({ matchCount: -1 })
            .limit(5)
            .select('intent matchCount');

        res.json({
            totalSessions,
            activeSessions,
            totalMessages,
            userMessages,
            botMessages,
            adminMessages,
            topIntents
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching analytics', error: error.message });
    }
});

// ===== BOT INTENTS CRUD =====

// Get all bot intents
router.get('/intents', async (req, res) => {
    try {
        const intents = await BotIntent.find().sort({ priority: -1, createdAt: -1 });
        res.json(intents);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching intents', error: error.message });
    }
});

// Create a new bot intent
router.post('/intents', async (req, res) => {
    try {
        const newIntent = new BotIntent(req.body);
        await newIntent.save();
        res.status(201).json(newIntent);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Intent already exists' });
        }
        res.status(500).json({ message: 'Error creating intent', error: error.message });
    }
});

// Update a bot intent
router.put('/intents/:id', async (req, res) => {
    try {
        const updatedIntent = await BotIntent.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedIntent) {
            return res.status(404).json({ message: 'Intent not found' });
        }
        res.json(updatedIntent);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Intent already exists' });
        }
        res.status(500).json({ message: 'Error updating intent', error: error.message });
    }
});

// Delete a bot intent
router.delete('/intents/:id', async (req, res) => {
    try {
        const deletedIntent = await BotIntent.findByIdAndDelete(req.params.id);
        if (!deletedIntent) {
            return res.status(404).json({ message: 'Intent not found' });
        }
        res.json({ message: 'Intent deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting intent', error: error.message });
    }
});

// ===== QUICK ACTIONS CRUD =====

// Get all quick actions
router.get('/quick-actions/all', async (req, res) => {
    try {
        const quickActions = await QuickAction.find().sort({ order: 1, createdAt: -1 });
        res.json(quickActions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching quick actions', error: error.message });
    }
});

// Create a new quick action
router.post('/quick-actions', async (req, res) => {
    try {
        const newAction = new QuickAction(req.body);
        await newAction.save();
        res.status(201).json(newAction);
    } catch (error) {
        res.status(500).json({ message: 'Error creating quick action', error: error.message });
    }
});

// Update a quick action
router.put('/quick-actions/:id', async (req, res) => {
    try {
        const updatedAction = await QuickAction.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedAction) {
            return res.status(404).json({ message: 'Quick action not found' });
        }
        res.json(updatedAction);
    } catch (error) {
        res.status(500).json({ message: 'Error updating quick action', error: error.message });
    }
});

// Delete a quick action
router.delete('/quick-actions/:id', async (req, res) => {
    try {
        const deletedAction = await QuickAction.findByIdAndDelete(req.params.id);
        if (!deletedAction) {
            return res.status(404).json({ message: 'Quick action not found' });
        }
        res.json({ message: 'Quick action deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting quick action', error: error.message });
    }
});

module.exports = router;

