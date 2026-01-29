const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: Object, required: true }, // Tiptap JSON content
    excerpt: { type: String },
    featuredImage: { type: String },

    // Categorization
    categories: [{ type: String }],
    tags: [{ type: String }],

    // Status & Author
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    author: { type: String, default: 'Admin' },
    publishedAt: { type: Date },

    // SEO Fields
    seo: {
        metaTitle: { type: String },
        metaDescription: { type: String },
        keywords: [{ type: String }],
        ogImage: { type: String } // Optional override for og:image
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'blog_posts' });

// Pre-save middleware to update updatedAt
blogPostSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('BlogPost', blogPostSchema);
