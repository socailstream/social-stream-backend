const Post = require('../models/Post.model');
const User = require('../models/User.model');

/**
 * Get all posts (feed)
 */
exports.getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'published' } = req.query;
    
    const posts = await Post.find({ status })
      .populate('user', 'displayName photoURL email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');
    
    const count = await Post.countDocuments({ status });
    
    res.status(200).json({
      success: true,
      count: posts.length,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
      error: error.message
    });
  }
};

/**
 * Get current user's posts
 */
exports.getMyPosts = async (req, res) => {
  try {
    const posts = await Post.find({ user: req.user._id })
      .populate('user', 'displayName photoURL email')
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching your posts',
      error: error.message
    });
  }
};

/**
 * Get scheduled posts for current user
 */
exports.getScheduledPosts = async (req, res) => {
  try {
    const posts = await Post.find({ 
      user: req.user._id,
      status: 'scheduled'
    })
      .populate('user', 'displayName photoURL email')
      .sort({ scheduledDate: 1 })
      .select('-__v');
    
    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching scheduled posts',
      error: error.message
    });
  }
};

/**
 * Get posts by date range for calendar view
 */
exports.getPostsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, platform, status } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    // Build query
    const query = {
      user: req.user._id,
      scheduledDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Add optional filters
    if (platform && platform !== 'All') {
      query.$or = [
        { platform: platform.toLowerCase() },
        { platforms: platform.toLowerCase() }
      ];
    }

    if (status && status !== 'All') {
      query.status = status.toLowerCase();
    }

    const posts = await Post.find(query)
      .populate('user', 'displayName photoURL email')
      .sort({ scheduledDate: 1 })
      .select('-__v');
    
    res.status(200).json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching posts by date range',
      error: error.message
    });
  }
};

/**
 * Get post by ID
 */
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'displayName photoURL email')
      .select('-__v');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching post',
      error: error.message
    });
  }
};

/**
 * Create new post
 */
exports.createPost = async (req, res) => {
  try {
    const postData = {
      ...req.body,
      user: req.user._id
    };
    
    const post = await Post.create(postData);
    const populatedPost = await Post.findById(post._id)
      .populate('user', 'displayName photoURL email');
    
    // Update user's post count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { postsCount: 1 }
    });
    
    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: populatedPost
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating post',
      error: error.message
    });
  }
};

/**
 * Update post
 */
exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to update it'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['content', 'mediaUrls', 'platform', 'scheduledDate', 'status'];
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        post[key] = req.body[key];
      }
    });
    
    await post.save();
    await post.populate('user', 'displayName photoURL email');
    
    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: post
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating post',
      error: error.message
    });
  }
};

/**
 * Delete post
 */
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or you do not have permission to delete it'
      });
    }
    
    // Update user's post count
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { postsCount: -1 }
    });
    
    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting post',
      error: error.message
    });
  }
};

/**
 * Like/Unlike post
 */
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }
    
    const userId = req.user._id;
    const isLiked = post.likes.some(id => id.toString() === userId.toString());
    
    if (isLiked) {
      // Unlike
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      // Like
      post.likes.push(userId);
      post.likesCount += 1;
    }
    
    await post.save();
    
    res.status(200).json({
      success: true,
      message: isLiked ? 'Post unliked' : 'Post liked',
      data: {
        likesCount: post.likesCount,
        isLiked: !isLiked
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error liking post',
      error: error.message
    });
  }
};

/**
 * Publish post to social media platforms
 */
