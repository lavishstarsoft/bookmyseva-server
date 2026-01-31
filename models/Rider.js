const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    location: {
        type: String,
        default: ''
    },
    vehicleType: {
        type: String,
        default: 'Bike'
    },
    photoUrl: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        default: 'Active',
        enum: ['Active', 'Inactive', 'Suspended']
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    joinedDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Rider', riderSchema);
