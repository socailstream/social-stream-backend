const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const connectDB = require('./config/database');

// Load environment variables FIRST (IMPORTANT)
dotenv.config();

// Initialize Firebase AFTER env loads
const firebaseAdmin = require('./config/firebase');

// Initialize Express app
const app = express();

// Main async function to initialize server
async function startServer() {
  try {
    // Log timezone configuration
    console.log(`\n🌍 Timezone Configuration:`);
    console.log(`🌍 TZ Environment Variable: ${process.env.TZ || 'Not set (using UTC)'}`);
    console.log(`🌍 Current Server Time: ${new Date().toISOString()}`);
    console.log(`🌍 Current Server Time (Local): ${new Date().toLocaleString()}`);

    // Connect to MongoDB
    await connectDB();

    // Initialize Post Scheduler (only after DB is connected)
    const schedulerService = require('./services/scheduler.service');
    schedulerService.initializeScheduler();

    // Middleware - CORS Configuration
    // Allow all origins in development (Flutter web runs on random ports)
    app.use(cors({
      origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // In development, allow all localhost origins
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        
        // In production, check against allowed origins
        const allowedOrigins = [
          process.env.CLIENT_URL,
          'http://localhost:3000',
          'http://localhost:5000'
        ].filter(Boolean);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    app.use(morgan('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Basic health check route
    app.get('/', (req, res) => {
      res.json({
        message: 'Welcome to Social Stream API',
        version: '1.0.0',
        status: 'running',
        firebase: firebaseAdmin && firebaseAdmin.app ? 'connected' : 'disconnected'
      });
    });

    // Import routes
    const userRoutes = require('./routes/user.routes');
    const postRoutes = require('./routes/post.routes');
    const socialRoutes = require('./routes/social.routes');
    const dashboardRoutes = require('./routes/dashboard.routes');
    const uploadRoutes = require('./routes/upload.routes');
    const analyticsRoutes = require('./routes/analytics.routes');

    // Use routes
    app.use('/api/users', userRoutes);
    app.use('/api/posts', postRoutes);
    app.use('/api/social', socialRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/upload', uploadRoutes);
    app.use('/api/analytics', analyticsRoutes);

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('❌ Error:', err.stack);
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    });

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
