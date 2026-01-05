const mongoose = require('mongoose');

const connectedAccountSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['facebook', 'instagram', 'pinterest'],
    required: true
  },
  accountId: {
    type: String,
    required: true
  },
  accountName: {
    type: String,
    required: true
  },
  profileImage: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  expiresAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  connectedAt: {
    type: Date,
    default: Date.now
  },
  // Platform specific data
  pageId: String,              // For Facebook Pages
  pageAccessToken: String,     // For Facebook Pages
  businessAccountId: String,   // For Instagram Business
  metadata: {
    type: Map,
    of: String
  }
}, { _id: true });

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  photoURL: {
    type: String
  },
  bio: {
    type: String,
    maxlength: 500
  },
  connectedAccounts: [connectedAccountSchema],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  postsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries (email already has unique index)
userSchema.index({ displayName: 'text' });
userSchema.index({ 'connectedAccounts.platform': 1 });

// Method to check if account is connected
userSchema.methods.isAccountConnected = function(platform) {
  return this.connectedAccounts.some(
    account => account.platform === platform && account.isActive
  );
};

// Method to get connected account
userSchema.methods.getConnectedAccount = function(platform) {
  return this.connectedAccounts.find(
    account => account.platform === platform && account.isActive
  );
};

module.exports = mongoose.model('User', userSchema);
