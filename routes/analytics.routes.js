/**
 * Analytics Routes
 * 
 * Engagement Metrics & Insights:
 * - GET  /overview              - Get overview analytics across all platforms
 * - GET  /facebook              - Get Facebook page metrics
 * - GET  /instagram             - Get Instagram account metrics
 * - GET  /pinterest             - Get Pinterest account metrics
 * - GET  /post/:postId          - Get metrics for a specific post
 * - GET  /trends                - Get engagement trends over time
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All analytics routes require authentication
router.use(verifyToken);

// Overview analytics
router.get('/overview', analyticsController.getOverview);

// Platform-specific analytics
router.get('/facebook', analyticsController.getFacebookMetrics);
router.get('/instagram', analyticsController.getInstagramMetrics);
router.get('/pinterest', analyticsController.getPinterestMetrics);

// Post-specific metrics
router.get('/post/:postId', analyticsController.getPostMetrics);

// Trends and time series data
router.get('/trends', analyticsController.getTrends);

module.exports = router;
