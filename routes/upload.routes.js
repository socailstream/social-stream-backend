/**
 * Upload Routes
 * 
 * Media Upload Endpoints:
 * - POST /upload/image         - Upload single image
 * - POST /upload/video         - Upload single video
 * - POST /upload/multiple      - Upload multiple files
 * - DELETE /upload             - Delete media by public ID
 * - DELETE /upload/by-url      - Delete media by URL
 * - GET /upload/optimize       - Get optimized image URL
 */

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All upload routes require authentication
router.use(verifyToken);

// Upload routes
router.post(
  '/image',
  uploadController.uploadMiddleware.single,
  uploadController.uploadImage
);

router.post(
  '/video',
  uploadController.uploadMiddleware.single,
  uploadController.uploadVideo
);

router.post(
  '/multiple',
  uploadController.uploadMiddleware.multiple,
  uploadController.uploadMultiple
);

// Delete routes
router.delete('/', uploadController.deleteMedia);
router.delete('/by-url', uploadController.deleteMediaByUrl);

// Utility routes
router.get('/optimize', uploadController.getOptimizedUrl);

module.exports = router;
