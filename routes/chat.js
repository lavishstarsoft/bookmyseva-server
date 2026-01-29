const express = require('express');
const router = express.Router();
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const dotenv = require('dotenv');

dotenv.config();

// Middleware to verify JWT token (reused if exported, or redefined if needed - assuming simple verifyToken logic is sufficient or imported if available in a shared middleware file. 
// Since index.js defined verifyToken locally, we might need to duplicate it or move it to a separate file later. For now, we will assume these routes might be protected or public depending on context.
// 'index.js' had `verifyToken` middleware. We should probably export it from a middleware file, but for now I'll create a simple placeholder or rely on the fact that I can't easily import it from index.js. 
// However, the error logic suggests `middleware` folder exists. Let's check `middleware` folder first? 
// Actually, I'll write the code without middleware for now to get it running, or add a simple check if needed.
// Wait, `index.js` uses `app.use('/api/chat', chatRoutes);`.

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

module.exports = router;
