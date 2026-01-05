/**
 * Analytics Controller
 * Handles engagement metrics and insights from all social platforms
 */

const User = require('../models/User.model');
const Post = require('../models/Post.model');
const facebookService = require('../services/facebook.service');
const instagramService = require('../services/instagram.service');
const pinterestService = require('../services/pinterest.service');

/**
 * Get overview analytics across all connected platforms
 * GET /api/analytics/overview
 */
exports.getOverview = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user || !user.connectedAccounts || user.connectedAccounts.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalPosts: 0,
          totalReach: 0,
          totalEngagement: {
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0
          },
          connectedPlatforms: 0,
          platforms: [],
          period: 'last_7_days'
        }
      });
    }

    const platformMetrics = [];
    let totalReach = 0;
    const totalEngagement = {
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0
    };

    // Get metrics from each connected platform
    for (const account of user.connectedAccounts) {
      if (!account.isActive) continue;

      try {
        let metrics = null;

        switch (account.platform) {
          case 'facebook':
            if (account.pageId && account.pageAccessToken) {
              console.log('📊 Overview: Fetching Facebook insights for', account.accountName);
              const insightsArray = await facebookService.getPageInsights(
                account.pageAccessToken,
                account.pageId
              );
              
              // Parse insights array into object
              const parsedInsights = {};
              if (Array.isArray(insightsArray)) {
                insightsArray.forEach(metric => {
                  if (metric.values && metric.values.length > 0) {
                    parsedInsights[metric.name] = metric.values[0].value;
                  }
                });
              }
              console.log('📊 Overview: Parsed Facebook insights:', parsedInsights);
              
              // Fetch recent posts to get real engagement
              const fbPosts = await facebookService.getPagePosts(
                account.pageAccessToken,
                account.pageId,
                10
              );
              
              // Aggregate engagement from Facebook posts
              let fbLikes = 0, fbComments = 0, fbShares = 0;
              fbPosts.forEach(post => {
                fbLikes += post.likes?.summary?.total_count || 0;
                fbComments += post.comments?.summary?.total_count || 0;
                fbShares += post.shares?.count || 0;
              });
              
              console.log('📊 Overview: Facebook post engagement:', { likes: fbLikes, comments: fbComments, shares: fbShares });
              
              // Add to total engagement
              totalEngagement.likes += fbLikes;
              totalEngagement.comments += fbComments;
              totalEngagement.shares += fbShares;
              
              platformMetrics.push({
                platform: 'facebook',
                accountName: account.accountName,
                metrics: {
                  followers: parsedInsights.page_fans || 0,
                  engagement: parsedInsights.page_post_engagements || 0,
                  reach: parsedInsights.page_impressions || 0,
                  likes: fbLikes,
                  comments: fbComments,
                  shares: fbShares
                }
              });

              totalReach += parsedInsights.page_impressions_unique || parsedInsights.page_impressions || 0;
            }
            break;

          case 'instagram':
            if (account.businessAccountId) {
              const accessToken = account.pageAccessToken || account.accessToken;
              console.log('📊 Overview: Fetching Instagram insights for', account.accountName);
              const accountData = await instagramService.getAccountInsights(
                account.businessAccountId,
                accessToken
              );

              const parsedMetrics = parseInstagramInsights(accountData.insights);
              console.log('📊 Overview: Parsed Instagram insights:', parsedMetrics);
              
              platformMetrics.push({
                platform: 'instagram',
                accountName: account.accountName,
                metrics: {
                  followers: accountData.account?.followers_count || 0,
                  engagement: parsedMetrics.engagement || 0,
                  reach: parsedMetrics.reach || 0,
                  impressions: parsedMetrics.impressions || 0
                }
              });

              totalReach += parsedMetrics.reach || 0;
            }
            break;

          case 'pinterest':
            if (account.accessToken) {
              metrics = await pinterestService.getUserAnalytics(account.accessToken);
              
              platformMetrics.push({
                platform: 'pinterest',
                accountName: account.accountName,
                metrics: {
                  impressions: metrics.IMPRESSION || 0,
                  engagement: metrics.ENGAGEMENT || 0,
                  saves: metrics.SAVE || 0,
                  clicks: metrics.PIN_CLICK || 0
                }
              });
            }
            break;
        }
      } catch (error) {
        console.error(`Error fetching ${account.platform} metrics:`, error.message);
        // Continue with other platforms even if one fails
      }
    }

    // Get total posts and aggregate engagement from database
    const totalPosts = await Post.countDocuments({ 
      user: req.user._id,
      status: 'published'
    });

    // Get published posts for engagement metrics
    const posts = await Post.find({
      user: req.user._id,
      status: 'published'
    }).select('likesCount commentsCount sharesCount savesCount');

    // Aggregate engagement metrics from posts
    posts.forEach(post => {
      totalEngagement.likes += post.likesCount || 0;
      totalEngagement.comments += post.commentsCount || 0;
      totalEngagement.shares += post.sharesCount || 0;
      totalEngagement.saves += post.savesCount || 0;
    });

    res.status(200).json({
      success: true,
      data: {
        totalPosts,
        totalReach,
        totalEngagement,
        connectedPlatforms: user.connectedAccounts.filter(a => a.isActive).length,
        platforms: platformMetrics,
        period: 'last_7_days'
      }
    });

  } catch (error) {
    console.error('❌ Analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics overview',
      error: error.message
    });
  }
};

