/**
 * Social Media Authentication Controller
 * 
 * Handles OAuth flows for:
 * - Facebook (Pages)
 * - Instagram (Business Accounts)
 * - Pinterest
 * 
 * Uses modular services for each platform
 */

const User = require('../models/User.model');
const socialConfig = require('../config/social.config');

// Import platform services
const facebookService = require('../services/facebook.service');
const instagramService = require('../services/instagram.service');
const pinterestService = require('../services/pinterest.service');
const firestoreService = require('../services/firestore.service');

/**
 * Helper: Generate state parameter for OAuth
 * @param {string} userId - User's MongoDB ID
 * @param {string} platform - Platform name
 * @returns {string} - Base64 encoded state
 */
const generateState = (userId, platform) => {
  return Buffer.from(JSON.stringify({
    userId: userId.toString(),
    platform: platform,
    timestamp: Date.now()
  })).toString('base64');
};

/**
 * Helper: Decode state parameter
 * @param {string} state - Base64 encoded state
 * @returns {Object} - Decoded state data
 */
const decodeState = (state) => {
  try {
    return JSON.parse(Buffer.from(state, 'base64').toString());
  } catch (error) {
    throw new Error('Invalid state parameter');
  }
};

/**
 * Helper: Save account to storage (MongoDB and optionally Firestore)
 */
const saveAccountToStorage = async (userId, platform, accountData, firebaseUid) => {
  // Save to MongoDB
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Remove existing connection for this platform
  user.connectedAccounts = user.connectedAccounts.filter(
    acc => acc.platform !== platform
  );

  // Add new connection
  user.connectedAccounts.push({
    platform: accountData.platform,
    accountId: accountData.accountId,
    accountName: accountData.accountName,
    profileImage: accountData.profileImage,
    accessToken: accountData.accessToken,
    refreshToken: accountData.refreshToken,
    expiresAt: accountData.expiresAt,
    isActive: true,
    connectedAt: accountData.connectedAt,
    // Platform-specific fields
    pageId: accountData.pages?.[0]?.pageId,
    pageAccessToken: accountData.pages?.[0]?.pageAccessToken || accountData.pageAccessToken,
    businessAccountId: accountData.igId,
    metadata: new Map(Object.entries({
      longLivedToken: accountData.longLivedToken || '',
      boards: JSON.stringify(accountData.boards || []),
      pages: JSON.stringify(accountData.pages || [])
    }))
  });

  await user.save();

  // Optionally save to Firestore
  if (socialConfig.storage === 'firestore' && firestoreService.isAvailable() && firebaseUid) {
    try {
      switch (platform) {
        case 'facebook':
          await firestoreService.saveFacebookAccount(firebaseUid, accountData);
          break;
        case 'instagram':
          await firestoreService.saveInstagramAccount(firebaseUid, accountData);
          break;
        case 'pinterest':
          await firestoreService.savePinterestAccount(firebaseUid, accountData);
          break;
      }
    } catch (err) {
      console.error('Firestore save error (non-critical):', err.message);
    }
  }
};

/**
 * Helper: Generate success HTML page
 */
