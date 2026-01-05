/**
 * Pinterest Service
 * Handles Pinterest OAuth and API interactions
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Pin creation and management
 * - Board management
 * - Analytics and insights
 */

const axios = require('axios');

// Pinterest API version (using Sandbox for Trial access)
const PINTEREST_API_BASE = 'https://api-sandbox.pinterest.com/v5';
const PINTEREST_OAUTH_BASE = 'https://www.pinterest.com/oauth';

/**
 * Pinterest Service Class
 */
class PinterestService {
  constructor() {
    this.clientId = process.env.PINTEREST_CLIENT_ID;
    this.clientSecret = process.env.PINTEREST_CLIENT_SECRET;
    this.redirectUri = process.env.PINTEREST_REDIRECT_URI || 'http://localhost:5000/api/social/pinterest/callback';
    
    // Pinterest scopes
    this.scopes = [
      'boards:read',
      'boards:write',
      'pins:read',
      'pins:write',
      'user_accounts:read'
    ];
  }

  /**
   * Generate Pinterest OAuth authorization URL
   * @param {string} state - Base64 encoded state containing userId
   * @returns {string} - Full authorization URL
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(','),
      state: state,
      response_type: 'code'
    });

    return `${PINTEREST_OAUTH_BASE}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} - Token response
   */
  async exchangeCodeForToken(code) {
    try {
      // Pinterest requires Basic Auth with client_id:client_secret
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        `${PINTEREST_API_BASE}/oauth/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri
        }).toString(),
        {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('✅ Pinterest: Code exchanged for token');
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in, // Usually 90 days
        tokenType: response.data.token_type,
        scope: response.data.scope
      };
    } catch (error) {
      console.error('❌ Pinterest: Token exchange failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to exchange code for token');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @returns {Promise<Object>} - New token data
   */
  async refreshAccessToken(refreshToken) {
    try {
      const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(
        `${PINTEREST_API_BASE}/oauth/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }).toString(),
        {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('✅ Pinterest: Token refreshed');
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('❌ Pinterest: Token refresh failed:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get user account information
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Object>} - User account data
   */
  async getUserAccount(accessToken) {
    try {
      const response = await axios.get(`${PINTEREST_API_BASE}/user_account`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('✅ Pinterest: User account fetched');
      return {
        username: response.data.username,
        profileImage: response.data.profile_image,
        websiteUrl: response.data.website_url,
        accountType: response.data.account_type,
        followerCount: response.data.follower_count,
        followingCount: response.data.following_count,
        pinCount: response.data.pin_count,
        monthlyViews: response.data.monthly_views
      };
    } catch (error) {
      console.error('❌ Pinterest: User account fetch failed:', error.response?.data || error.message);
      throw new Error('Failed to fetch user account');
    }
  }

  /**
   * Get user's boards
   * @param {string} accessToken - Valid access token
   * @param {number} pageSize - Number of boards to fetch
   * @returns {Promise<Array>} - Array of boards
   */
  async getUserBoards(accessToken, pageSize = 25) {
    return this.getBoards(accessToken, pageSize);
  }

  async getBoards(accessToken, pageSize = 25) {
    try {
      const response = await axios.get(`${PINTEREST_API_BASE}/boards`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          page_size: pageSize
        }
      });

      console.log(`✅ Pinterest: Found ${response.data.items?.length || 0} boards`);
      
      return (response.data.items || []).map(board => ({
        boardId: board.id,
        name: board.name,
        description: board.description,
        privacy: board.privacy,
        pinCount: board.pin_count,
        followerCount: board.follower_count
      }));
    } catch (error) {
      console.error('❌ Pinterest: Boards fetch failed:', error.response?.data || error.message);
      console.log('ℹ️ Pinterest: Boards may not be available for this account type. Returning empty array.');
      return [];
    }
  }

