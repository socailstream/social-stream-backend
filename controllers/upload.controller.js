const cloudinaryService = require('../services/cloudinary.service');
const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log('📎 File filter - mimetype:', file.mimetype, 'fieldname:', file.fieldname, 'originalname:', file.originalname);
  
  // Check mimetype first
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
    return;
  }
  
  // Fallback: Check file extension for octet-stream (common with mobile uploads)
  if (file.mimetype === 'application/octet-stream' && file.originalname) {
    const ext = file.originalname.toLowerCase().split('.').pop();
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif', 'heic', 'heif'];
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'm4v', '3gp'];
    
    if (imageExts.includes(ext) || videoExts.includes(ext)) {
      console.log('✅ Accepted file by extension:', ext);
      cb(null, true);
      return;
    }
  }
  
  console.log('❌ Rejected file type:', file.mimetype, 'extension:', file.originalname);
  cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

/**
 * Upload single image
 */
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const result = await cloudinaryService.uploadImage(req.file.buffer, {
      folder: `social-stream/users/${req.user._id}/images`
    });

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Upload image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
      error: error.message
    });
  }
};

/**
 * Upload single video
 */
exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const result = await cloudinaryService.uploadVideo(req.file.buffer, {
      folder: `social-stream/users/${req.user._id}/videos`
    });

    res.status(200).json({
      success: true,
      message: 'Video uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Upload video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video',
      error: error.message
    });
  }
};

/**
 * Upload multiple files (images/videos)
 */
exports.uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadPromises = req.files.map(file => {
      const isVideo = file.mimetype.startsWith('video/');
      const folder = `social-stream/users/${req.user._id}/${isVideo ? 'videos' : 'images'}`;
      
      if (isVideo) {
        return cloudinaryService.uploadVideo(file.buffer, { folder });
      }
      return cloudinaryService.uploadImage(file.buffer, { folder });
    });

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('❌ Upload multiple error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
};

/**
 * Delete media by public ID
 */
exports.deleteMedia = async (req, res) => {
  try {
    const { publicId, resourceType = 'image' } = req.body;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const result = await cloudinaryService.deleteMedia(publicId, resourceType);

    res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Delete media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message
    });
  }
};

/**
 * Delete media by URL
 */
exports.deleteMediaByUrl = async (req, res) => {
  try {
    const { url, resourceType = 'image' } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Media URL is required'
      });
    }

    const publicId = cloudinaryService.extractPublicId(url);
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract public ID from URL'
      });
    }

    const result = await cloudinaryService.deleteMedia(publicId, resourceType);

    res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Delete media by URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message
    });
  }
};

/**
 * Get optimized image URL with transformations
 */
exports.getOptimizedUrl = async (req, res) => {
  try {
    const { publicId, width, height, quality, format } = req.query;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
    }

    const transformations = {};
    if (width) transformations.width = parseInt(width);
    if (height) transformations.height = parseInt(height);
    if (quality) transformations.quality = quality;
    if (format) transformations.format = format;

    const url = cloudinaryService.getOptimizedImageUrl(publicId, transformations);

    res.status(200).json({
      success: true,
      data: { url }
    });
  } catch (error) {
    console.error('❌ Get optimized URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate optimized URL',
      error: error.message
    });
  }
};

// Export multer middleware for use in routes
exports.uploadMiddleware = {
  single: upload.single('file'),
  multiple: upload.array('files', 10),
  fields: upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'videos', maxCount: 2 }
  ])
};
