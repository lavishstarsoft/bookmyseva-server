const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/User');
const FrontendUser = require('./models/FrontendUser');
const Blog = require('./models/Blog');
const Product = require('./models/Product');
const ContentBlock = require('./models/ContentBlock');
const Category = require('./models/Category');
const ChatSession = require('./models/ChatSession');
const ChatMessage = require('./models/ChatMessage');
const BotIntent = require('./models/BotIntent');
const AppConfig = require('./models/AppConfig'); // Import AppConfig for tracking
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UAParser = require('ua-parser-js');

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// Load environment variables
dotenv.config();

// Cloudflare R2 Config
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// Multer Config
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
const PORT = process.env.PORT || 5000;

// Import Routes
const chatRoutes = require('./routes/chat');
const reviewRoutes = require('./routes/review');
const storageRoutes = require('./routes/storage');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch((err) => console.log('MongoDB Connection Error:', err));

// Mount Routes
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/storage', storageRoutes);

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Secure Backend Server!', status: 'Running' });
});

// Image Upload Route (R2)
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image file provided' });
        }

        const fileExtension = req.file.originalname.split('.').pop();
        const fileName = `images/${uuidv4()}.${fileExtension}`;

        const uploadParams = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read', // Depends on bucket settings, but usually R2 is private by default unless public bucket
        };

        // R2 doesn't technically support ACLs efficiently, public access is done via public domain.
        // We just need to put the object.

        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        }));

        // Track Upload Usage (Class A)
        await AppConfig.findOneAndUpdate({},
            { $inc: { 'r2StorageUsage.classAOps': 1 } },
            { upsert: true }
        );

        const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;

        res.json({
            message: 'Image uploaded successfully to R2',
            url: publicUrl,
            public_id: fileName
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Image upload failed', error: error.message });
    }
});

// Generic File Upload Route (R2)
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' });
        }

        const fileExtension = req.file.originalname.split('.').pop();
        const fileName = `files/${uuidv4()}.${fileExtension}`;

        await r2.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        }));

        // Track Upload Usage (Class A)
        await AppConfig.findOneAndUpdate({},
            { $inc: { 'r2StorageUsage.classAOps': 1 } },
            { upsert: true }
        );

        const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;

        res.json({
            message: 'File uploaded successfully to R2',
            url: publicUrl,
            public_id: fileName,
            resource_type: 'auto'
        });

    } catch (error) {
        console.error('File Upload Error:', error);
        res.status(500).json({ message: 'File upload failed', error: error.message });
    }
});

// Seed Admin User
app.post('/api/seed', async (req, res) => {
    try {
        // Check if admin exists
        const existingInfo = await User.findOne({ email: 'admin@bookmyseva.com' });

        // If exists, update password (or replace user to force hash update)
        if (existingInfo) {
            // For safety in this dev step, let's update the password
            const hashedPassword = await bcrypt.hash('admin123', 10);
            existingInfo.password = hashedPassword;
            await existingInfo.save();
            return res.status(200).json({ message: 'Admin password updated (hashed)', user: existingInfo });
        }

        const hashedPassword = await bcrypt.hash('admin123', 10);

        const newUser = new User({
            name: 'Super Admin',
            email: 'admin@bookmyseva.com',
            password: hashedPassword,
            role: 'superadmin'
        });

        await newUser.save();
        res.status(201).json({ message: 'Admin created successfully', user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Error seeding database', error: error.message });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check password (compare hash)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.SECRET_KEY,
            { expiresIn: '1h' }
        );

        // Parse User Agent
        const parser = new UAParser(req.headers['user-agent']);
        const result = parser.getResult();
        const loginInfo = {
            ip: req.ip || req.connection.remoteAddress,
            browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`,
            os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`,
            device: result.device.model || 'Desktop/Laptop',
            timestamp: new Date()
        };

        // Update User History (Keep last 50)
        user.loginHistory.push(loginInfo);
        if (user.loginHistory.length > 50) {
            user.loginHistory.shift();
        }
        await user.save();

        // Return user info and token
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Login error', error: error.message });
    }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'No token provided' });

    jwt.verify(token.split(' ')[1], process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.status(401).json({ message: 'Failed to authenticate token' });
        }
        req.userId = decoded.id;
        next();
    });
};

