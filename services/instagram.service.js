/**
 * Instagram Service
 * Handles Instagram Business Account integration via Facebook Graph API
 * 
 * Note: Instagram API requires a Facebook Page connected to Instagram Business/Creator account
 * 
 * Features:
 * - Instagram Business Account connection via Facebook
 * - Media publishing (photos, videos, carousels)
 * - Stories publishing
 * - Insights and analytics
 */

const axios = require('axios');

// Facebook Graph API version (Instagram uses Facebook's Graph API)
const GRAPH_API_VERSION = 'v24.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Instagram Service Class
 */
const socialConfig = require('../config/social.config');

class InstagramService {
  constructor() {
    // Instagram uses Facebook App credentials
    this.clientId = socialConfig.instagram.clientId;
    this.clientSecret = socialConfig.instagram.clientSecret;
    this.redirectUri = socialConfig.instagram.callbackURL;
    
    // Required scopes for Instagram Business Account access
    // Note: Some scopes may require App Review for production
    this.scopes = [
      'public_profile',                    // Basic profile (no review needed)
      'pages_show_list',                   // List pages (no review needed)
      'pages_read_engagement',             // Read page content (no review needed)
      'instagram_basic',                   // Access Instagram account (requires review in production)
      'instagram_content_publish',         // Publish content to Instagram (requires review in production)
      'pages_manage_metadata',             // Manage page metadata (no review needed)
      'business_management'                // Access business assets (no review needed)
    ];
  }