  /**
   * Create a new board
   * @param {string} accessToken - Valid access token
   * @param {Object} boardData - { name, description?, privacy? }
   * @returns {Promise<Object>} - Created board data
   */
  async createBoard(accessToken, boardData) {
    try {
      const response = await axios.post(
        `${PINTEREST_API_BASE}/boards`,
        {
          name: boardData.name,
          description: boardData.description || '',
          privacy: boardData.privacy || 'PUBLIC'
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Pinterest: Board created');
      return {
        boardId: response.data.id,
        name: response.data.name,
        description: response.data.description,
        privacy: response.data.privacy
      };
    } catch (error) {
      console.error('❌ Pinterest: Board creation failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create board');
    }
  }

  /**
   * Create a new pin
   * @param {string} accessToken - Valid access token
   * @param {Object} pinData - { boardId, title?, description?, link?, imageUrl or imageBase64 }
   * @returns {Promise<Object>} - Created pin data
   */
  async createPin(accessToken, pinData) {
    try {
      const payload = {
        board_id: pinData.boardId
      };

      // Add optional fields
      if (pinData.title) payload.title = pinData.title;
      if (pinData.description) payload.description = pinData.description;
      if (pinData.link) payload.link = pinData.link;
      if (pinData.altText) payload.alt_text = pinData.altText;

      // Media source - either URL or base64
      if (pinData.imageUrl) {
        payload.media_source = {
          source_type: 'image_url',
          url: pinData.imageUrl
        };
      } else if (pinData.imageBase64) {
        payload.media_source = {
          source_type: 'image_base64',
          content_type: 'image/jpeg',
          data: pinData.imageBase64
        };
      }

      const response = await axios.post(
        `${PINTEREST_API_BASE}/pins`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Pinterest: Pin created successfully');
      return {
        success: true,
        pinId: response.data.id,
        link: response.data.link,
        platform: 'pinterest'
      };
    } catch (error) {
      console.error('❌ Pinterest: Pin creation failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create pin');
    }
  }

  /**
   * Get pin analytics
   * @param {string} accessToken - Valid access token
   * @param {string} pinId - Pin ID
   * @returns {Promise<Object>} - Pin analytics
   */
  async getPinAnalytics(accessToken, pinId) {
    try {
      const response = await axios.get(
        `${PINTEREST_API_BASE}/pins/${pinId}/analytics`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Pinterest: Pin analytics fetch failed:', error.response?.data || error.message);
      throw new Error('Failed to fetch pin analytics');
    }
  }

  /**
   * Get user analytics
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Object>} - User analytics
   */
  async getUserAnalytics(accessToken) {
    try {
      // Pinterest user analytics endpoint has specific requirements
      // It may not be available for all account types
      const response = await axios.get(
        `${PINTEREST_API_BASE}/user_account/analytics`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            metric_types: 'IMPRESSION,ENGAGEMENT,PIN_CLICK,SAVE'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Pinterest: User analytics fetch failed:', error.response?.data || error.message);
      console.log('ℹ️ Pinterest: Analytics may not be available for this account type. Returning empty data.');
      // Return empty analytics instead of throwing error
      return {
        all: {
          summary_metrics: {
            IMPRESSION: 0,
            ENGAGEMENT: 0,
            PIN_CLICK: 0,
            SAVE: 0
          }
        }
      };
    }
  }

  /**
   * Get user pins
   * @param {string} accessToken - Valid access token
   * @param {number} pageSize - Number of pins to fetch
   * @returns {Promise<Array>} - Array of pins
   */
  async getUserPins(accessToken, pageSize = 25) {
    try {
      const response = await axios.get(`${PINTEREST_API_BASE}/pins`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          page_size: pageSize
        }
      });

      console.log(`✅ Pinterest: Found ${response.data.items?.length || 0} pins`);
      return response.data.items || [];
    } catch (error) {
      console.error('❌ Pinterest: Pins fetch failed:', error.response?.data || error.message);
      console.log('⚠️ Pinterest: Returning empty pins array');
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
      await this.getUserAccount(accessToken);
      return true;
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
    // Step 1: Exchange code for tokens
    const tokenData = await this.exchangeCodeForToken(code);

    // Step 2: Get user account info
    const userAccount = await this.getUserAccount(tokenData.accessToken);

    // Step 3: Get user's boards
    const boards = await this.getBoards(tokenData.accessToken);

    // Calculate expiration date (Pinterest tokens last ~90 days)
    const expiresAt = new Date(Date.now() + (tokenData.expiresIn || 7776000) * 1000);

    return {
      platform: 'pinterest',
      accountId: userAccount.username,
      accountName: userAccount.username,
      profileImage: userAccount.profileImage,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt: expiresAt,
      boards: boards,
      followerCount: userAccount.followerCount,
      followingCount: userAccount.followingCount,
      pinCount: userAccount.pinCount,
      monthlyViews: userAccount.monthlyViews,
      isActive: true,
      connectedAt: new Date()
    };
  }

  /**
   * Complete OAuth flow using an existing access token (for testing)
   * @param {string} accessToken - Pinterest access token
   * @returns {Promise<Object>} - Complete account data
   */
  async completeOAuthWithToken(accessToken) {
    // Get user account info
    const userAccount = await this.getUserAccount(accessToken);

    // Get user's boards
    const boards = await this.getBoards(accessToken);

    // Use a long expiration for test tokens
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    return {
      platform: 'pinterest',
      accountId: userAccount.username,
      accountName: userAccount.username,
      profileImage: userAccount.profileImage,
      accessToken: accessToken,
      refreshToken: null, // Test tokens don't have refresh tokens
      expiresAt: expiresAt,
      boards: boards,
      followerCount: userAccount.followerCount,
      followingCount: userAccount.followingCount,
      pinCount: userAccount.pinCount,
      monthlyViews: userAccount.monthlyViews,
      isActive: true,
      connectedAt: new Date()
    };
  }
}

// Export singleton instance
module.exports = new PinterestService();