/**
 * Get Facebook page metrics
 * GET /api/analytics/facebook
 */
exports.getFacebookMetrics = async (req, res) => {
  try {
    console.log('📊 Controller: Fetching Facebook metrics for user:', req.user._id);
    const user = await User.findById(req.user._id);
    const fbAccount = user?.connectedAccounts?.find(
      acc => acc.platform === 'facebook' && acc.isActive
    );

    if (!fbAccount || !fbAccount.pageId) {
      console.log('❌ Controller: No Facebook account found');
      return res.status(404).json({
        success: false,
        message: 'Facebook account not connected'
      });
    }

    console.log('✅ Controller: Facebook account found:', fbAccount.accountName);
    console.log('📡 Controller: Fetching insights...');
    
    const insights = await facebookService.getPageInsights(
      fbAccount.pageAccessToken,
      fbAccount.pageId
    );

    console.log('📡 Controller: Fetching posts...');
    const posts = await facebookService.getPagePosts(
      fbAccount.pageAccessToken,
      fbAccount.pageId,
      10
    );

    // Parse insights array into object
    const parsedInsights = {};
    if (Array.isArray(insights)) {
      console.log('📊 Controller: Parsing', insights.length, 'insights');
      insights.forEach(metric => {
        if (metric.values && metric.values.length > 0) {
          parsedInsights[metric.name] = metric.values[0].value;
          console.log(`  - ${metric.name}: ${metric.values[0].value}`);
        }
      });
    } else {
      console.log('⚠️ Controller: Insights is not an array:', typeof insights);
    }

    const responseData = {
      success: true,
      data: {
        accountName: fbAccount.accountName,
        insights: {
          fanCount: parsedInsights.page_fans || 0,
          pageImpressions: parsedInsights.page_impressions || 0,
          pageEngagement: parsedInsights.page_post_engagements || 0
        },
        recentPosts: posts.map(post => ({
          id: post.id,
          message: post.message,
          createdTime: post.created_time,
          likes: post.likes?.summary?.total_count || 0,
          comments: post.comments?.summary?.total_count || 0,
          shares: post.shares?.count || 0
        }))
      }
    };

    console.log('✅ Controller: Sending response with', responseData.data.recentPosts.length, 'posts');
    console.log('📤 Full Response Data:', JSON.stringify(responseData, null, 2));
    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Facebook metrics error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Facebook metrics',
      error: error.message
    });
  }
};

/**
 * Get Instagram metrics
 * GET /api/analytics/instagram
 */
exports.getInstagramMetrics = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const igAccount = user?.connectedAccounts?.find(
      acc => acc.platform === 'instagram' && acc.isActive
    );

    if (!igAccount || !igAccount.businessAccountId) {
      return res.status(404).json({
        success: false,
        message: 'Instagram account not connected'
      });
    }

    const accessToken = igAccount.pageAccessToken || igAccount.accessToken;
    
    // Get account insights (now returns { account, insights })
    const accountData = await instagramService.getAccountInsights(
      igAccount.businessAccountId,
      accessToken
    );

    // Get recent media
    const media = await instagramService.getRecentMedia(
      igAccount.businessAccountId,
      accessToken,
      10
    );

    const parsedInsights = parseInstagramInsights(accountData.insights);

    res.status(200).json({
      success: true,
      data: {
        accountName: igAccount.accountName,
        insights: {
          followerCount: accountData.account?.followers_count || 0,
          followsCount: accountData.account?.follows_count || 0,
          mediaCount: accountData.account?.media_count || 0,
          impressions: parsedInsights.impressions || 0,
          reach: parsedInsights.reach || 0,
          profileViews: parsedInsights.profile_views || 0,
          engagement: parsedInsights.engagement || 0
        },
        recentMedia: media.map(item => ({
          id: item.id,
          caption: item.caption,
          mediaType: item.media_type,
          mediaUrl: item.media_url,
          thumbnailUrl: item.thumbnail_url,
          permalink: item.permalink,
          timestamp: item.timestamp,
          likes: item.like_count || 0,
          comments: item.comments_count || 0
        }))
      }
    });

  } catch (error) {
    console.error('❌ Instagram metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Instagram metrics',
      error: error.message
    });
  }
};

