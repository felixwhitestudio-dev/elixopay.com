require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');
const apiKeyRoutes = require('./routes/apiKeys');
const webhookRoutes = require('./routes/webhooks');
const partnerRoutes = require('./routes/partners');
const adminRoutes = require('./routes/admin');
const agencyRoutes = require('./routes/agencies');
const merchantSiteRoutes = require('./routes/merchantSites');
const commissionRuleRoutes = require('./routes/commissionRules');
const balanceRoutes = require('./routes/balances');
const ledgerRoutes = require('./routes/ledger');

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Stripe webhooks require raw body for signature verification
// Apply ONLY to the Stripe webhook endpoint BEFORE JSON parsing
app.use(`/api/${API_VERSION}/webhooks/stripe`, express.raw({ type: 'application/json' }));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));

// CORS configuration - รองรับทั้ง localhost และจำกัด production ให้ชัดเจน
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // Local development
      'http://localhost:8000',
      'http://localhost:8080',
      'http://127.0.0.1:8000',
      'http://127.0.0.1:8080',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      // Production domains
      process.env.FRONTEND_URL,
      'https://elixopay.vercel.app',
      'https://www.elixopay.com',
      'https://elixopay.com',
      // Explicit Railway backend domains (avoid wildcard)
      'https://elixopay-production.up.railway.app',
      'https://elixopay-production-de65.up.railway.app'
    ].filter(Boolean);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowRailwayWildcard = (process.env.ALLOW_RAILWAY_WILDCARD || 'false').toLowerCase() === 'true';
    
    // In development, allow localhost with any port
    if (isDevelopment && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }
    
    // Optionally allow all Railway subdomains via env toggle
    if (!isDevelopment && allowRailwayWildcard && (origin.includes('.railway.app') || origin.includes('.up.railway.app'))) {
      return callback(null, true);
    }
    
    // Check against allowed origins list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, be more permissive but log warning
      if (isDevelopment) {
        console.warn(`⚠️ CORS Warning: Allowing unverified origin in development: ${origin}`);
        callback(null, true);
      } else {
        console.error(`❌ CORS Error: Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(logger);

// Apply rate limiting to all routes
app.use(generalLimiter);

// Health check endpoint - สำหรับตรวจสอบสถานะ server
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: '✅ Server is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    uptimeFormatted: formatUptime(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: API_VERSION,
    server: process.env.NODE_ENV === 'production' ? 'Railway.app' : 'localhost'
  });
});

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// API Routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/api-keys`, apiKeyRoutes);
app.use(`/api/${API_VERSION}/webhooks`, webhookRoutes);
app.use(`/api/${API_VERSION}/agencies`, agencyRoutes);
app.use(`/api/${API_VERSION}/merchant-sites`, merchantSiteRoutes);
app.use(`/api/${API_VERSION}/commission-rules`, commissionRuleRoutes);
app.use(`/api/${API_VERSION}/balances`, balanceRoutes);
app.use(`/api/${API_VERSION}/ledger`, ledgerRoutes);
app.use(`/api/${API_VERSION}/partners`, partnerRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);

// Root endpoint - แสดงข้อมูล API และ environment
app.get('/', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const serverUrl = isProduction 
    ? (process.env.SERVER_URL || 'https://elixopay-production.up.railway.app')
    : `http://localhost:${PORT}`;
    
  res.json({
    message: '🚀 Elixopay Payment Gateway API',
    version: API_VERSION,
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    serverUrl: serverUrl,
    endpoints: {
      health: '/health',
      auth: `/api/${API_VERSION}/auth`,
      payments: `/api/${API_VERSION}/payments`,
      users: `/api/${API_VERSION}/users`,
      apiKeys: `/api/${API_VERSION}/api-keys`,
      webhooks: `/api/${API_VERSION}/webhooks`,
      partners: `/api/${API_VERSION}/partners`,
      admin: `/api/${API_VERSION}/admin`,
      agencies: `/api/${API_VERSION}/agencies`,
      merchantSites: `/api/${API_VERSION}/merchant-sites`,
      commissionRules: `/api/${API_VERSION}/commission-rules`,
      balances: `/api/${API_VERSION}/balances`,
      ledger: `/api/${API_VERSION}/ledger`
    },
    documentation: 'https://docs.elixopay.com',
    support: 'support@elixopay.com'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`,
    availableEndpoints: {
      health: '/health',
      auth: `/api/${API_VERSION}/auth`,
      payments: `/api/${API_VERSION}/payments`,
      users: `/api/${API_VERSION}/users`,
      apiKeys: `/api/${API_VERSION}/api-keys`,
      webhooks: `/api/${API_VERSION}/webhooks`,
      partners: `/api/${API_VERSION}/partners`,
      admin: `/api/${API_VERSION}/admin`,
      agencies: `/api/${API_VERSION}/agencies`,
      merchantSites: `/api/${API_VERSION}/merchant-sites`,
      commissionRules: `/api/${API_VERSION}/commission-rules`,
      balances: `/api/${API_VERSION}/balances`,
      ledger: `/api/${API_VERSION}/ledger`
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const serverUrl = isProduction 
    ? (process.env.SERVER_URL || 'https://elixopay-production.up.railway.app')
    : `http://localhost:${PORT}`;
    
  console.log(`
╔═══════════════════════════════════════════╗
║         🚀 Elixopay Backend Server       ║
╠═══════════════════════════════════════════╣
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(28)}║
║  Port: ${PORT.toString().padEnd(35)}║
║  API Version: ${API_VERSION.padEnd(28)}║
║  Server URL: ${serverUrl.padEnd(27)}║
║  Status: ✅ Running                      ║
╠═══════════════════════════════════════════╣
║  Endpoints:                              ║
║  • Health: ${serverUrl}/health${' '.repeat(Math.max(0, 15 - serverUrl.length))}║
║  • API: ${serverUrl}/api/${API_VERSION}${' '.repeat(Math.max(0, 20 - serverUrl.length))}║
╚═══════════════════════════════════════════╝
  `);
  
  if (isProduction) {
    console.log('🌐 Running on Railway.app');
  } else {
    console.log('💻 Running locally - Development mode');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;
