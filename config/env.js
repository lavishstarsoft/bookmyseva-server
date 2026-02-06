/**
 * Environment Configuration
 * Validates and provides typed access to environment variables
 */

const requiredEnvVars = [
    'DATABASE_URL',
    'SECRET_KEY'
];

const optionalEnvVars = {
    NODE_ENV: 'development',
    PORT: '5000',
    JWT_EXPIRES_IN: '1h',

    // CORS
    FRONTEND_URL: 'http://localhost:3000',
    ADMIN_URL: 'http://localhost:3001',

    // R2 Storage
    R2_ACCOUNT_ID: '',
    R2_ACCESS_KEY_ID: '',
    R2_SECRET_ACCESS_KEY: '',
    R2_BUCKET_NAME: '',
    R2_PUBLIC_DOMAIN: '',

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: '100',

    // Logging
    LOG_LEVEL: 'info'
};

/**
 * Validate required environment variables
 */
const validateEnv = () => {
    const missing = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Set defaults for optional vars
    for (const [key, defaultValue] of Object.entries(optionalEnvVars)) {
        if (!process.env[key]) {
            process.env[key] = defaultValue;
        }
    }

    // Validate NODE_ENV
    const validEnvs = ['development', 'staging', 'production', 'test'];
    if (!validEnvs.includes(process.env.NODE_ENV)) {
        console.warn(`Warning: NODE_ENV "${process.env.NODE_ENV}" is not standard. Using "development".`);
        process.env.NODE_ENV = 'development';
    }

    return true;
};

/**
 * Environment configuration object
 */
const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5000', 10),

    // Database
    database: {
        url: process.env.DATABASE_URL,
        options: {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }
    },

    // JWT
    jwt: {
        secret: process.env.SECRET_KEY,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        issuer: 'bookmyseva',
        audience: 'bookmyseva-users'
    },

    // CORS
    cors: {
        frontendUrl: process.env.FRONTEND_URL,
        adminUrl: process.env.ADMIN_URL,
        allowedOrigins: [
            process.env.FRONTEND_URL,
            process.env.ADMIN_URL,
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173'
        ].filter(Boolean)
    },

    // R2 Storage
    r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucketName: process.env.R2_BUCKET_NAME,
        publicDomain: process.env.R2_PUBLIC_DOMAIN
    },

    // MSG91
    msg91: {
        authKey: process.env.MSG91_AUTH_KEY,
        senderId: process.env.MSG91_SENDER_ID,
        templateId: process.env.MSG91_TEMPLATE_ID
    },

    // Rate Limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
    },

    // Feature flags
    features: {
        enableSeed: process.env.NODE_ENV !== 'production',
        enableDebugLogs: process.env.NODE_ENV === 'development',
        enableDetailedErrors: process.env.NODE_ENV !== 'production'
    },

    // Helpers
    isDevelopment: () => process.env.NODE_ENV === 'development',
    isProduction: () => process.env.NODE_ENV === 'production',
    isTest: () => process.env.NODE_ENV === 'test'
};

module.exports = {
    validateEnv,
    config
};