  /**
   * Generate Instagram OAuth authorization URL (via Facebook)
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

    return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} - Token response
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

      console.log('✅ Instagram: Code exchanged for token');
      return response.data;
    } catch (error) {
      console.error('❌ Instagram: Token exchange failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to exchange code for token');
    }
  }

  /**
   * Get long-lived token for Instagram (via Facebook)
   * @param {string} shortLivedToken - Short-lived access token
   * @returns {Promise<Object>} - Long-lived token data
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

      console.log('✅ Instagram: Long-lived token obtained');
      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      console.error('❌ Instagram: Long-lived token failed:', error.response?.data || error.message);
      throw new Error('Failed to get long-lived token');
    }
  }

  /**
   * Get Facebook Pages connected to user
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Array>} - Array of pages with Instagram accounts
   */
  async getConnectedPages(accessToken) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/me/accounts`, {
        params: {
          fields: 'id,name,instagram_business_account,access_token',
          access_token: accessToken
        }
      });
      const pages = response.data.data || [];
      console.log('📄 Instagram: Pages data:', JSON.stringify(pages, null, 2));
      console.log(`✅ Instagram: Found ${pages.length} connected pages`);
      return pages;
    } catch (error) {
      console.error('❌ Instagram: Pages fetch failed:', error.response?.data || error.message);
      throw new Error('Failed to fetch connected pages');
    }
  }

  /**
   * Get Instagram Business Account from Page
   * @param {string} pageId - Facebook Page ID
   * @param {string} accessToken - Page or user access token
   * @returns {Promise<Object|null>} - Instagram account or null
   */
  async getInstagramBusinessAccount(pageId, pageAccessToken) {
    try {
      console.log(`🔍 Instagram: Fetching IG business account for page ${pageId}`);
      const response = await axios.get(`${GRAPH_API_BASE}/${pageId}`, {
        params: {
          fields: 'instagram_business_account{id,username,profile_picture_url,followers_count,media_count,name,biography}',
          access_token: pageAccessToken
        }
      });

      console.log('📊 Instagram: Page response:', JSON.stringify(response.data, null, 2));
      const igAccount = response.data.instagram_business_account;
      
      if (igAccount) {
        console.log(`✅ Instagram: Found business account @${igAccount.username}`);
        return {
          igId: igAccount.id,
          username: igAccount.username,
          profilePicture: igAccount.profile_picture_url,
          followersCount: igAccount.followers_count,
          mediaCount: igAccount.media_count,
          name: igAccount.name,
          biography: igAccount.biography
        };
      }

      console.log('⚠️ Instagram: No instagram_business_account field found for this page');
      return null;
    } catch (error) {
      console.error('❌ Instagram: Business account fetch failed:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Publish a photo to Instagram
   * @param {string} igUserId - Instagram Business Account ID
   * @param {string} accessToken - Valid access token
   * @param {Object} content - { imageUrl, caption }
   * @returns {Promise<Object>} - Published media info
   */
  async publishPhoto(igUserId, accessToken, content) {
    try {
      // Step 1: Create media container
      const containerResponse = await axios.post(
        `${GRAPH_API_BASE}/${igUserId}/media`,
        null,
        {
          params: {
            image_url: content.imageUrl,
            caption: content.caption || '',
            access_token: accessToken
          }
        }
      );

      const containerId = containerResponse.data.id;
      console.log('✅ Instagram: Media container created');

      // Step 2: Wait for media processing (Instagram needs time to process the image)
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 20; // Photos process faster than videos

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between checks
        
        try {
          const statusResponse = await axios.get(
            `${GRAPH_API_BASE}/${containerId}`,
            {
              params: {
                fields: 'status_code',
                access_token: accessToken
              }
            }
          );
          
          status = statusResponse.data.status_code;
          console.log(`📊 Instagram: Media status check ${attempts + 1}/${maxAttempts}: ${status}`);
          attempts++;
        } catch (statusError) {
          // If we can't check status, try to publish anyway after a brief wait
          console.log(`⚠️ Instagram: Status check failed on attempt ${attempts + 1}, will retry...`);
          attempts++;
          if (attempts >= 3) {
            // After 3 failed status checks, break and try publishing
            break;
          }
        }
      }

      if (status === 'ERROR') {
        throw new Error('Media processing failed with status: ERROR');
      }

      if (status === 'IN_PROGRESS' && attempts >= maxAttempts) {
        console.log('⚠️ Instagram: Media still processing after max attempts, attempting publish anyway...');
      }

      // Step 3: Publish the container
      const publishResponse = await axios.post(
        `${GRAPH_API_BASE}/${igUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: containerId,
            access_token: accessToken
          }
        }
      );

      console.log('✅ Instagram: Photo published successfully');
      return {
        success: true,
        mediaId: publishResponse.data.id,
        platform: 'instagram'
      };
    } catch (error) {
      console.error('❌ Instagram: Photo publish failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to publish photo');
    }
  }

  /**
   * Publish a video (Reel) to Instagram
   * @param {string} igUserId - Instagram Business Account ID
   * @param {string} accessToken - Valid access token
   * @param {Object} content - { videoUrl, caption, coverUrl? }
   * @returns {Promise<Object>} - Published media info
   */
  async publishVideo(igUserId, accessToken, content) {
    try {
      // Step 1: Create video container
      const containerParams = {
        video_url: content.videoUrl,
        caption: content.caption || '',
        media_type: 'REELS',
        access_token: accessToken
      };

      if (content.coverUrl) {
        containerParams.cover_url = content.coverUrl;
      }

      const containerResponse = await axios.post(
        `${GRAPH_API_BASE}/${igUserId}/media`,
        null,
        { params: containerParams }
      );

      const containerId = containerResponse.data.id;
      console.log('✅ Instagram: Video container created');

      // Step 2: Wait for video processing
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 30;

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const statusResponse = await axios.get(
          `${GRAPH_API_BASE}/${containerId}`,
          {
            params: {
              fields: 'status_code',
              access_token: accessToken
            }
          }
        );
        
        status = statusResponse.data.status_code;
        attempts++;
      }

      if (status !== 'FINISHED') {
        throw new Error(`Video processing failed with status: ${status}`);
      }

      // Step 3: Publish the container
      const publishResponse = await axios.post(
        `${GRAPH_API_BASE}/${igUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: containerId,
            access_token: accessToken
          }
        }
      );

      console.log('✅ Instagram: Video published successfully');
      return {
        success: true,
        mediaId: publishResponse.data.id,
        platform: 'instagram'
      };
    } catch (error) {
      console.error('❌ Instagram: Video publish failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to publish video');
    }
  }

  /**
   * Publish a carousel (multiple images/videos)
   * @param {string} igUserId - Instagram Business Account ID
   * @param {string} accessToken - Valid access token
   * @param {Object} content - { items: [{imageUrl or videoUrl}], caption }
   * @returns {Promise<Object>} - Published media info
   */
  async publishCarousel(igUserId, accessToken, content) {
    try {
      // Step 1: Create containers for each item
      const childContainerIds = [];

      for (const item of content.items) {
        const params = {
          is_carousel_item: true,
          access_token: accessToken
        };

        if (item.imageUrl) {
          params.image_url = item.imageUrl;
        } else if (item.videoUrl) {
          params.video_url = item.videoUrl;
          params.media_type = 'VIDEO';
        }

        const response = await axios.post(
          `${GRAPH_API_BASE}/${igUserId}/media`,
          null,
          { params }
        );

        childContainerIds.push(response.data.id);
      }

      console.log(`✅ Instagram: Created ${childContainerIds.length} carousel items`);

      // Step 2: Wait for all child media items to be processed
      for (let i = 0; i < childContainerIds.length; i++) {
        const containerId = childContainerIds[i];
        let status = 'IN_PROGRESS';
        let attempts = 0;
        const maxAttempts = 20;

        while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
          
          try {
            const statusResponse = await axios.get(
              `${GRAPH_API_BASE}/${containerId}`,
              {
                params: {
                  fields: 'status_code',
                  access_token: accessToken
                }
              }
            );
            
            status = statusResponse.data.status_code;
            console.log(`📊 Instagram: Carousel item ${i + 1}/${childContainerIds.length} status: ${status}`);
            attempts++;
          } catch (statusError) {
            console.log(`⚠️ Instagram: Carousel item ${i + 1} status check failed, will retry...`);
            attempts++;
            if (attempts >= 3) {
              break;
            }
          }
        }

        if (status === 'ERROR') {
          throw new Error(`Carousel item ${i + 1} processing failed`);
        }
      }

      // Step 3: Create carousel container
      const carouselResponse = await axios.post(
        `${GRAPH_API_BASE}/${igUserId}/media`,
        null,
        {
          params: {
            media_type: 'CAROUSEL',
            children: childContainerIds.join(','),
            caption: content.caption || '',
            access_token: accessToken
          }
        }
      );

      const carouselId = carouselResponse.data.id;
      console.log('✅ Instagram: Carousel container created');

      // Step 4: Wait for carousel container to be processed
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 20;

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
          const statusResponse = await axios.get(
            `${GRAPH_API_BASE}/${carouselId}`,
            {
              params: {
                fields: 'status_code',
                access_token: accessToken
              }
            }
          );
          
          status = statusResponse.data.status_code;
          console.log(`📊 Instagram: Carousel container status: ${status}`);
          attempts++;
        } catch (statusError) {
          console.log('⚠️ Instagram: Carousel container status check failed, will retry...');
          attempts++;
          if (attempts >= 3) {
            break;
          }
        }
      }

      if (status === 'ERROR') {
        throw new Error('Carousel container processing failed');
      }

      // Step 5: Publish carousel
      const publishResponse = await axios.post(
        `${GRAPH_API_BASE}/${igUserId}/media_publish`,
        null,
        {
          params: {
            creation_id: carouselId,
            access_token: accessToken
          }
        }
      );

      console.log('✅ Instagram: Carousel published successfully');
      return {
        success: true,
        mediaId: publishResponse.data.id,
        platform: 'instagram'
      };
    } catch (error) {
      console.error('❌ Instagram: Carousel publish failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to publish carousel');
    }
  }

  /**
   * Get Instagram account insights
   * @param {string} igUserId - Instagram Business Account ID
   * @param {string} accessToken - Valid access token
   * @returns {Promise<Object>} - Account insights
   */
  async getAccountInsights(igUserId, accessToken) {
    try {
      // First try to get basic account info (always works)
      const accountResponse = await axios.get(`${GRAPH_API_BASE}/${igUserId}`, {
        params: {
          fields: 'username,followers_count,follows_count,media_count,profile_picture_url',
          access_token: accessToken
        }
      });

      // Try to get insights (requires instagram_manage_insights permission)
      // Note: This requires Business or Creator account with 100+ followers
      try {
        const insightsResponse = await axios.get(`${GRAPH_API_BASE}/${igUserId}/insights`, {
          params: {
            metric: 'reach',
            period: 'day',
            access_token: accessToken
          }
        });

        console.log('✅ Instagram: Insights fetched successfully');
        return {
          account: accountResponse.data,
          insights: insightsResponse.data.data
        };
      } catch (insightsError) {
        const errorMsg = insightsError.response?.data?.error?.message || insightsError.message;
        console.log('⚠️ Instagram: Insights not available -', errorMsg);
        
        // Check if it's a follower count issue
        if (insightsError.response?.data?.error?.code === 10) {
          console.log('ℹ️ Instagram: Account needs 100+ followers for insights or requires Business/Creator account');
        }
        
        // Return just account data if insights fail
        return {
          account: accountResponse.data,
          insights: []
        };
      }
    } catch (error) {
      console.error('❌ Instagram: Account fetch failed:', error.response?.data || error.message);
      throw new Error('Failed to fetch account insights');
    }
  }

  /**
   * Get recent media from Instagram account
   * @param {string} igUserId - Instagram Business Account ID
   * @param {string} accessToken - Valid access token
   * @param {number} limit - Number of posts to fetch
   * @returns {Promise<Array>} - Recent media posts
   */
  async getRecentMedia(igUserId, accessToken, limit = 10) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/${igUserId}/media`, {
        params: {
          fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
          limit: limit,
          access_token: accessToken
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('❌ Instagram: Media fetch failed:', error.response?.data || error.message);
      throw new Error('Failed to fetch recent media');
    }
  }

  /**
   * Complete OAuth flow and get all necessary data
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} - Complete account data ready for storage
   */
  async completeOAuthFlow(code) {
    // Step 1: Exchange code for token
    const tokenData = await this.exchangeCodeForToken(code);
    const shortLivedToken = tokenData.access_token;

    // Step 2: Get long-lived token
    const longLivedData = await this.getLongLivedToken(shortLivedToken);

    // Step 3: Get connected pages
    const pages = await this.getConnectedPages(longLivedData.accessToken);

    // Step 4: Find Instagram Business Account
    let instagramAccount = null;
    let connectedPageId = null;
    let pageAccessToken = null;

    console.log(`🔍 Instagram: Checking ${pages.length} pages for Instagram Business Account...`);
    
    for (const page of pages) {
      console.log(`📄 Instagram: Checking page "${page.name}" (${page.id})`);
      
      // Try to fetch Instagram Business Account for this page
      // We always make the API call regardless of whether the field was in the initial response
      const igAccount = await this.getInstagramBusinessAccount(page.id, page.access_token);
      if (igAccount) {
        console.log('✅ Instagram: Successfully found and retrieved Instagram Business Account');
        instagramAccount = igAccount;
        connectedPageId = page.id;
        pageAccessToken = page.access_token;
        break;
      } else {
        console.log(`⚠️ Instagram: No Instagram Business Account linked to page "${page.name}"`);
      }
    }

    if (!instagramAccount) {
      throw new Error(
        'Instagram Business Account Required\n\n' +
        'To connect Instagram, you need:\n' +
        '1. Convert your Instagram account to a Business or Creator account\n' +
        '2. Link it to a Facebook Page\n' +
        '3. Make sure you are an admin of that Facebook Page\n\n' +
        'Steps:\n' +
        '• Go to Instagram Settings > Account > Switch to Professional Account\n' +
        '• In Instagram Settings > Account > Linked Accounts > Facebook\n' +
        '• Connect your Instagram to your Facebook Page'
      );
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + (longLivedData.expiresIn || 5184000) * 1000);

    return {
      platform: 'instagram',
      accountId: instagramAccount.igId,
      accountName: instagramAccount.username,
      profileImage: instagramAccount.profilePicture,
      igId: instagramAccount.igId,
      username: instagramAccount.username,
      followersCount: instagramAccount.followersCount,
      mediaCount: instagramAccount.mediaCount,
      biography: instagramAccount.biography,
      accessToken: longLivedData.accessToken,
      pageAccessToken: pageAccessToken,
      connectedPageId: connectedPageId,
      expiresAt: expiresAt,
      isActive: true,
      connectedAt: new Date()
    };
  }
}

// Export singleton instance
module.exports = new InstagramService();