/**
 * Get Pinterest metrics
 * GET /api/analytics/pinterest
 */
exports.getPinterestMetrics = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const pinterestAccount = user?.connectedAccounts?.find(
      acc => acc.platform === 'pinterest' && acc.isActive
    );

    if (!pinterestAccount) {
      return res.status(404).json({
        success: false,
        message: 'Pinterest account not connected'
      });
    }

    // Get user analytics
    const analytics = await pinterestService.getUserAnalytics(pinterestAccount.accessToken);

    // Get user boards (may fail for unsupported account types)
    let boards = [];
    try {
      boards = await pinterestService.getUserBoards(pinterestAccount.accessToken);
    } catch (error) {
      console.log('⚠️ Controller: Pinterest boards not available:', error.message);
    }

    // Get recent pins (may fail for unsupported account types)
    let pins = [];
    try {
      pins = await pinterestService.getUserPins(pinterestAccount.accessToken, 10);
    } catch (error) {
      console.log('⚠️ Controller: Pinterest pins not available:', error.message);
    }

    res.status(200).json({
      success: true,
      data: {
        accountName: pinterestAccount.accountName,
        analytics: {
          impressions: analytics.all?.summary_metrics?.IMPRESSION || 0,
          engagement: analytics.all?.summary_metrics?.ENGAGEMENT || 0,
          saves: analytics.all?.summary_metrics?.SAVE || 0,
          clicks: analytics.all?.summary_metrics?.PIN_CLICK || 0
        },
        boards: boards.map(board => ({
          id: board.boardId,
          name: board.name,
          pinCount: board.pinCount
        })),
        recentPins: pins.map(pin => ({
          id: pin.id,
          title: pin.title,
          description: pin.description,
          mediaUrl: pin.media?.images?.['400x300']?.url,
          link: pin.link,
          createdAt: pin.created_at,
          saves: pin.save_count || 0
        }))
      }
    });

  } catch (error) {
    console.error('❌ Pinterest metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Pinterest metrics',
      error: error.message
    });
  }
};

/**
 * Get engagement metrics for a specific post
 * GET /api/analytics/post/:postId
 */
exports.getPostMetrics = async (req, res) => {
  try {
    const { postId } = req.params;
    
    const post = await Post.findById(postId)
      .populate('user', 'displayName photoURL');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Verify ownership
    if (post.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this post'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        post: {
          id: post._id,
          content: post.content,
          platforms: post.platforms,
          status: post.status,
          createdAt: post.createdAt,
          likesCount: post.likesCount || 0,
          commentsCount: post.commentsCount || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Post metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post metrics',
      error: error.message
    });
  }
};

/**
 * Get time series data for engagement trends
 * GET /api/analytics/trends
 */
exports.getTrends = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const posts = await Post.find({
      user: req.user._id,
      status: 'published',
      createdAt: { $gte: startDate }
    }).sort({ createdAt: 1 });

    // Group by date
    const trendData = {};
    posts.forEach(post => {
      const dateKey = post.createdAt.toISOString().split('T')[0];
      if (!trendData[dateKey]) {
        trendData[dateKey] = {
          date: dateKey,
          posts: 0,
          likes: 0,
          comments: 0
        };
      }
      trendData[dateKey].posts += 1;
      trendData[dateKey].likes += post.likesCount || 0;
      trendData[dateKey].comments += post.commentsCount || 0;
    });

    res.status(200).json({
      success: true,
      data: {
        period: `${days} days`,
        trends: Object.values(trendData)
      }
    });

  } catch (error) {
    console.error('❌ Trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch engagement trends',
      error: error.message
    });
  }
};

/**
 * Helper: Parse Instagram insights response
 */
function parseInstagramInsights(insights) {
  const parsed = {};
  
  if (Array.isArray(insights)) {
    insights.forEach(insight => {
      if (insight.name && insight.values && insight.values.length > 0) {
        // Get the most recent value
        parsed[insight.name] = insight.values[0].value;
      }
    });
  }
  
  return parsed;
}

module.exports = exports;
