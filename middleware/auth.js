const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.SECRET_KEY || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// Middleware to verify if user is admin
const verifyAdmin = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Access denied. User not authenticated.' });
        }

        // Check if user has admin role
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Error verifying admin status.', error: error.message });
    }
};

module.exports = {
    verifyToken,
    verifyAdmin
};
