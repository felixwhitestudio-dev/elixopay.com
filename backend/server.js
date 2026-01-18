require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');

// Initialize App
const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.FRONTEND_ALLOWED_ORIGINS
      ? process.env.FRONTEND_ALLOWED_ORIGINS.split(',')
      : [
        'https://elixopay.com',
        'http://localhost:8080',
        'http://127.0.0.1:8080'
      ]; // Minimal defaults

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.ALLOW_RAILWAY_WILDCARD === 'true') {
      callback(null, true);
    } else {
      console.warn(`BLOCKED CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

// Enable preflight for all routes
app.options('*', cors());

// Rate Limiting (Global)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const balanceRoutes = require('./routes/balances');
const paymentRoutes = require('./routes/payments');
const apiKeyRoutes = require('./routes/apiKeys');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const ledgerRoutes = require('./routes/ledger');
const partnerRoutes = require('./routes/partners');
const agencyRoutes = require('./routes/agencies');
const merchantSiteRoutes = require('./routes/merchantSites');
const commissionRulesRoutes = require('./routes/commissionRules');
const walletRoutes = require('./routes/wallet'); // Added wallet routes
const verificationRoutes = require('./routes/verification'); // Added validation routes

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/balances', balanceRoutes);
app.use('/api/v1/wallet', walletRoutes); // Added wallet endpoint
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ledger', ledgerRoutes);
app.use('/api/v1/partners', partnerRoutes);
app.use('/api/v1/agencies', agencyRoutes);
app.use('/api/v1/merchant-sites', merchantSiteRoutes);
app.use('/api/v1/commission-rules', commissionRulesRoutes);
app.use('/api/v1/verification', verificationRoutes); // Added validation endpoint

// Base Route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Elixopay Backend API v1.0.0',
    timestamp: new Date()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: 'Route not found' } });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🔗 CORS origins: http://localhost:8080, http://127.0.0.1:8080 checked`);
  });
}

module.exports = app;
