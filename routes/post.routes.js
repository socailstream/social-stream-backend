const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const schedulerService = require('../services/scheduler.service');

// All post routes require authentication
router.use(verifyToken);

// Post CRUD routes
router.get('/', postController.getAllPosts);
router.get('/my-posts', postController.getMyPosts);
router.get('/scheduled', postController.getScheduledPosts);
router.get('/by-date-range', postController.getPostsByDateRange);
router.get('/:id', postController.getPostById);
router.post('/', postController.createPost);
router.put('/:id', postController.updatePost);
router.delete('/:id', postController.deletePost);

// Post actions
router.post('/:id/like', postController.likePost);

// Publish to social media
router.post('/publish', postController.publishToSocialMedia);

// Debug endpoint to manually trigger scheduler check
router.post('/debug/trigger-scheduler', async (req, res) => {
  try {
    console.log('\n🔧 [DEBUG] Manual scheduler trigger requested by user:', req.user._id);
    await schedulerService.checkScheduledPosts();
    res.status(200).json({
      success: true,
      message: 'Scheduler check triggered manually'
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error triggering scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering scheduler',
      error: error.message
    });
  }
});

// Debug endpoint to view all scheduled posts in database
router.get('/debug/scheduled-posts', async (req, res) => {
  try {
    const Post = require('../models/Post.model');
    const now = new Date();
    
    const allScheduledPosts = await Post.find({ status: 'scheduled' })
      .populate('user', 'displayName email')
      .sort({ scheduledDate: 1 });
    
    const readyToPost = await Post.find({
      status: 'scheduled',
      scheduledDate: { $lte: now }
    }).populate('user', 'displayName email');
    
    // Format posts with local time
    const formattedPosts = allScheduledPosts.map(post => ({
      ...post.toObject(),
      scheduledDateISO: post.scheduledDate.toISOString(),
      scheduledDateLocal: post.scheduledDate.toLocaleString(),
      timeUntilScheduled: post.scheduledDate - now,
      isReady: post.scheduledDate <= now
    }));
    
    res.status(200).json({
      success: true,
      timezone: process.env.TZ || 'UTC',
      currentTime: now.toISOString(),
      currentTimeLocal: now.toLocaleString(),
      allScheduledPosts: {
        count: allScheduledPosts.length,
        data: formattedPosts
      },
      readyToPost: {
        count: readyToPost.length,
        data: readyToPost
      }
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error fetching scheduled posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching scheduled posts',
      error: error.message
    });
  }
});

module.exports = router;

