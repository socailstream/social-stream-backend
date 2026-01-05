/**
 * Social Media OAuth Configuration
 * 
 * Environment Variables Required:
 * - FB_APP_ID: Facebook App ID
 * - FB_APP_SECRET: Facebook App Secret
 * - FB_REDIRECT_URI: Facebook OAuth callback URL
 * - PINTEREST_CLIENT_ID: Pinterest App ID
 * - PINTEREST_CLIENT_SECRET: Pinterest App Secret
 * - PINTEREST_REDIRECT_URI: Pinterest OAuth callback URL
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

module.exports = {
  /**
   * Facebook OAuth Configuration
   * Used for Facebook Pages posting
   */
  facebook: {

    clientId: process.env.FB_APP_ID,
    clientSecret: process.env.FB_APP_SECRET,
    callbackURL: `${BASE_URL}/api/social/facebook/callback`,
    authorizationURL: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenURL: 'https://graph.facebook.com/v24.0/oauth/access_token',
    graphAPI: 'https://graph.facebook.com/v24.0'
  },

  /**
   * Instagram OAuth Configuration
   * Uses Facebook OAuth (Instagram Business requires Facebook Page)
   */
  instagram: {
    // Instagram uses Facebook App credentials
    clientId: process.env.FB_APP_ID,
    clientSecret: process.env.FB_APP_SECRET,
    callbackURL: `${BASE_URL}/api/social/instagram/callback`,
    authorizationURL: 'https://www.facebook.com/v24.0/dialog/oauth',
    tokenURL: 'https://graph.facebook.com/v24.0/oauth/access_token',
    scope: [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'instagram_manage_insights',
      'pages_show_list',
      'pages_read_engagement',
      'business_management'
    ],
    graphAPI: 'https://graph.facebook.com/v24.0'
  },

  /**
   * Pinterest OAuth Configuration
   */
  pinterest: {
    clientId: process.env.PINTEREST_CLIENT_ID,
    clientSecret: process.env.PINTEREST_CLIENT_SECRET,
    callbackURL: process.env.PINTEREST_REDIRECT_URI || `${BASE_URL}/api/social/pinterest/callback`,
    authorizationURL: 'https://www.pinterest.com/oauth',
    tokenURL: 'https://api.pinterest.com/v5/oauth/token',
    scope: [
      'boards:read',
      'boards:write', 
      'pins:read',
      'pins:write',
      'user_accounts:read'
    ],
    apiURL: 'https://api.pinterest.com/v5'
  },

  /**
   * Storage configuration
   * Set to 'firestore' to use Firestore, 'mongodb' to use MongoDB
   */
  storage: process.env.SOCIAL_STORAGE || 'mongodb'
};
