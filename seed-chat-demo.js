const mongoose = require('mongoose');
const BotIntent = require('./models/BotIntent');
const QuickAction = require('./models/QuickAction');
const ChatSession = require('./models/ChatSession');
const ChatMessage = require('./models/ChatMessage');
require('dotenv').config();

const MONGO_URI = process.env.DATABASE_URL;

const seedData = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Promise.all([
            BotIntent.deleteMany({}),
            QuickAction.deleteMany({}),
            ChatSession.deleteMany({}),
            ChatMessage.deleteMany({})
        ]);
        console.log('Cleared existing chat data');

        // 1. Create Bot Intents
        const intents = [
            {
                intent: 'Greeting',
                keywords: ['hi', 'hello', 'hey', 'start', 'good morning'],
                response: 'Namaste! Welcome to BookMySeva. How can I assist you in your spiritual journey today?',
                quickReplies: ['Book Seva', 'View Services', 'Contact Support'],
                priority: 10,
                isActive: true
            },
            {
                intent: 'Book Seva',
                keywords: ['book', 'booking', 'reserve', 'schedule', 'puja'],
                response: 'I can help you book a Seva. Which temple or deity are you interested in?',
                quickReplies: ['Tirupati', 'Kashi', 'Rameshwaram'],
                priority: 8,
                isActive: true
            },
            {
                intent: 'Services Info',
                keywords: ['services', 'offerings', 'what do you do', 'types'],
                response: 'We verify and facilitate various Sevas including Pujas, Homas, and Darshans across major temples in India.',
                quickReplies: ['Popular Sevas', 'Upcoming Events'],
                priority: 7,
                isActive: true
            },
            {
                intent: 'Contact Support',
                keywords: ['help', 'support', 'issue', 'problem', 'agent', 'call'],
                response: 'I will connect you with our support team manually. Please hold on.',
                quickReplies: [],
                priority: 9,
                isActive: true
            },
            {
                intent: 'Pricing',
                keywords: ['cost', 'price', 'rates', 'charges', 'fee'],
                response: 'The cost depends on the specific Seva and location. You can view detailed pricing on the service page.',
                quickReplies: ['Check Prices'],
                priority: 6,
                isActive: true
            }
        ];

        const createdIntents = await BotIntent.insertMany(intents);
        console.log(`Created ${createdIntents.length} intents`);

        // 2. Create Quick Actions
        const actions = [
            {
                icon: '🙏',
                title: 'Book Seva',
                subtitle: 'Schedule a Puja',
                type: 'message',
                order: 1,
                isActive: true,
                config: { message: 'I want to book a Seva' }
            },
            {
                icon: 'ℹ️',
                title: 'Services',
                subtitle: 'View our offerings',
                type: 'navigate',
                order: 2,
                isActive: true,
                config: { url: '/services' } // Assuming internal navigation
            },
            {
                icon: '📞',
                title: 'Support',
                subtitle: 'Talk to us',
                type: 'handoff', // Assuming this triggers escalation
                order: 3,
                isActive: true
            },
            {
                icon: '💬',
                title: 'Chat',
                subtitle: 'Message us',
                type: 'message',
                order: 4,
                isActive: true,
                config: { message: 'Hi' }
            }
        ];

        const createdActions = await QuickAction.insertMany(actions);
        console.log(`Created ${createdActions.length} quick actions`);

        // 3. Create Chat Sessions
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000);

        const sessions = [
            // Active Session 1: Returning User
            {
                userId: 'user_123',
                socketId: 'socket_abc123',
                isActive: true,
                lastActivity: now,
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                ipAddress: '192.168.1.1',
                escalated: false
            },
            // Active Session 2: New User, Escalated
            {
                userId: null,
                socketId: 'socket_xyz789',
                isActive: true,
                lastActivity: oneHourAgo,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
                ipAddress: '192.168.1.2',
                escalated: true,
                escalatedAt: oneHourAgo
            },
            // Inactive Session 3
            {
                userId: 'user_456',
                socketId: 'socket_old456',
                isActive: false,
                lastActivity: twoHoursAgo,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                ipAddress: '192.168.1.3',
                escalated: false
            }
        ];

        const createdSessions = await ChatSession.insertMany(sessions);
        console.log(`Created ${createdSessions.length} chat sessions`);

        // 4. Create Chat Messages
        // Assign messages to sessions
        const activeSession = createdSessions[0];
        const escalatedSession = createdSessions[1];
        const inactiveSession = createdSessions[2];

        const messages = [
            // Active Session Messages
            {
                sessionId: activeSession.socketId,
                sender: 'user',
                message: 'Hi',
                isRead: true,
                intent: 'Greeting',
                createdAt: new Date(now.getTime() - 10 * 60 * 1000)
            },
            {
                sessionId: activeSession.socketId,
                sender: 'bot',
                message: 'Namaste! Welcome to BookMySeva. How can I assist you in your spiritual journey today?',
                isRead: true,
                metadata: { intentId: createdIntents.find(i => i.intent === 'Greeting')._id },
                createdAt: new Date(now.getTime() - 10 * 60 * 1000 + 1000)
            },
            {
                sessionId: activeSession.socketId,
                sender: 'user',
                message: 'I want to book a puja',
                isRead: true,
                intent: 'Book Seva',
                createdAt: new Date(now.getTime() - 5 * 60 * 1000)
            },
            {
                sessionId: activeSession.socketId,
                sender: 'bot',
                message: 'I can help you book a Seva. Which temple or deity are you interested in?',
                isRead: true,
                metadata: { intentId: createdIntents.find(i => i.intent === 'Book Seva')._id },
                createdAt: new Date(now.getTime() - 5 * 60 * 1000 + 1000)
            },

            // Escalated Session Messages
            {
                sessionId: escalatedSession.socketId,
                sender: 'user',
                message: 'I have an issue with my payment',
                isRead: true,
                intent: 'Contact Support',
                createdAt: new Date(oneHourAgo.getTime() - 5 * 60 * 1000)
            },
            {
                sessionId: escalatedSession.socketId,
                sender: 'bot',
                message: 'I will connect you with our support team manually. Please hold on.',
                isRead: true,
                metadata: { intentId: createdIntents.find(i => i.intent === 'Contact Support')._id },
                createdAt: new Date(oneHourAgo.getTime() - 5 * 60 * 1000 + 1000)
            },
            {
                sessionId: escalatedSession.socketId,
                sender: 'admin',
                message: 'Hello, I see you are having payment issues. Can you provide the transaction ID?',
                isRead: false,
                createdAt: new Date(oneHourAgo.getTime())
            },

            // Inactive Session Messages
            {
                sessionId: inactiveSession.socketId,
                sender: 'user',
                message: 'What are your prices?',
                isRead: true,
                intent: 'Pricing',
                createdAt: new Date(twoHoursAgo.getTime() - 2 * 60 * 1000)
            },
            {
                sessionId: inactiveSession.socketId,
                sender: 'bot',
                message: 'The cost depends on the specific Seva and location. You can view detailed pricing on the service page.',
                isRead: true,
                metadata: { intentId: createdIntents.find(i => i.intent === 'Pricing')._id },
                createdAt: new Date(twoHoursAgo.getTime() - 2 * 60 * 1000 + 1000)
            }
        ];

        const createdMessages = await ChatMessage.insertMany(messages);
        console.log(`Created ${createdMessages.length} chat messages`);

        console.log('Seed completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};

seedData();
