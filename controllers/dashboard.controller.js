const Post = require('../models/Post.model');
const User = require('../models/User.model');

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user with connected accounts
    const user = await User.findById(userId);
    const connectedCount = user?.connectedAccounts?.filter(acc => acc.isActive).length || 0;

    // Get scheduled posts count
    const scheduledCount = await Post.countDocuments({
      user: userId,
      status: 'scheduled'
    });

    // Get all published posts count (all time)
    const totalPublishedCount = await Post.countDocuments({
      user: userId,
      status: 'published'
    });

    // Get next scheduled post
    const nextPost = await Post.findOne({
      user: userId,
      status: 'scheduled',
      scheduledDate: { $gte: new Date() }
    })
      .sort({ scheduledDate: 1 })
      .select('scheduledDate content');

    res.status(200).json({
      success: true,
      data: {
        connectedAccounts: connectedCount,
        scheduledPosts: scheduledCount,
        postedToday: totalPublishedCount,
        nextPost: nextPost ? {
          time: nextPost.scheduledDate,
          content: nextPost.content.substring(0, 50)
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

/**
 * Get engagement statistics (placeholder - will need social platform APIs)
 */
exports.getEngagementStats = async (req, res) => {
  try {
    // TODO: Fetch real engagement data from Facebook, Instagram, Pinterest APIs
    // For now, return placeholder data
    res.status(200).json({
      success: true,
      data: {
        likes: 0,
        comments: 0,
        shares: 0,
        message: 'Engagement tracking coming soon'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching engagement statistics',
      error: error.message
    });
  }
};

/**
 * Get recent activity/notifications
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 20;

    const activities = [];

    // Get recent published and failed posts
    const recentPosts = await Post.find({
      user: userId,
      status: { $in: ['published', 'failed'] }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('content status createdAt platforms likesCount commentsCount sharesCount');

    recentPosts.forEach(post => {
      // Published post notification
      if (post.status === 'published') {
        activities.push({
          type: 'published',
          title: 'Post Published',
          description: post.content.substring(0, 60) + (post.content.length > 60 ? '...' : ''),
          time: post.createdAt,
          platforms: post.platforms || [],
          isUnread: false
        });

        // Engagement notifications (if there are likes/comments)
        if (post.likesCount > 0) {
          activities.push({
            type: 'likes',
            title: 'New Likes',
            description: `Your post received ${post.likesCount} like${post.likesCount > 1 ? 's' : ''}`,
            time: post.createdAt,
            platforms: post.platforms || [],
            isUnread: post.likesCount > 10
          });
        }
        
        if (post.commentsCount > 0) {
          activities.push({
            type: 'comment',
            title: 'New Comments',
            description: `Your post received ${post.commentsCount} comment${post.commentsCount > 1 ? 's' : ''}`,
            time: post.createdAt,
            platforms: post.platforms || [],
            isUnread: post.commentsCount > 5
          });
        }

        if (post.sharesCount > 0) {
          activities.push({
            type: 'share',
            title: 'Post Shared',
            description: `Your post was shared ${post.sharesCount} time${post.sharesCount > 1 ? 's' : ''}`,
            time: post.createdAt,
            platforms: post.platforms || [],
            isUnread: false
          });
        }
      } 
      // Failed post notification
      else if (post.status === 'failed') {
        activities.push({
          type: 'failed',
          title: 'Post Failed',
          description: `Failed to publish: ${post.content.substring(0, 50)}...`,
          time: post.createdAt,
          platforms: post.platforms || [],
          isUnread: true
        });
      }
    });

    // Get recently scheduled posts
    const scheduledPosts = await Post.find({
      user: userId,
      status: 'scheduled',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('content createdAt scheduledDate platforms');

    scheduledPosts.forEach(post => {
      activities.push({
        type: 'scheduled',
        title: 'Post Scheduled',
        description: `Scheduled for ${new Date(post.scheduledDate).toLocaleString()}`,
        time: post.createdAt,
        platforms: post.platforms || [],
        isUnread: false
      });
    });

    // Sort all activities by time
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.status(200).json({
      success: true,
      count: activities.length,
      data: activities.slice(0, limit)
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activity',
      error: error.message
    });
  }
};
