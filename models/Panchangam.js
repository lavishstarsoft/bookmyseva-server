const mongoose = require('mongoose');

const panchangamSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true
    },
    tithi: { type: String, default: '' },
    nakshatra: { type: String, default: '' },
    yoga: { type: String, default: '' },
    karana: { type: String, default: '' },
    sunrise: { type: String, default: '' },
    sunset: { type: String, default: '' },
    moonrise: { type: String, default: '' },
    rahu: { type: String, default: '' },
    auspiciousTime: { type: String, default: '' },

    // Special Event Fields (Optional - Overrides Daily Default)
    specialEventName: { type: String, default: '' },
    specialEventDeity: { type: String, default: '' },
    specialEventPooja: { type: String, default: '' },
    specialEventImage: { type: String, default: '' },
    specialEventBookingLink: { type: String, default: '' }, // Keep for legacy/external links
    bookingButtonLabel: { type: String, default: 'Book Now' }, // Customizable button text

    // Dynamic Booking Form Configuration
    isBookingEnabled: { type: Boolean, default: true },
    formFields: [{
        id: String,
        type: { type: String, enum: ['text', 'number', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox'], default: 'text' },
        label: String,
        placeholder: String,
        required: { type: Boolean, default: false },
        options: String, // For select/radio
        width: { type: String, default: 'full' },
        // Validation for numbers
        minLength: Number,
        maxLength: Number
    }],

    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'panchangam' });

// Indexes for performance
panchangamSchema.index({ date: -1 });

module.exports = mongoose.model('Panchangam', panchangamSchema);
