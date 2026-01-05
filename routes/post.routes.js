const express = require('express');
const router = express.Router();
const postController = require('../controllers/post.controller');
const { verifyToken } = require('../middleware/auth.middleware');

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

module.exports = router;

