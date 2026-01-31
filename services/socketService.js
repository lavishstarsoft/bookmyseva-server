const { Server } = require('socket.io');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const BotIntent = require('../models/BotIntent');

exports.initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);
                callback(null, true);
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log('User Connected:', socket.id);

        // Join Session
        socket.on('join_session', async (data) => {
            try {
                let userId = null;
                let guestDetails = null;
                let guestId = null;

                if (typeof data === 'object' && data !== null) {
                    userId = data.userId;
                    guestDetails = data.guestDetails;
                    guestId = data.guestId;
                } else {
                    userId = data; // Backward compatibility
                }

                // Store context on socket
                socket.guestId = guestId;
                socket.userId = userId;
                socket.guestDetails = guestDetails;

                // Determine search query
                let query = null;
                if (userId) query = { userId };
                else if (guestId) query = { guestId };
                else query = { socketId: socket.id }; // Fallback

                // Find session
                let session = await ChatSession.findOne(query);

                if (session) {
                    session.socketId = socket.id;
                    session.isActive = true;
                    if (guestDetails) {
                        session.guestDetails = { ...session.guestDetails, ...guestDetails };
                    }
                    await session.save();

                    // Establish Room - join both guestId room AND session._id room
                    const roomName = session.guestId || session.userId || session._id.toString();
                    socket.join(roomName);
                    socket.join(session._id.toString()); // Also join by MongoDB _id for admin replies
                    console.log('Existing session resumed:', session._id);

                    // Fetch old messages and send to client
                    const oldMessages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });

                    // Send session info and old messages to client
                    socket.emit('session_joined', {
                        sessionId: session._id.toString(),
                        messages: oldMessages
                    });
                } else {
                    // New User: Don't create DB record yet (Lazy Creation)
                    // Just join a temporary room based on guestId
                    if (guestId) {
                        socket.join(guestId);
                        console.log('Guest connected (waiting for message):', guestId);
                    }
                    // Send empty session info
                    socket.emit('session_joined', { sessionId: null, messages: [] });
                }

            } catch (error) {
                console.error('Join Session Error:', error);
            }
        });

        // End Chat Session
        socket.on('end_chat', async (data) => {
            try {
                const { guestId } = data;

                if (guestId) {
                    // Mark session as ended but NOT deleted
                    const session = await ChatSession.findOneAndUpdate(
                        { guestId: guestId },
                        {
                            isActive: false,
                            endedAt: new Date(),
                            endedByUser: true
                        },
                        { new: true }
                    );

                    if (session) {
                        console.log('Chat session ended by user:', session._id);
                        socket.emit('chat_ended', { success: true });

                        // Notify admin that user ended the chat
                        io.emit('user_ended_chat', {
                            sessionId: session._id,
                            guestDetails: session.guestDetails
                        });
                    }
                }
            } catch (error) {
                console.error('End Chat Error:', error);
            }
        });

        // Handle incoming messages
        socket.on('send_message', async (data) => {
            try {
                const { message, userId, guestId } = data;

                // 1. Find or Create Session
                let query = null;
                if (userId) query = { userId };
                else if (guestId) query = { guestId };
                else query = { socketId: socket.id };

                let session = await ChatSession.findOne(query);

                // Lazy Create if first message
                if (!session) {
                    session = new ChatSession({
                        userId: userId || null,
                        guestId: guestId || socket.guestId,
                        guestDetails: socket.guestDetails || {},
                        socketId: socket.id,
                        isActive: true,
                        ipAddress: socket.handshake.address,
                        userAgent: socket.handshake.headers['user-agent']
                    });
                    await session.save();
                    console.log('New session created on first message:', session._id);

                    // Join the room
                    const roomName = session.guestId || session.userId || session._id.toString();
                    socket.join(roomName);
                    socket.join(session._id.toString());
                }

                // 2. Save User Message
                const userMsg = new ChatMessage({
                    sessionId: session._id,
                    sender: 'user',
                    message: message,
                    isRead: false
                });
                await userMsg.save();

                // Update session last activity
                session.lastActivity = Date.now();
                session.isActive = true;
                await session.save();

                // Emit to user (echo back)
                socket.emit('message', userMsg);

                // Emit to admin dashboard
                io.emit('admin_new_message', {
                    sessionId: session._id,
                    message: userMsg,
                    session: session
                });

                // 2. Bot Logic (Simple Intent Matching)
                const intents = await BotIntent.find({ isActive: true }).sort({ priority: -1 });
                let matchedIntent = null;
                const lowerMsg = message.toLowerCase();

                for (const intent of intents) {
                    if (intent.keywords.some(k => lowerMsg.includes(k.toLowerCase()))) {
                        matchedIntent = intent;
                        break;
                    }
                }

                if (matchedIntent) {
                    const sessionIdForBot = session._id;
                    setTimeout(async () => {
                        const botMsg = new ChatMessage({
                            sessionId: sessionIdForBot,
                            sender: 'bot',
                            message: matchedIntent.response,
                            isRead: true,
                            intent: matchedIntent.intent,
                            metadata: {
                                quickReplies: matchedIntent.quickReplies
                            }
                        });
                        await botMsg.save();

                        // Update stats
                        await BotIntent.findByIdAndUpdate(matchedIntent._id, {
                            $inc: { matchCount: 1 },
                            lastMatched: Date.now()
                        });

                        io.to(socket.id).emit('message', botMsg);
                    }, 1000); // 1s delay
                } else {
                    // Default Fallback
                    const sessionIdForFallback = session._id;
                    setTimeout(async () => {
                        const fallbackMsg = new ChatMessage({
                            sessionId: sessionIdForFallback,
                            sender: 'bot',
                            message: "I'm not sure I understand. Would you like to speak to a human agent?",
                            isRead: true
                        });
                        await fallbackMsg.save();
                        io.to(socket.id).emit('message', fallbackMsg);
                    }, 1000);
                }

            } catch (error) {
                console.error('Message Error:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log('User Disconnected:', socket.id);
        });
    });

    return io;
};
