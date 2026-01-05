/**
 * Social Media Routes
 * 
 * OAuth & Account Management:
 * - GET  /accounts                     - Get all connected accounts
 * - GET  /{platform}/connect           - Initiate OAuth flow
 * - GET  /{platform}/callback          - OAuth callback (handles redirect from platform)
 * - DELETE /{platform}/disconnect      - Remove connected account
 * 
 * Posting:
 * - POST /{platform}/post              - Create a post on the platform
 * 
 * Platforms: facebook, instagram, pinterest
 */

const express = require('express');
const router = express.Router();
const socialController = require('../controllers/social.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// ===========================================
// Account Management
// ===========================================

// Get all connected accounts (requires auth)
router.get('/accounts', verifyToken, socialController.getConnectedAccounts);

// ===========================================
// Facebook Routes
// ===========================================

// Initiate Facebook OAuth (requires auth)
router.get('/facebook/connect', verifyToken, socialController.connectFacebook);

// Facebook OAuth callback (NO auth - user redirected from Facebook)
router.get('/facebook/callback', socialController.facebookCallback);

// Disconnect Facebook account (requires auth)
router.delete('/facebook/disconnect', verifyToken, socialController.disconnectFacebook);

// Post to Facebook Page (requires auth)
router.post('/facebook/post', verifyToken, socialController.postToFacebook);

// ===========================================
// Instagram Routes
// ===========================================

// Initiate Instagram OAuth (requires auth)
router.get('/instagram/connect', verifyToken, socialController.connectInstagram);

// Instagram OAuth callback (NO auth - user redirected from Facebook/Instagram)
router.get('/instagram/callback', socialController.instagramCallback);

// Disconnect Instagram account (requires auth)
router.delete('/instagram/disconnect', verifyToken, socialController.disconnectInstagram);

// Post to Instagram (requires auth)
router.post('/instagram/post', verifyToken, socialController.postToInstagram);

// ===========================================
// Pinterest Routes
// ===========================================

// Initiate Pinterest OAuth (requires auth)
router.get('/pinterest/connect', verifyToken, socialController.connectPinterest);

// Pinterest OAuth callback (NO auth - user redirected from Pinterest)
router.get('/pinterest/callback', socialController.pinterestCallback);

// Disconnect Pinterest account (requires auth)
router.delete('/pinterest/disconnect', verifyToken, socialController.disconnectPinterest);

// Post to Pinterest (requires auth)
router.post('/pinterest/post', verifyToken, socialController.postToPinterest);

module.exports = router;
