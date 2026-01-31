const ContentBlock = require('../models/ContentBlock');
const Blog = require('../models/Blog');
const Category = require('../models/Category');
const Product = require('../models/Product');
const FrontendUser = require('../models/FrontendUser');
const AppConfig = require('../models/AppConfig');
const mongoose = require('mongoose');

// --- App Config ---
exports.getAppConfig = async (req, res) => {
    try {
        const config = await AppConfig.findOne().lean();
        res.json(config || { message: 'No config found' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateAppConfig = async (req, res) => {
    try {
        const config = await AppConfig.findOneAndUpdate(
            {},
            { ...req.body, updatedAt: Date.now() },
            { new: true, upsert: true }
        );
        res.json(config);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Content Blocks ---
exports.getContentBlock = async (req, res) => {
    try {
        const block = await ContentBlock.findOne({ identifier: req.params.identifier });
        res.json(block || { message: 'Content not found' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createContentBlock = async (req, res) => {
    try {
        const { identifier, type, title, content } = req.body;
        const block = await ContentBlock.findOneAndUpdate(
            { identifier },
            { identifier, type, title, content, updatedAt: Date.now() },
            { new: true, upsert: true }
        );
        res.json(block);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Blogs ---
exports.getBlogs = async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;
        const query = status ? { status } : {};
        const blogs = await Blog.find(query)
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(parseInt(limit));
        res.json(blogs);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getBlogBySlug = async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug);
        const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

        const blog = await Blog.findOne(query);
        if (!blog) return res.status(404).json({ message: 'Blog not found' });

        res.json(blog);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createBlog = async (req, res) => {
    try {
        const newBlog = new Blog(req.body);
        await newBlog.save();
        res.status(201).json(newBlog);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A blog with this slug already exists. Please change the title or slug.' });
        }
        res.status(500).json({ error: err.message });
    }
};

exports.updateBlog = async (req, res) => {
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
};

exports.deleteBlog = async (req, res) => {
    try {
        await Blog.findByIdAndDelete(req.params.id);
        res.json({ message: 'Blog deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Categories ---
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ createdAt: -1 });
        res.json(categories);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createCategory = async (req, res) => {
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
};

exports.updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) return res.status(404).json({ message: 'Category not found' });

        if (name) category.name = name;
        if (description !== undefined) category.description = description;

        await category.save();
        res.json(category);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'Category with this name already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const deletedCategory = await Category.findByIdAndDelete(req.params.id);
        if (!deletedCategory) return res.status(404).json({ message: 'Category not found' });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Products ---
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ inStock: true });
        res.json(products);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createProduct = async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Frontend Users ---
exports.getFrontendUsers = async (req, res) => {
    try {
        const users = await FrontendUser.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
