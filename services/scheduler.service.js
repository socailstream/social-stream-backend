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
    console.log(`\n📅 [SCHEDULER] Processing scheduled post: ${post._id}`);
    console.log(`📅 [SCHEDULER] Post details: User=${post.user}, Content="${post.content.substring(0, 50)}...", ScheduledDate=${post.scheduledDate.toISOString()}`);
    console.log(`📅 [SCHEDULER] Media URLs: ${post.mediaUrls?.length || 0}, Platforms: ${post.platforms || post.platform}`);

    // Get user's connected accounts
    const user = await User.findById(post.user);
    if (!user) {
      console.error(`❌ [SCHEDULER] User not found for scheduled post ${post._id}. User ID: ${post.user}`);
      post.status = 'failed';
      await post.save();
      return;
    }

    console.log(`📅 [SCHEDULER] User found: ${user._id}, Connected accounts: ${user.connectedAccounts?.length || 0}`);
    
    // Log connected accounts
    if (user.connectedAccounts && user.connectedAccounts.length > 0) {
      user.connectedAccounts.forEach(acc => {
        console.log(`📅 [SCHEDULER] Connected account: Platform=${acc.platform}, IsActive=${acc.isActive}, HasAccessToken=${!!acc.accessToken}`);
      });
    } else {
      console.warn(`⚠️ [SCHEDULER] User has no connected accounts`);
    }

    const results = [];
    const errors = [];
    const platforms = post.platforms || [post.platform];

    console.log(`📅 [SCHEDULER] Platforms to publish to: ${JSON.stringify(platforms)}`);

    // Publish to each platform
    for (const platformName of platforms) {
      if (platformName === 'all') {
        console.log(`📅 [SCHEDULER] Skipping 'all' platform, using individual platforms`);
        continue;
      }

      console.log(`📅 [SCHEDULER] Processing platform: ${platformName}`);

      const connectedAccount = user.connectedAccounts.find(
        acc => acc.platform.toLowerCase() === platformName.toLowerCase() && acc.isActive
      );

      if (!connectedAccount) {
        const errorMsg = 'Account not connected or inactive';
        console.error(`❌ [SCHEDULER] ${platformName}: ${errorMsg}`);
        errors.push({
          platform: platformName,
          error: errorMsg
        });
        continue;
      }

      console.log(`📅 [SCHEDULER] Found connected account for ${platformName}`);

      try {
        let postResult;
        const mediaUrl = post.mediaUrls?.[0];
        console.log(`📅 [SCHEDULER] Media URL: ${mediaUrl || 'None'}`);

        switch (platformName.toLowerCase()) {
          case 'facebook':
            console.log(`📅 [SCHEDULER] Publishing to Facebook...`);
            const userPages = await facebookService.getUserPages(connectedAccount.accessToken);
            console.log(`📅 [SCHEDULER] Found ${userPages?.length || 0} Facebook pages`);
            
            if (userPages && userPages.length > 0) {
              const page = userPages.find(p => p.tasks?.includes('CREATE_CONTENT')) || userPages[0];
              console.log(`📅 [SCHEDULER] Using Facebook page: ${page.pageName} (${page.pageId})`);
              
              postResult = await facebookService.postToPage(
                page.pageAccessToken,
                page.pageId,
                {
                  message: post.content,
                  photoUrl: mediaUrl
                }
              );
              console.log(`✅ [SCHEDULER] Facebook post successful: ${JSON.stringify(postResult)}`);
            } else {
              throw new Error('No Facebook pages available');
            }
            break;

          case 'instagram':
            console.log(`📅 [SCHEDULER] Publishing to Instagram...`);
            if (connectedAccount.businessAccountId) {
              const igUserId = connectedAccount.businessAccountId;
              const accessToken = connectedAccount.pageAccessToken || connectedAccount.accessToken;
              console.log(`📅 [SCHEDULER] Instagram Business ID: ${igUserId}, HasAccessToken=${!!accessToken}`);
              
              const isVideo = mediaUrl && (
                mediaUrl.includes('.mp4') || 
                mediaUrl.includes('.mov') ||
                mediaUrl.includes('.avi')
              );

              console.log(`📅 [SCHEDULER] Media type: ${isVideo ? 'Video' : 'Photo'}`);

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
              console.log(`✅ [SCHEDULER] Instagram post successful: ${JSON.stringify(postResult)}`);
            } else {
              throw new Error('Instagram Business account not linked');
            }
            break;

          case 'pinterest':
            console.log(`📅 [SCHEDULER] Publishing to Pinterest...`);
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
            console.log(`📅 [SCHEDULER] Pinterest Board ID: ${boardId}`);
            
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
            console.log(`✅ [SCHEDULER] Pinterest post successful: ${JSON.stringify(postResult)}`);
            break;
        }

        results.push({
          platform: platformName,
          success: true,
          ...postResult
        });

      } catch (error) {
        console.error(`❌ [SCHEDULER] Error posting to ${platformName}:`, error.message);
        console.error(`❌ [SCHEDULER] Stack trace:`, error.stack);
        errors.push({
          platform: platformName,
          error: error.message
        });
      }
    }

    // Update post status
    post.status = results.length > 0 ? 'published' : 'failed';
    await post.save();

    console.log(`✅ [SCHEDULER] Scheduled post ${post._id} processed: ${results.length} successful, ${errors.length} failed`);
    console.log(`✅ [SCHEDULER] Post status updated to: ${post.status}`);

  } catch (error) {
    console.error(`❌ [SCHEDULER] Error processing scheduled post ${post._id}:`, error);
    console.error(`❌ [SCHEDULER] Stack trace:`, error.stack);
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
    console.log(`\n📅 [SCHEDULER] Checking for scheduled posts at ${now.toISOString()}`);
    console.log(`📅 [SCHEDULER] Current time (local): ${now.toLocaleString()}`);
    console.log(`📅 [SCHEDULER] Timezone: ${process.env.TZ || 'UTC'}`);
    
    // Find posts scheduled for now or earlier that are still pending
    const scheduledPosts = await Post.find({
      status: 'scheduled',
      scheduledDate: { $lte: now }
    }).limit(10); // Process max 10 posts at a time

    console.log(`📅 [SCHEDULER] Query: { status: 'scheduled', scheduledDate: { $lte: ${now.toISOString()} } }`);
    console.log(`📅 [SCHEDULER] Found ${scheduledPosts.length} scheduled posts ready to publish`);

    if (scheduledPosts.length > 0) {
      // Log details of each scheduled post
      scheduledPosts.forEach((post, index) => {
        console.log(`📅 [SCHEDULER] Post ${index + 1}: ID=${post._id}, User=${post.user}, ScheduledDate=${post.scheduledDate.toISOString()}, ScheduledDate(Local)=${post.scheduledDate.toLocaleString()}, Platforms=${post.platforms || post.platform}`);
      });
      
      // Process each post
      for (const post of scheduledPosts) {
        await processScheduledPost(post);
      }
    } else {
      console.log(`📅 [SCHEDULER] No scheduled posts to process at this time`);
    }
  } catch (error) {
    console.error('❌ [SCHEDULER] Error checking scheduled posts:', error);
    console.error('❌ [SCHEDULER] Stack trace:', error.stack);
  }
}

/**
 * Initialize the scheduler
 */
function initializeScheduler() {
  console.log('📅 [SCHEDULER] Initializing post scheduler...');
  
  // Run every minute to check for scheduled posts
  cron.schedule('* * * * *', () => {
    checkScheduledPosts();
  });

  console.log('✅ [SCHEDULER] Post scheduler initialized - checking every minute');
  console.log('✅ [SCHEDULER] Cron pattern: * * * * * (every minute)');
}

module.exports = {
  initializeScheduler,
  checkScheduledPosts,
  processScheduledPost
};
