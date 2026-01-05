const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

/**
 * Cloudinary Service
 * Handles media uploads, deletions, and transformations using Cloudinary
 */
class CloudinaryService {
  /**
   * Upload image to Cloudinary
   * @param {Buffer|String} file - File buffer or base64 string
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URL and public_id
   */
  async uploadImage(file, options = {}) {
    try {
      const defaultOptions = {
        folder: 'social-stream/images',
        resource_type: 'image',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ],
        ...options
      };

      let uploadResult;

      if (Buffer.isBuffer(file)) {
        // Upload from buffer
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            defaultOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          const readableStream = Readable.from(file);
          readableStream.pipe(uploadStream);
        });
      } else if (typeof file === 'string') {
        // Upload from URL or base64
        uploadResult = await cloudinary.uploader.upload(file, defaultOptions);
      } else {
        throw new Error('Invalid file format. Expected Buffer or String.');
      }

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
        resourceType: uploadResult.resource_type
      };
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Upload video to Cloudinary
   * @param {Buffer|String} file - File buffer or URL
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URL and public_id
   */
  async uploadVideo(file, options = {}) {
    try {
      const defaultOptions = {
        folder: 'social-stream/videos',
        resource_type: 'video',
        transformation: [
          { quality: 'auto' }
        ],
        ...options
      };

      let uploadResult;

      if (Buffer.isBuffer(file)) {
        // Upload from buffer
        uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            defaultOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );

          const readableStream = Readable.from(file);
          readableStream.pipe(uploadStream);
        });
      } else if (typeof file === 'string') {
        // Upload from URL
        uploadResult = await cloudinary.uploader.upload(file, defaultOptions);
      } else {
        throw new Error('Invalid file format. Expected Buffer or String.');
      }

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        format: uploadResult.format,
        duration: uploadResult.duration,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
        resourceType: uploadResult.resource_type
      };
    } catch (error) {
      console.error('❌ Cloudinary video upload error:', error);
      throw new Error(`Failed to upload video: ${error.message}`);
    }
  }

  /**
   * Delete media from Cloudinary
   * @param {String} publicId - Public ID of the resource
   * @param {String} resourceType - Type of resource ('image' or 'video')
   * @returns {Promise<Object>} Deletion result
   */
  async deleteMedia(publicId, resourceType = 'image') {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });

      if (result.result !== 'ok') {
        throw new Error(`Failed to delete media: ${result.result}`);
      }

      return {
        success: true,
        message: 'Media deleted successfully',
        publicId
      };
    } catch (error) {
      console.error('❌ Cloudinary delete error:', error);
      throw new Error(`Failed to delete media: ${error.message}`);
    }
  }

  /**
   * Delete multiple media files
   * @param {Array<String>} publicIds - Array of public IDs
   * @param {String} resourceType - Type of resource
   * @returns {Promise<Object>} Deletion results
   */
  async deleteMultipleMedia(publicIds, resourceType = 'image') {
    try {
      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType
      });

      return {
        success: true,
        deleted: result.deleted,
        deletedCount: Object.keys(result.deleted).length
      };
    } catch (error) {
      console.error('❌ Cloudinary bulk delete error:', error);
      throw new Error(`Failed to delete multiple media: ${error.message}`);
    }
  }

  /**
   * Get optimized image URL with transformations
   * @param {String} publicId - Public ID of the image
   * @param {Object} transformations - Transformation options
   * @returns {String} Transformed image URL
   */
  getOptimizedImageUrl(publicId, transformations = {}) {
    const defaultTransformations = {
      quality: 'auto',
      fetch_format: 'auto',
      ...transformations
    };

    return cloudinary.url(publicId, defaultTransformations);
  }

  /**
   * Get thumbnail URL
   * @param {String} publicId - Public ID of the media
   * @param {Number} width - Thumbnail width
   * @param {Number} height - Thumbnail height
   * @returns {String} Thumbnail URL
   */
  getThumbnailUrl(publicId, width = 300, height = 300) {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto'
    });
  }

  /**
   * Upload multiple files
   * @param {Array} files - Array of files
   * @param {String} type - Type of media ('image' or 'video')
   * @returns {Promise<Array>} Array of upload results
   */
  async uploadMultiple(files, type = 'image') {
    try {
      const uploadPromises = files.map(file => {
        if (type === 'video') {
          return this.uploadVideo(file.buffer || file);
        }
        return this.uploadImage(file.buffer || file);
      });

      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('❌ Cloudinary multiple upload error:', error);
      throw new Error(`Failed to upload multiple files: ${error.message}`);
    }
  }

  /**
   * Extract public ID from Cloudinary URL
   * @param {String} url - Cloudinary URL
   * @returns {String} Public ID
   */
  extractPublicId(url) {
    try {
      // Extract public_id from Cloudinary URL
      // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg
      const matches = url.match(/\/v\d+\/(.+)\.\w+$/);
      if (matches && matches[1]) {
        return matches[1];
      }

      // Alternative pattern for folders
      const folderMatches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
      if (folderMatches && folderMatches[1]) {
        return folderMatches[1];
      }

      throw new Error('Could not extract public ID from URL');
    } catch (error) {
      console.error('❌ Error extracting public ID:', error);
      return null;
    }
  }
}

module.exports = new CloudinaryService();
