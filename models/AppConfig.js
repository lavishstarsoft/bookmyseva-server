const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
    androidLink: { type: String, default: '#' },
    iosLink: { type: String, default: '#' },

    // Separate QR Codes
    androidQrImage: { type: String, default: '' },
    iosQrImage: { type: String, default: '' },

    // REMOVED: qrCodeImage, sidebarBannerImage, footerImage

    updatedAt: { type: Date, default: Date.now }
}, { collection: 'app_configs' });

// We ensure only one document exists usually
module.exports = mongoose.model('AppConfig', appConfigSchema);
