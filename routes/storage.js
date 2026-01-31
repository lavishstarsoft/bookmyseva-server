const express = require('express');
const router = express.Router();
const { S3Client, ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const AppConfig = require('../models/AppConfig');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { catchAsync } = require('../middleware/errorHandler');
const AppError = require('../utils/AppError');
const logger = require('../services/logger');

// Cloudflare R2 Config
const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// All storage routes require admin authentication
router.use(verifyToken, verifyAdmin, adminLimiter);

// Get Storage Usage (Analytics)
router.get('/usage', catchAsync(async (req, res) => {
    const config = await AppConfig.findOne().lean();
    res.json({
        success: true,
        data: config?.r2StorageUsage || { classAOps: 0, classBOps: 0, storageBytes: 0 }
    });
}));

// List Files with pagination
router.get('/files', catchAsync(async (req, res) => {
    const { prefix, continuationToken, maxKeys = 50 } = req.query;
    
    // Limit maxKeys to prevent abuse
    const limit = Math.min(parseInt(maxKeys), 100);
    
    const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        MaxKeys: limit,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken || undefined
    });
    
    const response = await r2.send(command);

    const files = response.Contents?.map(file => ({
        key: file.Key,
        lastModified: file.LastModified,
        size: file.Size,
        url: `${process.env.R2_PUBLIC_DOMAIN}/${file.Key}`
    })) || [];

    // Track Class B operation
    await AppConfig.findOneAndUpdate({},
        { $inc: { 'r2StorageUsage.classBOps': 1 } },
        { upsert: true }
    );

    res.json({
        success: true,
        data: files,
        pagination: {
            isTruncated: response.IsTruncated,
            nextContinuationToken: response.NextContinuationToken,
            keyCount: response.KeyCount
        }
    });
}));

// Delete Single File
router.delete('/files/:key', catchAsync(async (req, res) => {
    const { key } = req.params;
    
    if (!key) {
        throw new AppError('File key is required', 400);
    }
    
    // Decode key if URL encoded
    const decodedKey = decodeURIComponent(key);
    
    // Security: Prevent path traversal
    if (decodedKey.includes('..')) {
        logger.logSecurity('Path traversal attempt in storage delete', {
            key: decodedKey,
            userId: req.user?.id,
            ip: req.ip
        });
        throw new AppError('Invalid file key', 400);
    }

    await r2.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: decodedKey
    }));

    logger.info('File deleted from R2', {
        key: decodedKey,
        userId: req.user?.id
    });

    res.json({ success: true, message: 'File deleted successfully' });
}));

// Bulk Delete Files (Admin only)
router.post('/files/bulk-delete', catchAsync(async (req, res) => {
    const { keys } = req.body;
    
    if (!Array.isArray(keys) || keys.length === 0) {
        throw new AppError('Keys array is required', 400);
    }
    
    if (keys.length > 100) {
        throw new AppError('Maximum 100 files can be deleted at once', 400);
    }
    
    // Security: Validate all keys
    for (const key of keys) {
        if (typeof key !== 'string' || key.includes('..')) {
            throw new AppError('Invalid file key in batch', 400);
        }
    }

    const deleteParams = {
        Bucket: process.env.R2_BUCKET_NAME,
        Delete: {
            Objects: keys.map(key => ({ Key: decodeURIComponent(key) })),
            Quiet: false
        }
    };

    const result = await r2.send(new DeleteObjectsCommand(deleteParams));

    logger.info('Bulk delete from R2', {
        deletedCount: result.Deleted?.length || 0,
        errorCount: result.Errors?.length || 0,
        userId: req.user?.id
    });

    res.json({
        success: true,
        message: `Deleted ${result.Deleted?.length || 0} files`,
        deleted: result.Deleted,
        errors: result.Errors
    });
}));

module.exports = router;
