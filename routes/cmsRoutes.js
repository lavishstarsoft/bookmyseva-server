const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { blogValidation, categoryValidation, productValidation, queryValidation } = require('../middleware/validators');
const { apiLimiter, adminLimiter } = require('../middleware/rateLimiter');

// ===== PUBLIC ROUTES (with standard rate limiting) =====

// App Config (Public read)
router.get('/app-config', cmsController.getAppConfig);

// Blogs (Public read) - BEFORE catch-all
router.get('/blogs', queryValidation.pagination, cmsController.getBlogs);
router.get('/blogs/:idOrSlug', cmsController.getBlogBySlug);

// Categories (Public read) - BEFORE catch-all
router.get('/categories', cmsController.getCategories);

// Products (Public read) - BEFORE catch-all
router.get('/products', cmsController.getProducts);

// Content Blocks (Public read) - supports both /content/:id and /:id when mounted at /content
router.get('/content/:identifier', cmsController.getContentBlock);

// ===== ADMIN ROUTES =====

// App Config management (Admin)
router.put('/app-config', verifyToken, verifyAdmin, adminLimiter, cmsController.updateAppConfig);

// Content management (Admin)
router.post('/content', verifyToken, verifyAdmin, adminLimiter, cmsController.createContentBlock);

// Blog management (Admin)
router.post('/blogs', verifyToken, verifyAdmin, adminLimiter, blogValidation.create, cmsController.createBlog);
router.put('/blogs/:id', verifyToken, verifyAdmin, adminLimiter, blogValidation.update, cmsController.updateBlog);
router.delete('/blogs/:id', verifyToken, verifyAdmin, adminLimiter, cmsController.deleteBlog);

// Category management (Admin)
router.post('/categories', verifyToken, verifyAdmin, adminLimiter, categoryValidation.create, cmsController.createCategory);
router.put('/categories/:id', verifyToken, verifyAdmin, adminLimiter, categoryValidation.update, cmsController.updateCategory);
router.delete('/categories/:id', verifyToken, verifyAdmin, adminLimiter, cmsController.deleteCategory);

// Product management (Admin)
router.post('/products', verifyToken, verifyAdmin, adminLimiter, productValidation.create, cmsController.createProduct);

// Frontend Users (Admin)
router.get('/frontend-users', verifyToken, verifyAdmin, queryValidation.pagination, cmsController.getFrontendUsers);

// ===== CATCH-ALL for Content Blocks - MUST BE LAST =====
// For direct /content mount (e.g., /api/v1/content/banner-1)
router.get('/:identifier', cmsController.getContentBlock);

module.exports = router;
