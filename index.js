const dotenv = require('dotenv');
const http = require('http');

// Load environment variables FIRST
dotenv.config();

// Validate environment
const { validateEnv, config } = require('./config/env');
try {
    validateEnv();
} catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
}

const connectDB = require('./config/db');
const app = require('./app');
const { initSocket } = require('./services/socketService');
const logger = require('./services/logger');

// Connect to Database
connectDB();

const PORT = config.port;
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocket(server);
app.set('socketio', io);

// Start Server
server.listen(PORT, () => {
    logger.info(`🚀 Server running in ${config.env} mode on port ${PORT}`);
    logger.info(`📡 Health check: http://localhost:${PORT}/health`);
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    
    // Force close after 30 seconds
    const forceTimeout = setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
    
    try {
        // Close HTTP server
        await new Promise((resolve) => {
            server.close(resolve);
        });
        logger.info('HTTP server closed');
        
        // Close database connection (Mongoose 8+ uses promises, no callback)
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        
        clearTimeout(forceTimeout);
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        clearTimeout(forceTimeout);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