exports.publishToSocialMedia = async (req, res) => {
  try {
    const { caption, mediaUrl, platforms, scheduledDate } = req.body;
    
    if (!caption) {
      return res.status(400).json({
        success: false,
        message: 'Caption is required'
      });
    }
    
    if (!platforms || platforms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one platform must be selected'
      });
    }

    const User = require('../models/User.model');
    const facebookService = require('../services/facebook.service');
    const instagramService = require('../services/instagram.service');
    const pinterestService = require('../services/pinterest.service');

    // Check if this is a scheduled post
    const isScheduled = scheduledDate && new Date(scheduledDate) > new Date();

    // If scheduled, save to database and return
    if (isScheduled) {
      const postData = {
        user: req.user._id,
        content: caption,
        mediaUrls: mediaUrl ? [mediaUrl] : [],
        platforms: platforms,
        platform: platforms.length === 1 ? platforms[0] : 'all',
        status: 'scheduled',
        scheduledDate: new Date(scheduledDate)
      };

      const post = await Post.create(postData);

      return res.status(200).json({
        success: true,
        message: `Post scheduled for ${new Date(scheduledDate).toLocaleString()}`,
        data: {
          post: post,
          scheduled: true
        }
      });
    }

    // Get user's connected accounts for immediate posting
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const results = [];
    const errors = [];

    // Publish to each selected platform immediately
    for (const platformName of platforms) {
      const connectedAccount = user.connectedAccounts.find(
        acc => acc.platform.toLowerCase() === platformName.toLowerCase() && acc.isActive
      );

      if (!connectedAccount) {
        errors.push({
          platform: platformName,
          error: 'Account not connected or inactive'
        });
        continue;
      }

      try {
        let postResult;

        switch (platformName.toLowerCase()) {
          case 'facebook':
            console.log('Posting to Facebook for user:', req.user._id);
            // Fetch user's Facebook pages dynamically
            const userPages = await facebookService.getUserPages(connectedAccount.accessToken);
            console.log(`Found ${userPages.length} Facebook pages`);
            
            if (userPages && userPages.length > 0) {
              // Use the first page that has CREATE_CONTENT permission
              const page = userPages.find(p => p.tasks?.includes('CREATE_CONTENT')) || userPages[0];
              console.log('Posting to Facebook Page:', page.pageName);
              
              postResult = await facebookService.postToPage(
                page.pageAccessToken,
                page.pageId,
                {
                  message: caption,
                  photoUrl: mediaUrl
                }
              );
            } else {
              throw new Error('No Facebook pages available. Please create or manage a Facebook Page.');
            }
            break;

          case 'instagram':
            // Get Instagram Business Account ID
            if (connectedAccount.businessAccountId) {
              const igUserId = connectedAccount.businessAccountId;
              const accessToken = connectedAccount.pageAccessToken || connectedAccount.accessToken;
              
              // Determine if it's a photo or video based on media URL
              const isVideo = mediaUrl && (
                mediaUrl.includes('.mp4') || 
                mediaUrl.includes('.mov') ||
                mediaUrl.includes('.avi')
              );

              if (isVideo) {
                postResult = await instagramService.publishVideo(
                  igUserId,
                  accessToken,
                  {
                    videoUrl: mediaUrl,
                    caption: caption
                  }
                );
              } else {
                postResult = await instagramService.publishPhoto(
                  igUserId,
                  accessToken,
                  {
                    imageUrl: mediaUrl,
                    caption: caption
                  }
                );
              }
            } else {
              throw new Error('Instagram Business account not linked');
            }
            break;

          case 'pinterest':
            // Pinterest only supports images, not videos
            const isVideoForPinterest = mediaUrl && (
              mediaUrl.includes('.mp4') || 
              mediaUrl.includes('.mov') ||
              mediaUrl.includes('.avi') ||
              mediaUrl.includes('video')
            );
            
            if (isVideoForPinterest) {
              throw new Error('Pinterest only supports image pins. Videos are not supported.');
            }
            
            // Use board ID from environment variable
            const boardId = process.env.PINTEREST_BOARD_ID;
            
            if (!boardId) {
              throw new Error('PINTEREST_BOARD_ID not configured in environment variables');
            }
            
            postResult = await pinterestService.createPin(
              connectedAccount.accessToken,
              {
                boardId: boardId,
                title: caption.substring(0, 100), // Pinterest title limit
                description: caption,
                imageUrl: mediaUrl
              }
            );
            break;

          default:
            throw new Error(`Unsupported platform: ${platformName}`);
        }

        results.push({
          platform: platformName,
          success: true,
          ...postResult
        });

      } catch (error) {
        console.error(`Error posting to ${platformName}:`, error.message);
        errors.push({
          platform: platformName,
          error: error.message
        });
      }
    }

    // Create post record in database for immediate post
    const postData = {
      user: req.user._id,
      content: caption,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      platforms: platforms,
      platform: platforms.length === 1 ? platforms[0] : 'all',
      status: results.length > 0 ? 'published' : 'failed'
    };

    const post = await Post.create(postData);

    // Return immediate publish results
    res.status(results.length > 0 ? 200 : 400).json({
      success: results.length > 0,
      message: results.length > 0 
        ? `Post published to ${results.length} platform(s)` 
        : 'Failed to publish to any platform',
      data: {
        post: post,
        results: results,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Error in publishToSocialMedia:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing post',
      error: error.message
    });
  }
};

