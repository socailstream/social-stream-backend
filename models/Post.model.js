const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  mediaUrls: [{
    type: String
  }],
  platforms: [{
    type: String,
    enum: ['twitter', 'facebook', 'instagram', 'pinterest', 'linkedin']
  }],
  platform: {
    type: String,
    enum: ['twitter', 'facebook', 'instagram', 'pinterest', 'linkedin', 'all'],
    default: 'all'
  },
  scheduledDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'failed'],
    default: 'draft'
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  commentsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ status: 1, scheduledDate: 1 });
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);

