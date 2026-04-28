require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const path = require('path');

// Initialize App
const app = express();
app.set('trust proxy', 1); // Enable trusting the Cloud Run proxy so express-rate-limit works correctly
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://accounts.google.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://api.elixopay.com", "https://app.elixopay.com"],
      imgSrc: ["'self'", "data:", "https:"],
      // NOTE: upgradeInsecureRequests removed — causes redirect loop with Cloudflare Flexible SSL
      scriptSrcAttr: ["'unsafe-inline'"],
    }
  },
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  hsts: {
    maxAge: 31536000, // 1 Year
    includeSubDomains: true,
    preload: true,
  }
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Serve static frontend files for the App Server
app.use(express.static(path.join(__dirname, 'public')));
// CORS Configuration
const allowedOrigins = process.env.FRONTEND_ALLOWED_ORIGINS
  ? process.env.FRONTEND_ALLOWED_ORIGINS.split(',')
  : ['https://elixopay.com', 'https://www.elixopay.com', 'https://app.elixopay.com'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests) - OPTIONAL: Disable in strict production
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
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
  max: 300, // Stricter limit: 300 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(globalLimiter);

// Stricter Auth Rate Limiter
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 login attempts per hour
  message: 'Too many login attempts, please try again later.',
});
app.use('/api/v1/auth/login', authLimiter);

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
const walletRoutes = require('./routes/wallet');
const verificationRoutes = require('./routes/verification');
const hierarchyRoutes = require('./routes/hierarchy');
const contactRoutes = require('./routes/contact');

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/balances', balanceRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/api-keys', apiKeyRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/ledger', ledgerRoutes);
app.use('/api/v1/partners', partnerRoutes);
app.use('/api/v1/agencies', agencyRoutes);
app.use('/api/v1/merchant-sites', merchantSiteRoutes);
app.use('/api/v1/commission-rules', commissionRulesRoutes);
app.use('/api/v1/verification', verificationRoutes);
app.use('/api/v1/hierarchy', hierarchyRoutes);
app.use('/api/v1/contact', contactRoutes);

// Health Check Route
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    message: 'Elixopay App Server (Secure)',
    timestamp: new Date()
  });
});

// Base Route - redirect to login
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: { message: 'Route not found' } });
  } else {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.message); // Log only message, not full stack in prod
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: 'Internal Server Error', // Generic message for security
    }
  });
});

// Start Server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

module.exports = app;
