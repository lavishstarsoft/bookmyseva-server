const mongoose = require('mongoose');
const logger = require('../services/logger');

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000; // 5 seconds

const connectDB = async (retryCount = 0) => {
    try {
        const conn = await mongoose.connect(process.env.DATABASE_URL, {
            // Connection Pool Settings
            maxPoolSize: 10,
            minPoolSize: 2,
            
            // Timeouts
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            
            // Heartbeat
            heartbeatFrequencyMS: 10000,
        });
        
        logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

        // Connection event handlers
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', { error: err.message });
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });

        return conn;

    } catch (err) {
        logger.error('MongoDB Connection Error:', { 
            error: err.message, 
            attempt: retryCount + 1,
            maxRetries: MAX_RETRIES 
        });
        
        if (retryCount < MAX_RETRIES) {
            logger.info(`Retrying MongoDB connection in ${RETRY_INTERVAL/1000} seconds... (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
            return connectDB(retryCount + 1);
        }
        
        logger.error('❌ Failed to connect to MongoDB after maximum retries. Please check:');
        logger.error('   1. MongoDB Atlas IP Whitelist - Add your current IP');
        logger.error('   2. DATABASE_URL in .env file');
        logger.error('   3. Network connectivity');
        
        // Exit only after all retries exhausted
        process.exit(1);
    }
};

module.exports = connectDB;
