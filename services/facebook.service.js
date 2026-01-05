/**
 * Facebook Service
 * Handles all Facebook OAuth and Graph API interactions
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Short-lived to Long-lived token exchange
 * - Facebook Pages management
 * - Page posting capabilities
 */

const axios = require('axios');

// Facebook Graph API version
const GRAPH_API_VERSION = 'v24.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Facebook Service Class
 */
class FacebookService {
  constructor() {
    this.clientId = process.env.FB_APP_ID;
    this.clientSecret = process.env.FB_APP_SECRET;
    this.redirectUri = process.env.FB_REDIRECT_URI || 'http://localhost:5000/api/social/facebook/callback';
    // Using permissions that work without App Review for development
    // These are the minimal permissions that work in development mode
    this.scopes = [
      'public_profile',     // Basic profile info (no review needed)
      'pages_show_list'     // List pages user manages (no review needed)
    ];
  }

  /**
   * Generate Facebook OAuth authorization URL
   * @param {string} state - Base64 encoded state containing userId
   * @returns {string} - Full authorization URL
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(','),
      state: state,
      response_type: 'code',
      auth_type: 'rerequest' // Re-request permissions if previously declined
    });

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} - Token response with access_token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code: code
        }
      });

      console.log('✅ Facebook: Code exchanged for token');
      return response.data;
    } catch (error) {
      console.error('❌ Facebook: Token exchange failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to exchange code for token');
    }
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   * @param {string} shortLivedToken - Short-lived access token
   * @returns {Promise<Object>} - Long-lived token response
   */
  async getLongLivedToken(shortLivedToken) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          fb_exchange_token: shortLivedToken
        }
      });

      console.log('✅ Facebook: Long-lived token obtained');
      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in, // Usually 5184000 seconds (60 days)
        tokenType: response.data.token_type
      };
    } catch (error) {
      console.error('❌ Facebook: Long-lived token exchange failed:', error.response?.data || error.message);
      throw new Error('Failed to get long-lived token');
    }
  }

  /**
   * Get user profile information
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Object>} - User profile data
   */
  async getUserProfile(accessToken) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/me`, {
        params: {
          fields: 'id,name,email,picture.type(large)',
          access_token: accessToken
        }
      });

      console.log('✅ Facebook: User profile fetched');
      return {
        id: response.data.id,
        name: response.data.name,
        email: response.data.email,
        picture: response.data.picture?.data?.url
      };
    } catch (error) {
      console.error('❌ Facebook: Profile fetch failed:', error.response?.data || error.message);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Get user's Facebook Pages
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Array>} - Array of page objects
   */
  async getUserPages(accessToken) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
        params: {
          fields: 'id,name,access_token,category,category_list,tasks,picture.type(large),fan_count',
          access_token: accessToken
        }
      });

      console.log(`✅ Facebook: Found ${response.data.data?.length || 0} pages`);
      
      return (response.data.data || []).map(page => ({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        category: page.category,
        categoryList: page.category_list,
        tasks: page.tasks || [],
        picture: page.picture?.data?.url,
        fanCount: page.fan_count
      }));
    } catch (error) {
      console.error('❌ Facebook: Pages fetch failed:', error.response?.data || error.message);
      throw new Error('Failed to fetch Facebook pages');
    }
  }

  /**
   * Post content to a Facebook Page
   * @param {string} pageAccessToken - Page access token
   * @param {string} pageId - Facebook Page ID
   * @param {Object} content - Post content { message, link?, photoUrl? }
   * @returns {Promise<Object>} - Post response with post ID
   */
  async postToPage(pageAccessToken, pageId, content) {
    console.log('📘 Facebook: Preparing to post to page...', { pageId, content });
    try {
      let endpoint = `${GRAPH_API_BASE}/${pageId}/feed`;
      const params = {
        access_token: pageAccessToken
      };

      // Detect if the URL is a video based on file extension
      const isVideo = content.photoUrl && (
        content.photoUrl.toLowerCase().includes('.mp4') ||
        content.photoUrl.toLowerCase().includes('.mov') ||
        content.photoUrl.toLowerCase().includes('.avi') ||
        content.photoUrl.toLowerCase().includes('video')
      );

      // Video post
      if (isVideo) {
        console.log('📘 Facebook: Detected video, using videos endpoint');
        endpoint = `${GRAPH_API_BASE}/${pageId}/videos`;
        params.file_url = content.photoUrl;
        if (content.message) {
          params.description = content.message;
        }
        console.log('📘 Facebook: Posting video to:', endpoint);
      }
      // Photo post
      else if (content.photoUrl) {
        console.log('📘 Facebook: Detected photo, using photos endpoint');
        endpoint = `${GRAPH_API_BASE}/${pageId}/photos`;
        params.url = content.photoUrl;
        if (content.message) {
          params.caption = content.message;
        }
      }
      // Text post with optional link
      else {
        if (content.message) {
          params.message = content.message;
        }
        if (content.link) {
          params.link = content.link;
        }
      }

      console.log('📘 Facebook: Posting to page with endpoint:', endpoint);
      const response = await axios.post(endpoint, null, { params });

      console.log('✅ Facebook: Posted to page successfully');
      return {
        success: true,
        postId: response.data.id || response.data.post_id,
        platform: 'facebook'
      };
    } catch (error) {
      console.error('❌ Facebook: Post failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to post to Facebook');
    }
  }

  /**
   * Get page insights/analytics
   * @param {string} pageAccessToken - Page access token
   * @param {string} pageId - Facebook Page ID
   * @returns {Promise<Object>} - Page insights data
   */
  async getPageInsights(pageAccessToken, pageId) {
    try {
      console.log('📊 Facebook: Fetching insights for page:', pageId);
      
      // Get basic page data first
      const pageResponse = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
        params: {
          fields: 'fan_count,name,followers_count',
          access_token: pageAccessToken
        }
      });
      console.log('✅ Facebook: Basic page data:', pageResponse.data);
      
      // Try to get page insights using correct API format
      // Using valid metrics: page_impressions_unique (reach)
      try {
        const insightsResponse = await axios.get(`${GRAPH_API_BASE}/${pageId}/insights`, {
          params: {
            metric: 'page_impressions_unique',
            access_token: pageAccessToken
          }
        });
        
        console.log('✅ Facebook: Insights fetched successfully');
        
        // Combine basic page data with insights
        // Extract only day period from insights
        const dayInsights = insightsResponse.data.data
          .filter(insight => insight.period === 'day')
          .map(insight => ({
            name: insight.name,
            period: insight.period,
            values: insight.values
          }));
        
        // Add fan count
        const combinedData = [
          {
            name: 'page_fans',
            period: 'day',
            values: [{ value: pageResponse.data.fan_count || pageResponse.data.followers_count || 0 }]
          },
          ...dayInsights
        ];
        
        return combinedData;
        
      } catch (insightsError) {
        console.log('⚠️ Facebook: Insights API not available:', insightsError.response?.data?.error?.message || insightsError.message);
        console.log('ℹ️ Facebook: Returning basic page metrics only');
        
        // Return just fan count if insights fail
        return [{
          name: 'page_fans',
          period: 'day',
          values: [{ value: pageResponse.data.fan_count || pageResponse.data.followers_count || 0 }]
        }];
      }
      
    } catch (error) {
      console.error('❌ Facebook: Page data fetch failed:', error.response?.data || error.message);
      console.log('⚠️ Facebook: Returning empty insights');
      return [];
    }
  }

  /**
   * Get page posts
   * @param {string} pageAccessToken - Page access token
   * @param {string} pageId - Page ID
   * @param {number} limit - Number of posts to fetch
   * @returns {Promise<Array>} - Array of posts
   */
  async getPagePosts(pageAccessToken, pageId, limit = 10) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/${pageId}/posts`, {
        params: {
          fields: 'id,message,created_time,likes.summary(true),comments.summary(true),shares',
          limit: limit,
          access_token: pageAccessToken
        }
      });

      console.log(`✅ Facebook: Found ${response.data.data?.length || 0} posts`);
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Facebook: Posts fetch failed:', error.response?.data || error.message);
      console.log('⚠️ Facebook: Returning empty posts array');
      return [];
    }
  }

  /**
   * Validate access token
   * @param {string} accessToken - Token to validate
   * @returns {Promise<boolean>} - Whether token is valid
   */
  async validateToken(accessToken) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${this.clientId}|${this.clientSecret}`
        }
      });

      return response.data.data?.is_valid === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Complete OAuth flow and get all necessary data
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} - Complete account data ready for storage
   */
  async completeOAuthFlow(code) {
    // Step 1: Exchange code for short-lived token
    const tokenData = await this.exchangeCodeForToken(code);
    const shortLivedToken = tokenData.access_token;

    // Step 2: Get long-lived token
    const longLivedData = await this.getLongLivedToken(shortLivedToken);

    // Step 3: Get user profile
    const profile = await this.getUserProfile(longLivedData.accessToken);

    // Step 4: Get user pages
    const pages = await this.getUserPages(longLivedData.accessToken);

    // Calculate expiration date (60 days from now)
    const expiresAt = new Date(Date.now() + (longLivedData.expiresIn || 5184000) * 1000);

    return {
      platform: 'facebook',
      accountId: profile.id,
      accountName: profile.name,
      profileImage: profile.picture,
      email: profile.email,
      accessToken: longLivedData.accessToken,
      longLivedToken: longLivedData.accessToken,
      expiresAt: expiresAt,
      pages: pages,
      isActive: true,
      connectedAt: new Date()
    };
  }
}

// Export singleton instance
module.exports = new FacebookService();

