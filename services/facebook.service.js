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
      
      const pages = (response.data.data || []).map(page => ({
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        category: page.category,
        categoryList: page.category_list,
        tasks: page.tasks || [],
        picture: page.picture?.data?.url,
        fanCount: page.fan_count
      }));

      // DIAGNOSTIC: Log detailed page information including permissions
      pages.forEach((page, index) => {
        console.log(`📘 Facebook: Page ${index + 1} - Name: ${page.pageName}, ID: ${page.pageId}`);
        console.log(`📘 Facebook:   Tasks/Permissions: ${JSON.stringify(page.tasks)}`);
        console.log(`📘 Facebook:   Has CREATE_CONTENT: ${page.tasks?.includes('CREATE_CONTENT')}`);
        console.log(`📘 Facebook:   Has MANAGE_CONTENT: ${page.tasks?.includes('MANAGE_CONTENT')}`);
        console.log(`📘 Facebook:   Has MODERATE: ${page.tasks?.includes('MODERATE')}`);
        console.log(`📘 Facebook:   Has ADS_MANAGEMENT: ${page.tasks?.includes('ADS_MANAGEMENT')}`);
        console.log(`📘 Facebook:   Has ANALYZE: ${page.tasks?.includes('ANALYZE')}`);
      });

      return pages;
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
    console.log('📘 Facebook: Content type check - has photoUrl:', !!content.photoUrl, 'has message:', !!content.message, 'has link:', !!content.link);
    
    // DIAGNOSTIC: Check page settings before posting
    await this.diagnosePageSettings(pageAccessToken, pageId);
    
    try {
      // Detect if the URL is a video based on file extension
      const isVideo = content.photoUrl && (
        content.photoUrl.toLowerCase().includes('.mp4') ||
        content.photoUrl.toLowerCase().includes('.mov') ||
        content.photoUrl.toLowerCase().includes('.avi') ||
        content.photoUrl.toLowerCase().includes('video')
      );

      console.log('📘 Facebook: Media type detection - isVideo:', isVideo);

      // Video post - using two-step method for proper timeline publishing
      if (isVideo) {
        console.log('📘 Facebook: Detected video, using two-step method');
        
        // Step 1: Upload video as unpublished
        console.log('📘 Facebook: Step 1 - Uploading video as unpublished...');
        const uploadResponse = await axios.post(`${GRAPH_API_BASE}/${pageId}/videos`, null, {
          params: {
            access_token: pageAccessToken,
            file_url: content.photoUrl,
            published: false,
            description: content.message || ''
          }
        });
        
        const videoId = uploadResponse.data.id;
        console.log('📘 Facebook: Video uploaded successfully, ID:', videoId);
        
        // Step 2: Create feed post with attached video
        console.log('📘 Facebook: Step 2 - Creating feed post with attached video...');
        const feedResponse = await axios.post(`${GRAPH_API_BASE}/${pageId}/feed`, null, {
          params: {
            access_token: pageAccessToken,
            message: content.message || '',
            attached_media: JSON.stringify([{ media_fbid: videoId }])
          }
        });
        
        console.log('✅ Facebook: Video post created successfully');
        console.log('📘 Facebook: Response data:', JSON.stringify(feedResponse.data, null, 2));
        
        return {
          success: true,
          postId: feedResponse.data.id,
          platform: 'facebook'
        };
      }
      // Photo post - using two-step method for proper timeline publishing
      else if (content.photoUrl) {
        console.log('📘 Facebook: Detected photo, using two-step method');
        
        // Step 1: Upload photo as unpublished
        console.log('📘 Facebook: Step 1 - Uploading photo as unpublished...');
        const uploadResponse = await axios.post(`${GRAPH_API_BASE}/${pageId}/photos`, null, {
          params: {
            access_token: pageAccessToken,
            url: content.photoUrl,
            published: false,
            caption: content.message || ''
          }
        });
        
        const photoId = uploadResponse.data.id;
        console.log('📘 Facebook: Photo uploaded successfully, ID:', photoId);
        
        // Step 2: Create feed post with attached photo
        console.log('📘 Facebook: Step 2 - Creating feed post with attached photo...');
        const feedResponse = await axios.post(`${GRAPH_API_BASE}/${pageId}/feed`, null, {
          params: {
            access_token: pageAccessToken,
            message: content.message || '',
            attached_media: JSON.stringify([{ media_fbid: photoId }])
          }
        });
        
        console.log('✅ Facebook: Photo post created successfully');
        console.log('📘 Facebook: Response data:', JSON.stringify(feedResponse.data, null, 2));
        
        return {
          success: true,
          postId: feedResponse.data.id,
          platform: 'facebook'
        };
      }
      // Text post with optional link
      else {
        console.log('📘 Facebook: Detected text-only post, using feed endpoint');
        const params = {
          access_token: pageAccessToken
        };
        
        if (content.message) {
          params.message = content.message;
        }
        if (content.link) {
          params.link = content.link;
        }
        
        console.log('📘 Facebook: Text params:', { message: params.message, link: params.link });
        console.log('📘 Facebook: Posting to page with endpoint:', `${GRAPH_API_BASE}/${pageId}/feed`);
        
        const response = await axios.post(`${GRAPH_API_BASE}/${pageId}/feed`, null, { params });

        console.log('✅ Facebook: Text post created successfully');
        console.log('📘 Facebook: Response data:', JSON.stringify(response.data, null, 2));
        
        return {
          success: true,
          postId: response.data.id,
          platform: 'facebook'
        };
      }
    } catch (error) {
      console.error('❌ Facebook: Post failed:', error.response?.data || error.message);
      console.error('📘 Facebook: Error details:', JSON.stringify(error.response?.data, null, 2));
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
          fields: 'id,message,created_time,likes.summary(true),comments.summary(true),shares,privacy',
          limit: limit,
          access_token: pageAccessToken
        }
      });

      console.log(`✅ Facebook: Found ${response.data.data?.length || 0} posts`);
      
      // DIAGNOSTIC: Log post privacy settings
      if (response.data.data && response.data.data.length > 0) {
        response.data.data.forEach((post, index) => {
          console.log(`📘 Facebook: Post ${index + 1} - ID: ${post.id}, Privacy: ${JSON.stringify(post.privacy)}`);
        });
      }
      
      return response.data.data || [];
    } catch (error) {
      console.error('❌ Facebook: Posts fetch failed:', error.response?.data || error.message);
      console.log('⚠️ Facebook: Returning empty posts array');
      return [];
    }
  }

  /**
   * DIAGNOSTIC: Check page settings and privacy
   * @param {string} pageAccessToken - Page access token
   * @param {string} pageId - Page ID
   * @returns {Promise<Object>} - Page settings
   */
  async diagnosePageSettings(pageAccessToken, pageId) {
    try {
      console.log('📘 Facebook: DIAGNOSTIC - Checking page settings...');
      
      // Get page details
      const pageResponse = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
        params: {
          fields: 'id,name,category,about,description,link,cover,picture.type(large),fan_count,followers_count,unpublished_content_type',
          access_token: pageAccessToken
        }
      });
      
      console.log('📘 Facebook: DIAGNOSTIC - Page details:', JSON.stringify(pageResponse.data, null, 2));
      
      // Check if page is published
      console.log('📘 Facebook: DIAGNOSTIC - Page is published:', pageResponse.data.unpublished_content_type === undefined);
      
      return pageResponse.data;
    } catch (error) {
      console.error('📘 Facebook: DIAGNOSTIC - Page settings check failed:', error.response?.data || error.message);
      return null;
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

      // DIAGNOSTIC: Log token debug information
      console.log('📘 Facebook: Token debug info:', JSON.stringify(response.data.data, null, 2));
      console.log('📘 Facebook: Token is_valid:', response.data.data?.is_valid);
      console.log('📘 Facebook: Token scopes:', response.data.data?.scopes);
      console.log('📘 Facebook: Token expires_at:', response.data.data?.expires_at);
      console.log('📘 Facebook: Token granular_scopes:', JSON.stringify(response.data.data?.granular_scopes, null, 2));

      return response.data.data?.is_valid === true;
    } catch (error) {
      console.error('📘 Facebook: Token validation failed:', error.response?.data || error.message);
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

