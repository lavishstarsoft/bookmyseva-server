const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number
    },
    category: {
        type: String, // 'Puja Service', 'Sacred Item', 'Book'
        required: true
    },
    images: [{
        type: String
    }],
    inStock: {
        type: Boolean,
        default: true
    },
    stockCount: {
        type: Number,
        default: 0
    },
    isFeatured: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'products' });

// Indexes for performance
productSchema.index({ category: 1 });
productSchema.index({ inStock: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
