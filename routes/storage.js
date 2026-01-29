const express = require('express');
const router = express.Router();
const { S3Client, ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const AppConfig = require('../models/AppConfig');
const dotenv = require('dotenv');

dotenv.config();

// Cloudflare R2 Config (Recreated here as routes often have their own config or import from a config file)
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// Get Storage Usage (Analytics)
router.get('/usage', async (req, res) => {
    try {
        const config = await AppConfig.findOne();
        res.json(config ? config.r2StorageUsage : { classAOps: 0, classBOps: 0, storageBytes: 0 });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching usage', error: error.message });
    }
});

// List Files
router.get('/files', async (req, res) => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME,
            MaxKeys: 100 // Limit for now
        });
        const response = await r2.send(command);

        const files = response.Contents?.map(file => ({
            key: file.Key,
            lastModified: file.LastModified,
            size: file.Size,
            url: `${process.env.R2_PUBLIC_DOMAIN}/${file.Key}`
        })) || [];

        res.json(files);
    } catch (error) {
        console.error('List R2 Files Error:', error);
        res.status(500).json({ message: 'Error listing files', error: error.message });
    }
});

// Delete File
router.delete('/files/:key', async (req, res) => {
    try {
        const { key } = req.params;
        // Decode key if it was URL encoded in path
        const decodedKey = decodeURIComponent(key);

        await r2.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: decodedKey
        }));

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting file', error: error.message });
    }
});

module.exports = router;