const getSuccessHTML = (platform, accountName) => {
  const colors = {
    facebook: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    instagram: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    pinterest: '#E60023'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${platform.charAt(0).toUpperCase() + platform.slice(1)} Connected</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: ${colors[platform]};
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          max-width: 400px;
          width: 100%;
        }
        .success-icon {
          width: 80px;
          height: 80px;
          background: #4CAF50;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          animation: scaleIn 0.3s ease-out;
        }
        .success-icon svg {
          width: 40px;
          height: 40px;
          fill: white;
        }
        @keyframes scaleIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        h1 {
          color: #1a1a1a;
          font-size: 24px;
          margin-bottom: 12px;
        }
        .account-name {
          color: #666;
          font-size: 16px;
          margin-bottom: 8px;
        }
        p {
          color: #888;
          font-size: 14px;
          line-height: 1.5;
        }
        .countdown {
          margin-top: 20px;
          padding: 12px 24px;
          background: #f5f5f5;
          border-radius: 8px;
          color: #666;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 32px;
          background: ${platform === 'pinterest' ? '#E60023' : '#667eea'};
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <h1>${platform.charAt(0).toUpperCase() + platform.slice(1)} Connected!</h1>
        <p class="account-name">${accountName || 'Account'}</p>
        <p>Your account has been linked successfully.<br>You can close this window and return to the app.</p>
        <div class="countdown">Closing in <span id="timer">5</span> seconds...</div>
        <a href="#" class="button" onclick="window.close(); return false;">Close Window</a>
      </div>
      <script>
        // Try to redirect to app deep link
        const deepLink = 'socialstream://callback/${platform}?success=true';
        window.location.href = deepLink;
        
        // Fallback countdown for web
        let seconds = 5;
        const timer = document.getElementById('timer');
        const countdown = setInterval(() => {
          seconds--;
          timer.textContent = seconds;
          if (seconds <= 0) {
            clearInterval(countdown);
            window.close();
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;
};

/**
 * Helper: Generate error HTML page
 */
const getErrorHTML = (platform, errorMessage) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connection Failed</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: #f5f5f5;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
        }
        .error-icon {
          width: 80px;
          height: 80px;
          background: #f44336;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        .error-icon svg {
          width: 40px;
          height: 40px;
          fill: white;
        }
        h1 {
          color: #1a1a1a;
          font-size: 24px;
          margin-bottom: 12px;
        }
        .error-message {
          color: #f44336;
          font-size: 14px;
          padding: 12px;
          background: #ffebee;
          border-radius: 8px;
          margin-bottom: 16px;
          word-break: break-word;
        }
        p {
          color: #888;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 32px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-icon">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </div>
        <h1>Connection Failed</h1>
        <div class="error-message">${errorMessage}</div>
        <p>Please try again or contact support if the problem persists.</p>
        <a href="#" class="button" onclick="window.close(); return false;">Close Window</a>
      </div>
    </body>
    </html>
  `;
};

// ===========================================
// GET CONNECTED ACCOUNTS
// ===========================================

/**
 * Get all connected accounts for current user
 * GET /api/social/accounts
 */
exports.getConnectedAccounts = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const user = await User.findById(req.user._id).select('connectedAccounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`📊 User ${req.user._id} has ${user.connectedAccounts?.length || 0} connected accounts`);
    
    // Return accounts without sensitive tokens
    const accounts = (user.connectedAccounts || []).map(account => ({
      platform: account.platform,
      accountId: account.accountId,
      accountName: account.accountName,
      profileImage: account.profileImage || null,
      isActive: account.isActive !== undefined ? account.isActive : true,
      connectedAt: account.connectedAt,
      expiresAt: account.expiresAt || null
    }));
    
    console.log(`✅ Returning ${accounts.length} accounts:`, accounts.map(a => `${a.platform}: ${a.accountName}`).join(', '));
    
    res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts
    });
  } catch (error) {
    console.error('❌ Error fetching connected accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching connected accounts',
      error: error.message
    });
  }
};

// ===========================================
// FACEBOOK
// ===========================================

/**
 * Initiate Facebook OAuth
 * GET /api/social/facebook/connect
 */
exports.connectFacebook = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const state = generateState(req.user._id, 'facebook');
    const authUrl = facebookService.getAuthorizationUrl(state);
    console.log(authUrl)
    console.log('📱 Facebook: OAuth initiated for user:', req.user._id);
    
    res.status(200).json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('❌ Facebook connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating Facebook connection',
      error: error.message
    });
  }
};

/**
 * Facebook OAuth callback
 * GET /api/social/facebook/callback
 */
exports.facebookCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;
    
    // Handle OAuth errors (user denied permission, etc.)
    if (oauthError) {
      console.error('❌ Facebook OAuth error:', oauthError, error_description);
      return res.status(400).send(getErrorHTML('facebook', error_description || oauthError));
    }

    // Validate required parameters
    if (!code) {
      return res.status(400).send(getErrorHTML('facebook', 'Authorization code not received'));
    }
    
    if (!state) {
      return res.status(400).send(getErrorHTML('facebook', 'State parameter missing'));
    }

    // Decode state
    const stateData = decodeState(state);
    const userId = stateData.userId;

    console.log('📱 Facebook: Processing callback for user:', userId);

    // Check if this code was already processed
    if (global.processedFacebookCodes && global.processedFacebookCodes.has(code)) {
      console.log('⚠️ Facebook: Code already processed, skipping');
      return res.send(getSuccessHTML('facebook', 'Already connected'));
    }

    // Track this code
    if (!global.processedFacebookCodes) {
      global.processedFacebookCodes = new Set();
    }
    global.processedFacebookCodes.add(code);

    // Clean up after 5 minutes
    setTimeout(() => {
      if (global.processedFacebookCodes) {
        global.processedFacebookCodes.delete(code);
      }
    }, 5 * 60 * 1000);

    // Complete OAuth flow using service
    const accountData = await facebookService.completeOAuthFlow(code);

    // Get user for Firebase UID
    const user = await User.findById(userId);
    const firebaseUid = user?.firebaseUid;

    // Save to storage
    await saveAccountToStorage(userId, 'facebook', accountData, firebaseUid);

    console.log('✅ Facebook: Account connected successfully for user:', userId);
    console.log('📊 Account data saved:', {
      platform: accountData.platform,
      accountId: accountData.accountId,
      accountName: accountData.accountName
    });
    
    // Return success JSON for mobile, HTML for web
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('Dart') || userAgent.includes('Flutter')) {
      // Mobile app request
      res.json({
        success: true,
        message: 'Facebook account connected successfully',
        account: {
          platform: 'facebook',
          accountName: accountData.accountName,
          accountId: accountData.accountId
        }
      });
    } else {
      // Web request
      res.send(getSuccessHTML('facebook', accountData.accountName));
    }
    
  } catch (error) {
    console.error('❌ Facebook callback error:', error);
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('Dart') || userAgent.includes('Flutter')) {
      // Mobile app request
      res.status(500).json({
        success: false,
        message: 'Failed to connect Facebook account',
        error: error.message
      });
    } else {
      // Web request
      res.status(500).send(getErrorHTML('facebook', error.message));
    }
  }
};

/**
 * Disconnect Facebook
 * DELETE /api/social/facebook/disconnect
 */
exports.disconnectFacebook = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove from MongoDB
    user.connectedAccounts = user.connectedAccounts.filter(
      acc => acc.platform !== 'facebook'
    );
    await user.save();

    // Remove from Firestore if enabled
    if (socialConfig.storage === 'firestore' && firestoreService.isAvailable() && user.firebaseUid) {
      try {
        await firestoreService.disconnectAccount(user.firebaseUid, 'facebook');
      } catch (err) {
        console.error('Firestore disconnect error (non-critical):', err.message);
      }
    }

    console.log('✅ Facebook: Account disconnected for user:', req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Facebook account disconnected successfully'
    });
  } catch (error) {
    console.error('❌ Facebook disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error disconnecting Facebook',
      error: error.message
    });
  }
};

// ===========================================
// INSTAGRAM
// ===========================================

/**
 * Initiate Instagram OAuth
 * GET /api/social/instagram/connect
 */
exports.connectInstagram = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const state = generateState(req.user._id, 'instagram');
    const authUrl = instagramService.getAuthorizationUrl(state);
    
    console.log('📸 Instagram: OAuth initiated for user:', req.user._id);
    
    res.status(200).json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('❌ Instagram connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating Instagram connection',
      error: error.message
    });
  }
};

/**
 * Instagram OAuth callback
 * GET /api/social/instagram/callback
 */
exports.instagramCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      console.error('❌ Instagram OAuth error:', oauthError, error_description);
      return res.status(400).send(getErrorHTML('instagram', error_description || oauthError));
    }

    // Validate required parameters
    if (!code) {
      return res.status(400).send(getErrorHTML('instagram', 'Authorization code not received'));
    }
    
    if (!state) {
      return res.status(400).send(getErrorHTML('instagram', 'State parameter missing'));
    }

    // Decode state
    const stateData = decodeState(state);
    const userId = stateData.userId;

    console.log('📸 Instagram: Processing callback for user:', userId);

    // Check if this code was already processed (prevent duplicate processing)
    if (global.processedInstagramCodes && global.processedInstagramCodes.has(code)) {
      console.log('⚠️ Instagram: Code already processed, skipping');
      return res.send(getSuccessHTML('instagram', 'Already connected'));
    }

    // Track this code
    if (!global.processedInstagramCodes) {
      global.processedInstagramCodes = new Set();
    }
    global.processedInstagramCodes.add(code);

    // Clean up old codes after 5 minutes
    setTimeout(() => {
      if (global.processedInstagramCodes) {
        global.processedInstagramCodes.delete(code);
      }
    }, 5 * 60 * 1000);

    // Complete OAuth flow using service
    const accountData = await instagramService.completeOAuthFlow(code);

    // Get user for Firebase UID
    const user = await User.findById(userId);
    const firebaseUid = user?.firebaseUid;

    // Save to storage
    await saveAccountToStorage(userId, 'instagram', accountData, firebaseUid);

    console.log('✅ Instagram: Account connected successfully');
    
    // Return success JSON for mobile, HTML for web
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('Dart') || userAgent.includes('Flutter')) {
      // Mobile app request
      res.json({
        success: true,
        message: 'Instagram account connected successfully',
        account: {
          platform: 'instagram',
          accountName: `@${accountData.username}`,
          accountId: accountData.accountId
        }
      });
    } else {
      // Web request
      res.send(getSuccessHTML('instagram', `@${accountData.username}`));
    }
    
  } catch (error) {
    console.error('❌ Instagram callback error:', error);
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('Dart') || userAgent.includes('Flutter')) {
      // Mobile app request
      res.status(500).json({
        success: false,
        message: 'Failed to connect Instagram account',
        error: error.message
      });
    } else {
      // Web request
      res.status(500).send(getErrorHTML('instagram', error.message));
    }
  }
};

/**
 * Disconnect Instagram
 * DELETE /api/social/instagram/disconnect
 */
exports.disconnectInstagram = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove from MongoDB
    user.connectedAccounts = user.connectedAccounts.filter(
      acc => acc.platform !== 'instagram'
    );
    await user.save();

    // Remove from Firestore if enabled
    if (socialConfig.storage === 'firestore' && firestoreService.isAvailable() && user.firebaseUid) {
      try {
        await firestoreService.disconnectAccount(user.firebaseUid, 'instagram');
      } catch (err) {
        console.error('Firestore disconnect error (non-critical):', err.message);
      }
    }

    console.log('✅ Instagram: Account disconnected for user:', req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Instagram account disconnected successfully'
    });
  } catch (error) {
    console.error('❌ Instagram disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error disconnecting Instagram',
      error: error.message
    });
  }
};

// ===========================================
// PINTEREST
// ===========================================

/**
 * Initiate Pinterest OAuth
 * GET /api/social/pinterest/connect
 */
exports.connectPinterest = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if we have a test access token for development
    const testToken = process.env.PINTEREST_TEST_ACCESS_TOKEN;
    if (testToken) {
      console.log('📌 Pinterest: Using test access token (pending account) for user:', req.user._id);
      
      // Since the developer account is pending, we can't make API calls
      // Save a mock connection for testing purposes
      try {
        const accountData = {
          platform: 'pinterest',
          accountId: 'test_pinterest_account',
          accountName: 'Pinterest (Test Mode)',
          profileImage: null,
          accessToken: testToken,
          refreshToken: null,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          boards: [],
          followerCount: 0,
          followingCount: 0,
          pinCount: 0,
          monthlyViews: 0,
          isActive: true,
          connectedAt: new Date()
        };
        
        // Get user for Firebase UID
        const user = await User.findById(req.user._id);
        const firebaseUid = user?.firebaseUid;

        // Save to storage
        await saveAccountToStorage(req.user._id, 'pinterest', accountData, firebaseUid);

        console.log('✅ Pinterest: Test account connected (API access pending approval)');
        
        return res.status(200).json({
          success: true,
          message: 'Pinterest connected in test mode (Developer account pending)',
          account: {
            platform: 'pinterest',
            accountName: accountData.accountName,
            accountId: accountData.accountId
          }
        });
      } catch (error) {
        console.error('❌ Pinterest test connection error:', error);
        return res.status(500).json({
          success: false,
          message: 'Error connecting test account',
          error: error.message
        });
      }
    }

    // Normal OAuth flow
    const state = generateState(req.user._id, 'pinterest');
    const authUrl = pinterestService.getAuthorizationUrl(state);
    
    console.log('📌 Pinterest: OAuth initiated for user:', req.user._id);
    
    res.status(200).json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('❌ Pinterest connect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating Pinterest connection',
      error: error.message
    });
  }
};

/**
 * Pinterest OAuth callback
 * GET /api/social/pinterest/callback
 */
exports.pinterestCallback = async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;
    
    // Handle OAuth errors
    if (oauthError) {
      console.error('❌ Pinterest OAuth error:', oauthError, error_description);
      return res.status(400).send(getErrorHTML('pinterest', error_description || oauthError));
    }

    // Validate required parameters
    if (!code) {
      return res.status(400).send(getErrorHTML('pinterest', 'Authorization code not received'));
    }
    
    if (!state) {
      return res.status(400).send(getErrorHTML('pinterest', 'State parameter missing'));
    }

    // Decode state
    const stateData = decodeState(state);
    const userId = stateData.userId;

    console.log('📌 Pinterest: Processing callback for user:', userId);

    // Check if this code was already processed
    if (global.processedPinterestCodes && global.processedPinterestCodes.has(code)) {
      console.log('⚠️ Pinterest: Code already processed, skipping');
      return res.send(getSuccessHTML('pinterest', 'Already connected'));
    }

    // Track this code
    if (!global.processedPinterestCodes) {
      global.processedPinterestCodes = new Set();
    }
    global.processedPinterestCodes.add(code);

    // Clean up after 5 minutes
    setTimeout(() => {
      if (global.processedPinterestCodes) {
        global.processedPinterestCodes.delete(code);
      }
    }, 5 * 60 * 1000);

    // Complete OAuth flow using service
    const accountData = await pinterestService.completeOAuthFlow(code);

    // Get user for Firebase UID
    const user = await User.findById(userId);
    const firebaseUid = user?.firebaseUid;

    // Save to storage
    await saveAccountToStorage(userId, 'pinterest', accountData, firebaseUid);

    console.log('✅ Pinterest: Account connected successfully');
    
    // Return success page
    res.send(getSuccessHTML('pinterest', accountData.accountName));
    
  } catch (error) {
    console.error('❌ Pinterest callback error:', error);
    res.status(500).send(getErrorHTML('pinterest', error.message));
  }
};

/**
 * Disconnect Pinterest
 * DELETE /api/social/pinterest/disconnect
 */
exports.disconnectPinterest = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove from MongoDB
    user.connectedAccounts = user.connectedAccounts.filter(
      acc => acc.platform !== 'pinterest'
    );
    await user.save();

    // Remove from Firestore if enabled
    if (socialConfig.storage === 'firestore' && firestoreService.isAvailable() && user.firebaseUid) {
      try {
        await firestoreService.disconnectAccount(user.firebaseUid, 'pinterest');
      } catch (err) {
        console.error('Firestore disconnect error (non-critical):', err.message);
      }
    }

    console.log('✅ Pinterest: Account disconnected for user:', req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Pinterest account disconnected successfully'
    });
  } catch (error) {
    console.error('❌ Pinterest disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Error disconnecting Pinterest',
      error: error.message
    });
  }
};

// ===========================================
// POSTING ENDPOINTS (Bonus)
// ===========================================

/**
 * Post to Facebook Page
 * POST /api/social/facebook/post
 */
exports.postToFacebook = async (req, res) => {
  try {
    const { message, link, photoUrl } = req.body;
    
    if (!message && !photoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Message or photo URL is required'
      });
    }

    const user = await User.findById(req.user._id);
    const fbAccount = user.connectedAccounts.find(acc => acc.platform === 'facebook');
    
    if (!fbAccount || !fbAccount.pageId) {
      return res.status(400).json({
        success: false,
        message: 'No Facebook Page connected'
      });
    }

    const result = await facebookService.postToPage(
      fbAccount.pageAccessToken,
      fbAccount.pageId,
      { message, link, photoUrl }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Facebook post error:', error);
    res.status(500).json({
      success: false,
      message: 'Error posting to Facebook',
      error: error.message
    });
  }
};

/**
 * Post to Instagram
 * POST /api/social/instagram/post
 */
exports.postToInstagram = async (req, res) => {
  try {
    const { imageUrl, caption } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required for Instagram posts'
      });
    }

    const user = await User.findById(req.user._id);
    const igAccount = user.connectedAccounts.find(acc => acc.platform === 'instagram');
    
    if (!igAccount || !igAccount.businessAccountId) {
      return res.status(400).json({
        success: false,
        message: 'No Instagram Business Account connected'
      });
    }

    const result = await instagramService.publishPhoto(
      igAccount.businessAccountId,
      igAccount.accessToken,
      { imageUrl, caption }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Instagram post error:', error);
    res.status(500).json({
      success: false,
      message: 'Error posting to Instagram',
      error: error.message
    });
  }
};

/**
 * Create Pinterest Pin
 * POST /api/social/pinterest/post
 */
exports.postToPinterest = async (req, res) => {
  try {
    const { boardId, title, description, link, imageUrl } = req.body;
    
    if (!boardId || !imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Board ID and image URL are required'
      });
    }

    const user = await User.findById(req.user._id);
    const pinAccount = user.connectedAccounts.find(acc => acc.platform === 'pinterest');
    
    if (!pinAccount) {
      return res.status(400).json({
        success: false,
        message: 'No Pinterest account connected'
      });
    }

    const result = await pinterestService.createPin(
      pinAccount.accessToken,
      { boardId, title, description, link, imageUrl }
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Pinterest post error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating Pinterest pin',
      error: error.message
    });
  }
};
