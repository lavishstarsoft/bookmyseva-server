const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
    festivalId: { type: String, required: true },
    festivalName: { type: String, required: true },
    userDetails: {
        name: { type: String },
        email: { type: String },
        phone: { type: String }
    },
    formData: { type: Object, required: true }, // Stores dynamic field values: { "field_id": "value" }
    status: { type: String, enum: ['New', 'Viewed', 'Contacted', 'Completed'], default: 'New' },
    contactNote: { type: String }, // Notes added when marking as contacted
    contactedAt: { type: Date }, // Timestamp when marked as contacted
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Enquiry', EnquirySchema);
