/**
 * Firestore Service
 * Handles social account data storage in Firebase Firestore
 * 
 * Collection Structure:
 * socialAccounts/{userId} -> {
 *   facebook: { accessToken, pages, longLivedToken, ... },
 *   instagram: { igId, accessToken, ... },
 *   pinterest: { accessToken, boards, ... },
 *   updatedAt: Timestamp
 * }
 */

const admin = require('../config/firebase');

// Firestore collection name
const COLLECTION_NAME = 'socialAccounts';

/**
 * Firestore Service Class
 */
class FirestoreService {
  constructor() {
    this.db = admin ? admin.firestore() : null;
  }

  /**
   * Check if Firestore is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.db !== null;
  }

  /**
   * Get social accounts document reference
   * @param {string} userId - User ID (Firebase UID)
   * @returns {DocumentReference}
   */
  getDocRef(userId) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    return this.db.collection(COLLECTION_NAME).doc(userId);
  }

  /**
   * Get all connected accounts for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - All connected accounts data
   */
  async getConnectedAccounts(userId) {
    try {
      const docRef = this.getDocRef(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return {
          facebook: null,
          instagram: null,
          pinterest: null
        };
      }

      const data = doc.data();
      
      // Remove sensitive tokens from response
      const sanitized = {};
      
      if (data.facebook) {
        sanitized.facebook = {
          accountId: data.facebook.accountId,
          accountName: data.facebook.accountName,
          profileImage: data.facebook.profileImage,
          pages: data.facebook.pages?.map(p => ({
            pageId: p.pageId,
            pageName: p.pageName,
            category: p.category,
            picture: p.picture
          })),
          isActive: data.facebook.isActive,
          connectedAt: data.facebook.connectedAt,
          expiresAt: data.facebook.expiresAt
        };
      }

      if (data.instagram) {
        sanitized.instagram = {
          accountId: data.instagram.accountId,
          accountName: data.instagram.accountName,
          username: data.instagram.username,
          profileImage: data.instagram.profileImage,
          followersCount: data.instagram.followersCount,
          isActive: data.instagram.isActive,
          connectedAt: data.instagram.connectedAt,
          expiresAt: data.instagram.expiresAt
        };
      }

      if (data.pinterest) {
        sanitized.pinterest = {
          accountId: data.pinterest.accountId,
          accountName: data.pinterest.accountName,
          profileImage: data.pinterest.profileImage,
          boards: data.pinterest.boards?.map(b => ({
            boardId: b.boardId,
            name: b.name,
            description: b.description,
            pinCount: b.pinCount
          })),
          followerCount: data.pinterest.followerCount,
          isActive: data.pinterest.isActive,
          connectedAt: data.pinterest.connectedAt,
          expiresAt: data.pinterest.expiresAt
        };
      }

      return sanitized;
    } catch (error) {
      console.error('❌ Firestore: Error getting accounts:', error);
      throw new Error('Failed to fetch connected accounts');
    }
  }

  /**
   * Get account with tokens (for internal use)
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @returns {Promise<Object|null>} - Account data with tokens
   */
  async getAccountWithTokens(userId, platform) {
    try {
      const docRef = this.getDocRef(userId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return doc.data()[platform] || null;
    } catch (error) {
      console.error(`❌ Firestore: Error getting ${platform} account:`, error);
      throw new Error(`Failed to fetch ${platform} account`);
    }
  }

  /**
   * Save Facebook account data
   * @param {string} userId - User ID
   * @param {Object} accountData - Facebook account data
   * @returns {Promise<void>}
   */
  async saveFacebookAccount(userId, accountData) {
    try {
      const docRef = this.getDocRef(userId);
      
      await docRef.set({
        facebook: {
          accountId: accountData.accountId,
          accountName: accountData.accountName,
          profileImage: accountData.profileImage,
          email: accountData.email,
          accessToken: accountData.accessToken,
          longLivedToken: accountData.longLivedToken,
          pages: accountData.pages || [],
          expiresAt: accountData.expiresAt,
          isActive: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log('✅ Firestore: Facebook account saved');
    } catch (error) {
      console.error('❌ Firestore: Error saving Facebook account:', error);
      throw new Error('Failed to save Facebook account');
    }
  }

  /**
   * Save Instagram account data
   * @param {string} userId - User ID
   * @param {Object} accountData - Instagram account data
   * @returns {Promise<void>}
   */
  async saveInstagramAccount(userId, accountData) {
    try {
      const docRef = this.getDocRef(userId);
      
      await docRef.set({
        instagram: {
          accountId: accountData.accountId,
          accountName: accountData.accountName,
          igId: accountData.igId,
          username: accountData.username,
          profileImage: accountData.profileImage,
          followersCount: accountData.followersCount,
          mediaCount: accountData.mediaCount,
          biography: accountData.biography,
          accessToken: accountData.accessToken,
          pageAccessToken: accountData.pageAccessToken,
          connectedPageId: accountData.connectedPageId,
          expiresAt: accountData.expiresAt,
          isActive: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log('✅ Firestore: Instagram account saved');
    } catch (error) {
      console.error('❌ Firestore: Error saving Instagram account:', error);
      throw new Error('Failed to save Instagram account');
    }
  }

  /**
   * Save Pinterest account data
   * @param {string} userId - User ID
   * @param {Object} accountData - Pinterest account data
   * @returns {Promise<void>}
   */
  async savePinterestAccount(userId, accountData) {
    try {
      const docRef = this.getDocRef(userId);
      
      await docRef.set({
        pinterest: {
          accountId: accountData.accountId,
          accountName: accountData.accountName,
          profileImage: accountData.profileImage,
          accessToken: accountData.accessToken,
          refreshToken: accountData.refreshToken,
          boards: accountData.boards || [],
          followerCount: accountData.followerCount,
          followingCount: accountData.followingCount,
          pinCount: accountData.pinCount,
          monthlyViews: accountData.monthlyViews,
          expiresAt: accountData.expiresAt,
          isActive: true,
          connectedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log('✅ Firestore: Pinterest account saved');
    } catch (error) {
      console.error('❌ Firestore: Error saving Pinterest account:', error);
      throw new Error('Failed to save Pinterest account');
    }
  }

  /**
   * Disconnect (remove) a platform account
   * @param {string} userId - User ID
   * @param {string} platform - Platform to disconnect
   * @returns {Promise<boolean>}
   */
  async disconnectAccount(userId, platform) {
    try {
      const docRef = this.getDocRef(userId);
      
      await docRef.update({
        [platform]: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ Firestore: ${platform} account disconnected`);
      return true;
    } catch (error) {
      console.error(`❌ Firestore: Error disconnecting ${platform}:`, error);
      throw new Error(`Failed to disconnect ${platform} account`);
    }
  }

  /**
   * Update access token for a platform
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @param {Object} tokenData - New token data
   * @returns {Promise<void>}
   */
  async updateAccessToken(userId, platform, tokenData) {
    try {
      const docRef = this.getDocRef(userId);
      
      const updateData = {
        [`${platform}.accessToken`]: tokenData.accessToken,
        [`${platform}.expiresAt`]: tokenData.expiresAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (tokenData.refreshToken) {
        updateData[`${platform}.refreshToken`] = tokenData.refreshToken;
      }

      await docRef.update(updateData);

      console.log(`✅ Firestore: ${platform} token updated`);
    } catch (error) {
      console.error(`❌ Firestore: Error updating ${platform} token:`, error);
      throw new Error(`Failed to update ${platform} token`);
    }
  }

  /**
   * Check if a platform is connected for a user
   * @param {string} userId - User ID
   * @param {string} platform - Platform name
   * @returns {Promise<boolean>}
   */
  async isConnected(userId, platform) {
    try {
      const docRef = this.getDocRef(userId);
      const doc = await docRef.get();

      if (!doc.exists) return false;

      const data = doc.data();
      return data[platform]?.isActive === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all users with a specific platform connected
   * (Useful for bulk operations like token refresh)
   * @param {string} platform - Platform name
   * @returns {Promise<Array>} - Array of user documents
   */
  async getUsersWithPlatform(platform) {
    try {
      const snapshot = await this.db
        .collection(COLLECTION_NAME)
        .where(`${platform}.isActive`, '==', true)
        .get();

      return snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()[platform]
      }));
    } catch (error) {
      console.error(`❌ Firestore: Error getting users with ${platform}:`, error);
      return [];
    }
  }

  /**
   * Get expiring tokens (for refresh job)
   * @param {string} platform - Platform name
   * @param {number} daysUntilExpiry - Days until expiry threshold
   * @returns {Promise<Array>} - Users with expiring tokens
   */
  async getExpiringTokens(platform, daysUntilExpiry = 7) {
    try {
      const expiryThreshold = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000);
      
      const snapshot = await this.db
        .collection(COLLECTION_NAME)
        .where(`${platform}.isActive`, '==', true)
        .where(`${platform}.expiresAt`, '<=', expiryThreshold)
        .get();

      return snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()[platform]
      }));
    } catch (error) {
      console.error(`❌ Firestore: Error getting expiring tokens:`, error);
      return [];
    }
  }
}

// Export singleton instance
module.exports = new FirestoreService();

