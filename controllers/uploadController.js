const r2Service = require('../services/r2Service');
const AppConfig = require('../models/AppConfig');

exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No image file provided' });

        const { publicUrl, fileName } = await r2Service.uploadToR2(req.file, 'images');

        // Track Upload Usage (Class A)
        await AppConfig.findOneAndUpdate({},
            { $inc: { 'r2StorageUsage.classAOps': 1 } },
            { upsert: true }
        );

        res.json({
            message: 'Image uploaded successfully to R2',
            url: publicUrl,
            public_id: fileName
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Image upload failed', error: error.message });
    }
};

exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file provided' });

        const { publicUrl, fileName } = await r2Service.uploadToR2(req.file, 'files');

        // Track Upload Usage (Class A)
        await AppConfig.findOneAndUpdate({},
            { $inc: { 'r2StorageUsage.classAOps': 1 } },
            { upsert: true }
        );

        res.json({
            message: 'File uploaded successfully to R2',
            url: publicUrl,
            public_id: fileName,
            resource_type: 'auto'
        });

    } catch (error) {
        console.error('File Upload Error:', error);
        res.status(500).json({ message: 'File upload failed', error: error.message });
    }
};
