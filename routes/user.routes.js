const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Protected routes - require authentication
router.get('/me', verifyToken, userController.getCurrentUser);
router.put('/me', verifyToken, userController.updateCurrentUser);
router.get('/:id', verifyToken, userController.getUserById);

module.exports = router;