// Get User Profile Route
app.get('/api/user/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error: error.message });
    }
});

// Update User Profile Route (including Avatar)
app.put('/api/user/profile', verifyToken, async (req, res) => {
    try {
        const { name, bio, avatar } = req.body;

        // Find user
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Update fields if provided
        if (name) user.name = name;
        if (avatar) user.avatar = avatar;
        if (bio !== undefined) user.bio = bio;

        await user.save();

        res.json({ message: 'Profile updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
});

// Change Password Route
app.put('/api/user/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error changing password', error: error.message });
    }
});

// Get Login History
app.get('/api/user/login-history', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('loginHistory');
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Sort by timestamp desc
        const sortedHistory = user.loginHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(sortedHistory);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching login history', error: error.message });
    }
});

// --- RIDER ROUTES ---

// Get All Riders
app.get('/api/riders', verifyToken, async (req, res) => {
    try {
        const riders = await Rider.find().sort({ joinedDate: -1 });
        res.json(riders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching riders', error: error.message });
    }
});

// Create Rider
app.post('/api/riders', verifyToken, async (req, res) => {
    try {
        const { name, phone, location, vehicleType, photoUrl, status } = req.body;

        // Simple check if rider exists
        const existing = await Rider.findOne({ phone });
        if (existing) {
            return res.status(400).json({ message: 'Rider with this phone already exists' });
        }

        const newRider = new Rider({
            name,
            phone,
            location,
            vehicleType,
            photoUrl,
            status: status || 'Active'
        });

        await newRider.save();
        res.status(201).json({ message: 'Rider added successfully', rider: newRider });
    } catch (error) {
        res.status(500).json({ message: 'Error creating rider', error: error.message });
    }
});

// Update Rider
app.put('/api/riders/:id', verifyToken, async (req, res) => {
    try {
        const { name, phone, location, vehicleType, photoUrl, status, isAvailable } = req.body;
        const updatedRider = await Rider.findByIdAndUpdate(
            req.params.id,
            { name, phone, location, vehicleType, photoUrl, status, isAvailable },
            { new: true }
        );
        res.json({ message: 'Rider updated', rider: updatedRider });
    } catch (error) {
        res.status(500).json({ message: 'Error updating rider', error: error.message });
    }
});

// Delete Rider
app.delete('/api/riders/:id', verifyToken, async (req, res) => {
    try {
        await Rider.findByIdAndDelete(req.params.id);
        res.json({ message: 'Rider deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting rider', error: error.message });
    }
});

// --- CMS ROUTES ---

// 1. Content Blocks (Banners, Slokas, etc.)
app.get('/api/content/:identifier', async (req, res) => {
    try {
        const block = await ContentBlock.findOne({ identifier: req.params.identifier });
        res.json(block || { message: 'Content not found' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/content', verifyToken, async (req, res) => {
    try {
        const { identifier, type, title, content } = req.body;
        const block = await ContentBlock.findOneAndUpdate(
            { identifier },
            { identifier, type, title, content, updatedAt: Date.now() },
            { new: true, upsert: true }
        );
        res.json(block);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Blogs - Premium CRUD
app.get('/api/blogs', async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        // If public (no token usually, but here verifyToken might not be used on GET), filter by published
        // checks headers for admin token? For now, fetch all if admin, else published?
        // Simplifying: Client sends status query.

        const query = status ? { status } : {};
        // If public endpoint is needed, use /api/public/blogs (not defined yet, defaulting to internal logic)

        const blogs = await Blog.find(query)
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(parseInt(limit));
        res.json(blogs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/blogs/:idOrSlug', async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug);
        const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

        const blog = await Blog.findOne(query);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });

        res.json(blog);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/blogs', verifyToken, async (req, res) => {
    try {
        console.log('Received Blog Data:', req.body); // Debug log
        const newBlog = new Blog(req.body);
        await newBlog.save();
        res.status(201).json(newBlog);
    } catch (err) {
        console.error('Error creating blog:', err); // Log the actual error
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A blog with this slug already exists. Please change the title or slug.' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/blogs/:id', verifyToken, async (req, res) => {
    try {
        const updatedBlog = await Blog.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updatedBlog);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A blog with this slug already exists. Please change the title or slug.' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/blogs/:id', verifyToken, async (req, res) => {
    try {
        await Blog.findByIdAndDelete(req.params.id);
        res.json({ message: 'Blog deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Category Routes

// Get all categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new category
app.post('/api/categories', verifyToken, async (req, res) => {
    try {
        const newCategory = new Category(req.body);
        await newCategory.save();
        res.status(201).json(newCategory);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Category already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Update a category
app.put('/api/categories/:id', verifyToken, async (req, res) => {
    try {
        const { name, description } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        if (name) category.name = name;
        if (description !== undefined) category.description = description;

        // The pre('validate') hook we fixed earlier will handle slug regeneration if name changed
        await category.save();

        res.json(category);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Category with this name already exists' });
        }
        res.status(500).json({ message: err.message });
    }
});

// Delete a category
app.delete('/api/categories/:id', verifyToken, async (req, res) => {
    try {
        const deletedCategory = await Category.findByIdAndDelete(req.params.id);
        if (!deletedCategory) return res.status(404).json({ message: 'Category not found' });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find({ inStock: true });
        res.json(products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', verifyToken, async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Frontend Users (Admin View)
app.get('/api/frontend-users', verifyToken, async (req, res) => {
    try {
        const users = await FrontendUser.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Socket.io Setup
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
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

// Export io to use in routes (optional, or attach to req)
app.set('socketio', io);

// Socket.io Logic
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

    // End Chat Session (User initiated) - Only marks as inactive, NOT deleted
    // Admin can still see the chat history. Only admin delete should hide it.
    socket.on('end_chat', async (data) => {
        try {
            const { guestId } = data;

            if (guestId) {
                // Mark session as ended but NOT deleted - admin can still see it
                const session = await ChatSession.findOneAndUpdate(
                    { guestId: guestId },
                    {
                        isActive: false,
                        endedAt: new Date(),
                        endedByUser: true  // Flag to show user ended the chat
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

                // Join the room now that we have a session
                const roomName = session.guestId || session.userId || session._id.toString();
                socket.join(roomName);
                socket.join(session._id.toString()); // Also join by MongoDB _id for admin replies
            }

            // 2. Save User Message
            const userMsg = new ChatMessage({
                sessionId: session._id, // Use Mongo ID
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

            // Emit to admin dashboard - NEW MESSAGE NOTIFICATION
            io.emit('admin_new_message', {
                sessionId: session._id,
                message: userMsg,
                session: session
            });

            // 2. Bot Logic (Simple Intent Matching)
            // Find matching intent
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
                // Simulate typing delay
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
                // Default Fallback or Auto-Escalate if confused?
                // For now, simple fallback
                const sessionIdForFallback = session._id;
                setTimeout(async () => {
                    const fallbackMsg = new ChatMessage({
                        sessionId: sessionIdForFallback,
                        sender: 'bot',
                        message: "I'm not sure I understand. Would you like to speak to a human agent?",
                        isRead: true,
                        metadata: {
                            quickReplies: ['Contact Support']
                        }
                    });
                    await fallbackMsg.save();
                    io.to(socket.id).emit('message', fallbackMsg);
                }, 1000);
            }

        } catch (error) {
            console.error('Send Message Error:', error);
        }
    });

    // Admin joins a specific chat session to monitor
    socket.on('admin_join_session', (sessionId) => {
        socket.join(sessionId);
        console.log('Admin joined session:', sessionId);
    });

    // Admin sends reply to user
    socket.on('admin_reply', async (data) => {
        try {
            const { sessionId, message } = data;

            const adminMsg = new ChatMessage({
                sessionId: sessionId,
                sender: 'admin',
                message: message,
                isRead: false
            });
            await adminMsg.save();

            // Update session
            await ChatSession.findByIdAndUpdate(
                sessionId,
                { lastActivity: Date.now() }
            );

            // Emit to the user's session room
            io.to(sessionId).emit('message', adminMsg);

            // Also emit back to admin
            socket.emit('admin_message_sent', adminMsg);

            console.log('Admin replied to session:', sessionId);
        } catch (error) {
            console.error('Admin Reply Error:', error);
        }
    });

    // Admin deletes a message
    socket.on('delete_message', async (data) => {
        try {
            const { messageId, sessionId } = data;

            // Soft delete message
            const updatedMsg = await ChatMessage.findByIdAndUpdate(
                messageId,
                { isDeleted: true },
                { new: true }
            );

            if (updatedMsg) {
                // Emit to the specific session room
                io.to(sessionId).emit('message_deleted', {
                    messageId: messageId,
                    sessionId: sessionId
                });
                console.log('Message deleted:', messageId);
            }
        } catch (error) {
            console.error('Delete Message Error:', error);
        }
    });

    // Admin deletes a session
    socket.on('delete_session', async (data) => {
        console.log("Backend received delete_session request:", data);
        try {
            const { sessionId } = data;

            // Soft delete session (try by _id first, then by socketId for backward compatibility)
            let updatedSession = await ChatSession.findByIdAndUpdate(
                sessionId,
                { isDeleted: true, isActive: false },
                { new: true }
            );

            if (!updatedSession) {
                updatedSession = await ChatSession.findOneAndUpdate(
                    { socketId: sessionId },
                    { isDeleted: true, isActive: false },
                    { new: true }
                );
            }

            if (updatedSession) {
                // Determine userId or Guest name for logging/feedback
                const userName = updatedSession.userId || (updatedSession.guestDetails?.name || 'Guest');

                // Emit to admins so they can remove it from list
                io.emit('session_deleted', { sessionId: sessionId, userName: userName });
                console.log('Session successfully soft-deleted:', sessionId);
            } else {
                console.log("Could not find session to delete with id:", sessionId);
            }
        } catch (error) {
            console.error('Delete Session Error:', error);
        }
    });

    socket.on('disconnect', async () => {
        console.log('User Disconnected:', socket.id);
        // Mark session inactive? Or keep active for a bit?
        // await ChatSession.findOneAndUpdate({ socketId: socket.id }, { isActive: false });
    });
});



// --- ENQUIRY ROUTES (Booking) ---
const Enquiry = require('./models/Enquiry');

// 1. Submit Enquiry (From User App)
app.post('/api/enquiries', async (req, res) => {
    try {
        const { festivalId, festivalName, userDetails, formData } = req.body;

        // Save to DB
        const newEnquiry = new Enquiry({
            festivalId,
            festivalName,
            userDetails,
            formData
        });
        await newEnquiry.save();

        // Emit Socket Notification to Superadmin
        const io = req.app.get('socketio');
        io.emit('new_enquiry', newEnquiry);

        res.status(201).json({ message: 'Enquiry submitted successfully', enquiry: newEnquiry });
    } catch (error) {
        console.error("Booking Error:", error);
        res.status(500).json({ message: 'Failed to submit enquiry', error: error.message });
    }
});

// 2. Get Enquiries (For Superadmin)
app.get('/api/enquiries', verifyToken, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const enquiries = await Enquiry.find()
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Enquiry.countDocuments();

        res.json({
            enquiries,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching enquiries', error: error.message });
    }
});

// 3. Update Enquiry Status
app.patch('/api/enquiries/:id', verifyToken, async (req, res) => {
    try {
        const { status } = req.body;
        const updatedEnquiry = await Enquiry.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        res.json(updatedEnquiry);
    } catch (error) {
        res.status(500).json({ message: 'Error updating enquiry', error: error.message });
    }
});

// --- PANCHANGAM ROUTES ---
const Panchangam = require('./models/Panchangam');

// 1. Get Panchangam for a specific date (Admin)
app.get('/api/panchangam', verifyToken, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: 'Date is required' });

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const data = await Panchangam.findOne({
            date: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        });

        res.json(data || {}); // Return empty object if no data found, so frontend knows it's empty
    } catch (error) {
        res.status(500).json({ message: 'Error fetching panchangam', error: error.message });
    }
});

// 2. Create/Update Panchangam (Admin)
app.post('/api/panchangam', verifyToken, async (req, res) => {
    try {
        const { date, ...details } = req.body;

        // Normalize date to start of day
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        const data = await Panchangam.findOneAndUpdate(
            { date: targetDate },
            {
                date: targetDate,
                ...details,
                updatedAt: Date.now()
            },
            { new: true, upsert: true } // Create if not exists
        );

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error saving panchangam', error: error.message });
    }
});

// 3. Public: Get Today's Panchangam (User App)
app.get('/api/public/panchangam/today', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const data = await Panchangam.findOne({
            date: {
                $gte: today,
                $lte: endOfDay
            }
        });

        if (!data) {
            return res.status(404).json({ message: 'No panchangam data for today' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching today panchangam', error: error.message });
    }
});



// --- GITA ROUTES ---
const GitaContent = require('./models/GitaContent');

// 1. Get All Gita Content (Admin)
app.get('/api/gita', verifyToken, async (req, res) => {
    try {
        const { type } = req.query;
        const query = type ? { type } : {};
        const items = await GitaContent.find(query).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching gita content', error: error.message });
    }
});

// 2. Create Gita Content (Admin)
app.post('/api/gita', verifyToken, async (req, res) => {
    try {
        const newItem = new GitaContent(req.body);
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        res.status(500).json({ message: 'Error creating gita content', error: error.message });
    }
});

// 3. Update Gita Content (Admin)
app.put('/api/gita/:id', verifyToken, async (req, res) => {
    try {
        const updatedItem = await GitaContent.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updatedItem);
    } catch (error) {
        res.status(500).json({ message: 'Error updating gita content', error: error.message });
    }
});

// 4. Delete Gita Content (Admin)
app.delete('/api/gita/:id', verifyToken, async (req, res) => {
    try {
        await GitaContent.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting gita content', error: error.message });
    }
});

// 5. Public: Get All Gita Content (User App)
app.get('/api/public/gita', async (req, res) => {
    try {
        const items = await GitaContent.find().sort({ createdAt: -1 });

        // Group by type for easier frontend consumption
        const gitaSlokas = items.filter(item => item.type === 'gita');
        const kidsGitaSlokas = items.filter(item => item.type === 'kids-gita');

        res.json({
            gitaSlokas,
            kidsGitaSlokas
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching public gita content', error: error.message });
    }
});


// --- MANTRA ROUTES ---
const Mantra = require('./models/Mantra');

// 1. Get All Mantras (Admin)
app.get('/api/mantras', verifyToken, async (req, res) => {
    try {
        const mantras = await Mantra.find().sort({ order: 1, createdAt: -1 });
        res.json(mantras);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching mantras', error: error.message });
    }
});

// 2. Create Mantra (Admin)
app.post('/api/mantras', verifyToken, async (req, res) => {
    try {
        const newMantra = new Mantra(req.body);
        await newMantra.save();
        res.status(201).json(newMantra);
    } catch (error) {
        res.status(500).json({ message: 'Error creating mantra', error: error.message });
    }
});

// 3. Update Mantra (Admin)
app.put('/api/mantras/:id', verifyToken, async (req, res) => {
    try {
        const updatedMantra = await Mantra.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(updatedMantra);
    } catch (error) {
        res.status(500).json({ message: 'Error updating mantra', error: error.message });
    }
});

// 4. Delete Mantra (Admin)
app.delete('/api/mantras/:id', verifyToken, async (req, res) => {
    try {
        await Mantra.findByIdAndDelete(req.params.id);
        res.json({ message: 'Mantra deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting mantra', error: error.message });
    }
});

// 5. Public: Get Active Mantras (User App)
app.get('/api/public/mantras', async (req, res) => {
    try {
        const mantras = await Mantra.find({ isActive: true }).sort({ order: 1 });
        res.json(mantras);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching active mantras', error: error.message });
    }
});



// --- APP CONFIG ROUTES ---
// AppConfig is already imported at the top of the file

// Helper to get singleton config
const getAppConfig = async () => {
    let config = await AppConfig.findOne();
    if (!config) {
        config = new AppConfig();
        await config.save();
    }
    return config;
};

// 1. Get Settings (Public)
app.get('/api/public/app-config', async (req, res) => {
    try {
        const config = await getAppConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching app config', error: error.message });
    }
});

// 2. Get Settings (Admin)
app.get('/api/app-config', verifyToken, async (req, res) => {
    try {
        const config = await getAppConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching app config', error: error.message });
    }
});

// 3. Update Settings (Admin)
app.post('/api/app-config', verifyToken, async (req, res) => {
    try {
        const config = await AppConfig.findOne();
        if (config) {
            Object.assign(config, req.body);
            config.updatedAt = Date.now();
            await config.save();
            res.json(config);
        } else {
            const newConfig = new AppConfig(req.body);
            await newConfig.save();
            res.json(newConfig);
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating app config', error: error.message });
    }
});


// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
