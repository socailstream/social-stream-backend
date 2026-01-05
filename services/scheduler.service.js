/**
 * Post Scheduler Service
 * Handles scheduled post publishing using node-cron
 */

const cron = require('node-cron');
const Post = require('../models/Post.model');
const User = require('../models/User.model');
const facebookService = require('./facebook.service');
const instagramService = require('./instagram.service');
const pinterestService = require('./pinterest.service');

/**
 * Process a single scheduled post
 */
async function processScheduledPost(post) {
  try {
    console.log(`📅 Processing scheduled post: ${post._id}`);

    // Get user's connected accounts
    const user = await User.findById(post.user);
    if (!user) {
      console.error('❌ User not found for scheduled post');
      return;
    }

    const results = [];
    const errors = [];
    const platforms = post.platforms || [post.platform];

    // Publish to each platform
    for (const platformName of platforms) {
      if (platformName === 'all') continue;

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
        const mediaUrl = post.mediaUrls?.[0];

        switch (platformName.toLowerCase()) {
          case 'facebook':
            const userPages = await facebookService.getUserPages(connectedAccount.accessToken);
            if (userPages && userPages.length > 0) {
              const page = userPages.find(p => p.tasks?.includes('CREATE_CONTENT')) || userPages[0];
              postResult = await facebookService.postToPage(
                page.pageAccessToken,
                page.pageId,
                {
                  message: post.content,
                  photoUrl: mediaUrl
                }
              );
            } else {
              throw new Error('No Facebook pages available');
            }
            break;

          case 'instagram':
            if (connectedAccount.businessAccountId) {
              const igUserId = connectedAccount.businessAccountId;
              const accessToken = connectedAccount.pageAccessToken || connectedAccount.accessToken;
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
                    caption: post.content
                  }
                );
              } else {
                postResult = await instagramService.publishPhoto(
                  igUserId,
                  accessToken,
                  {
                    imageUrl: mediaUrl,
                    caption: post.content
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
                title: post.content.substring(0, 100),
                description: post.content,
                imageUrl: mediaUrl
              }
            );
            break;
        }

        results.push({
          platform: platformName,
          success: true,
          ...postResult
        });

      } catch (error) {
        console.error(`❌ Error posting to ${platformName}:`, error.message);
        errors.push({
          platform: platformName,
          error: error.message
        });
      }
    }

    // Update post status
    post.status = results.length > 0 ? 'published' : 'failed';
    await post.save();

    console.log(`✅ Scheduled post ${post._id} processed: ${results.length} successful, ${errors.length} failed`);

  } catch (error) {
    console.error(`❌ Error processing scheduled post ${post._id}:`, error);
    // Mark post as failed
    post.status = 'failed';
    await post.save();
  }
}

/**
 * Check for scheduled posts that need to be published
 */
async function checkScheduledPosts() {
  try {
    const now = new Date();
    
    // Find posts scheduled for now or earlier that are still pending
    const scheduledPosts = await Post.find({
      status: 'scheduled',
      scheduledDate: { $lte: now }
    }).limit(10); // Process max 10 posts at a time

    if (scheduledPosts.length > 0) {
      console.log(`📅 Found ${scheduledPosts.length} posts to publish`);
      
      // Process each post
      for (const post of scheduledPosts) {
        await processScheduledPost(post);
      }
    }
  } catch (error) {
    console.error('❌ Error checking scheduled posts:', error);
  }
}

/**
 * Initialize the scheduler
 */
function initializeScheduler() {
  // Run every minute to check for scheduled posts
  cron.schedule('* * * * *', () => {
    checkScheduledPosts();
  });

  console.log('✅ Post scheduler initialized - checking every minute');
}

module.exports = {
  initializeScheduler,
  checkScheduledPosts,
  processScheduledPost
};
