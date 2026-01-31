const winston = require('winston');
const path = require('path');

/**
 * Custom log format
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        // Add metadata if present
        if (Object.keys(metadata).length > 0) {
            log += ` ${JSON.stringify(metadata)}`;
        }
        
        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }
        
        return log;
    })
);

/**
 * JSON format for production (better for log aggregation)
 */
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

/**
 * Determine log level based on environment
 */
const getLogLevel = () => {
    const env = process.env.NODE_ENV || 'development';
    switch (env) {
        case 'production':
            return 'warn';
        case 'development':
            return 'debug';
        case 'test':
            return 'error';
        default:
            return 'info';
    }
};

/**
 * Create transports based on environment
 */
const getTransports = () => {
    const transports = [];
    const env = process.env.NODE_ENV || 'development';

    // Console transport (always enabled)
    transports.push(
        new winston.transports.Console({
            format: env === 'production' 
                ? jsonFormat 
                : winston.format.combine(
                    winston.format.colorize(),
                    logFormat
                )
        })
    );

    // File transports (production only)
    if (env === 'production') {
        // Error logs
        transports.push(
            new winston.transports.File({
                filename: path.join(__dirname, '../logs/error.log'),
                level: 'error',
                format: jsonFormat,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5
            })
        );

        // Combined logs
        transports.push(
            new winston.transports.File({
                filename: path.join(__dirname, '../logs/combined.log'),
                format: jsonFormat,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5
            })
        );

        // Access logs
        transports.push(
            new winston.transports.File({
                filename: path.join(__dirname, '../logs/access.log'),
                level: 'info',
                format: jsonFormat,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5
            })
        );
    }

    return transports;
};

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
    level: getLogLevel(),
    format: logFormat,
    transports: getTransports(),
    // Don't exit on handled exceptions
    exitOnError: false
});

/**
 * Stream for Morgan HTTP logger integration
 */
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

/**
 * Log HTTP request details
 */
logger.logRequest = (req, res, responseTime) => {
    const log = {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        userId: req.user?.id
    };

    if (res.statusCode >= 400) {
        logger.warn('HTTP Request', log);
    } else {
        logger.info('HTTP Request', log);
    }
};

/**
 * Log database operations
 */
logger.logDB = (operation, collection, query, duration) => {
    logger.debug('Database Operation', {
        operation,
        collection,
        query: JSON.stringify(query),
        duration: `${duration}ms`
    });
};

/**
 * Log authentication events
 */
logger.logAuth = (event, userId, ip, success = true) => {
    const level = success ? 'info' : 'warn';
    logger[level](`Auth: ${event}`, {
        userId,
        ip,
        success
    });
};

/**
 * Log security events
 */
logger.logSecurity = (event, details) => {
    logger.warn(`Security: ${event}`, details);
};

/**
 * Log application errors
 */
logger.logError = (error, context = {}) => {
    logger.error(error.message, {
        name: error.name,
        stack: error.stack,
        ...context
    });
};

module.exports = logger;
