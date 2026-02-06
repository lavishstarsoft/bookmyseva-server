const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const compression = require('compression');

// Import Middleware
const { apiLimiter, speedLimiter } = require('./middleware/rateLimiter');
const { globalErrorHandler, notFound } = require('./middleware/errorHandler');
const { handleMulterError } = require('./middleware/fileUpload');
const logger = require('./services/logger');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const riderRoutes = require('./routes/riderRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const cmsRoutes = require('./routes/cmsRoutes');
const chatRoutes = require('./routes/chat');
const reviewRoutes = require('./routes/review');
const storageRoutes = require('./routes/storage');
const enquiryRoutes = require('./routes/enquiryRoutes');
const spiritualRoutes = require('./routes/spiritualRoutes');

const app = express();

// ===========================================
// 1. SECURITY MIDDLEWARE
// ===========================================

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS Configuration
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            process.env.ADMIN_URL,
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173',
            'http://localhost:8080',
            'http://localhost:8081',
            'https://www.bookmyseva.com',
            'https://bookmyseva.com',
        ].filter(Boolean);

        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            logger.logSecurity('CORS blocked', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Helmet - Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:', process.env.R2_PUBLIC_DOMAIN].filter(Boolean),
            connectSrc: ["'self'", process.env.FRONTEND_URL, process.env.ADMIN_URL].filter(Boolean),
            fontSrc: ["'self'", 'https:', 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Prevent parameter pollution
app.use(hpp({
    whitelist: ['status', 'category', 'tags', 'limit', 'page', 'sort']
}));

// Compression for responses
app.use(compression());

// ===========================================
// 2. BODY PARSING
// ===========================================

app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({
    limit: '10mb',
    extended: true
}));

// ===========================================
// 3. DATA SANITIZATION
// ===========================================

// Custom NoSQL injection prevention (Express 5 compatible)
const sanitizeValue = (value) => {
    if (typeof value === 'string') {
        // Remove MongoDB operators from strings
        return value.replace(/\$|\{|\}/g, '');
    }
    if (typeof value === 'object' && value !== null) {
        // Check for MongoDB operators in objects
        for (const key of Object.keys(value)) {
            if (key.startsWith('$')) {
                logger.logSecurity('NoSQL Injection attempt blocked', { key });
                delete value[key];
            } else {
                value[key] = sanitizeValue(value[key]);
            }
        }
    }
    return value;
};

app.use((req, res, next) => {
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }
    // Note: req.query is read-only in Express 5, so we sanitize body and params only
    if (req.params) {
        req.params = sanitizeValue(req.params);
    }
    next();
});

// ===========================================
// 4. RATE LIMITING
// ===========================================

app.use('/api', apiLimiter);
app.use('/api', speedLimiter);

// ===========================================
// 5. REQUEST LOGGING
// ===========================================

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.logRequest(req, res, duration);
    });
    next();
});

// ===========================================
// 6. HEALTH CHECK ROUTES
// ===========================================

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'BookMySeva API Server',
        version: '1.0.0',
        status: 'Running',
        environment: process.env.NODE_ENV || 'development'
    });
});

// ===========================================
// 7. API ROUTES (v1)
// ===========================================

const API_V1 = '/api/v1';

app.use(`${API_V1}/auth`, authRoutes);
app.use(`${API_V1}/user`, userRoutes);
app.use(`${API_V1}/riders`, riderRoutes);
app.use(`${API_V1}/upload`, uploadRoutes);
app.use(`${API_V1}/chat`, chatRoutes);
app.use(`${API_V1}/reviews`, reviewRoutes);
app.use(`${API_V1}/storage`, storageRoutes);
app.use(`${API_V1}/enquiries`, enquiryRoutes);

// Customer Auth Routes (OTP) - Mount before generic routes
app.use(`${API_V1}/customer-auth`, (req, res, next) => {
    console.log(`[DEBUG_ROUTE] Hit ${req.originalUrl} with method ${req.method}`);
    next();
});
const customerAuthRoutes = require('./routes/customerAuthRoutes');
app.use(`${API_V1}/customer-auth`, customerAuthRoutes);

// Spiritual routes BEFORE cms routes (more specific paths first)
app.use(`${API_V1}`, spiritualRoutes);  // Gita, Mantras, Panchangam
app.use(`${API_V1}/content`, spiritualRoutes);  // Alternate paths for content/* routes
// CMS routes last (has catch-all /:identifier)
app.use(`${API_V1}/cms`, cmsRoutes);
app.use(`${API_V1}/content`, cmsRoutes); // Direct content route for frontend compatibility
app.use(`${API_V1}`, cmsRoutes); // Mount CMS routes directly for /blogs, /categories etc

// Legacy routes (backward compatibility)
app.use('/api', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/riders', riderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', cmsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/storage', storageRoutes);

// ===========================================
// 8. ERROR HANDLING
// ===========================================

app.use(handleMulterError);
app.use(notFound);
app.use(globalErrorHandler);

// ===========================================
// 9. GRACEFUL SHUTDOWN HANDLING
// ===========================================

process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥', { error: err.message, stack: err.stack });
});

process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥', { error: err.message, stack: err.stack });
    process.exit(1);
});

module.exports = app;
