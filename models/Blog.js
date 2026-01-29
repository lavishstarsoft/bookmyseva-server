const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: Object, required: true }, // Changed to Object for Tiptap JSON
    excerpt: { type: String },
    image: { type: String, default: '' }, // Featured Image

    // Categorization
    category: { type: String, default: 'General' },
    tags: [{ type: String }],

    // Status
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    isPublished: { type: Boolean, default: false }, // Backward compatibility

    author: { type: String, default: 'Admin' },
    publishedAt: { type: Date },

    // SEO Fields (Premium)
    seo: {
        metaTitle: { type: String },
        metaDescription: { type: String },
        keywords: [{ type: String }],
        ogImage: { type: String }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'blogs' });

// Middleware to sync status and isPublished
// Middleware to sync status and isPublished
blogSchema.pre('save', async function () {
    this.updatedAt = Date.now();

    if (this.status === 'published') {
        this.isPublished = true;
        if (!this.publishedAt) this.publishedAt = Date.now();
    } else {
        this.isPublished = false;
    }
});

module.exports = mongoose.model('Blog', blogSchema);
