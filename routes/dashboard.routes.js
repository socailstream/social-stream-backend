const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All dashboard routes require authentication
router.use(verifyToken);

// Dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);
router.get('/engagement', dashboardController.getEngagementStats);
router.get('/activity', dashboardController.getRecentActivity);

module.exports = router;
