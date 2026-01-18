const { Pool } = require('pg');

// Database configuration
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.DATABASE_URL) {
  console.error('❌ CRITICAL ERROR: DATABASE_URL environment variable is missing!');
  console.error('Please configure DATABASE_URL in your Render Dashboard settings.');
}
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual params if DATABASE_URL is not set
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'elixopay',
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD || '',
  // Enable SSL in production by default (override with DB_SSL=false)
  ssl: (() => {
    const flag = (process.env.DB_SSL || (isProduction ? 'true' : 'false')).toLowerCase();
    if (flag === 'true' || flag === '1') {
      return { rejectUnauthorized: false };
    }
    return false;
  })(),
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Remove individual params if connectionString is present to avoid conflicts (optional but cleaner)
if (process.env.DATABASE_URL) {
  // pg will prioritize connectionString, but we keep the object clean
}

const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Helper function for queries with error handling
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.LOG_LEVEL !== 'silent') {
      // Avoid logging full SQL text in production
      const summary = isProduction ? (text.split('\n')[0].slice(0, 80) + '...') : text;
      console.log('Executed query', { text: summary, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a client from the pool (for transactions)
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  // Monkey patch the release method to clear the timeout
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing database pool');
  await pool.end();
  process.exit(0);
});

module.exports = {
  query,
  getClient,
  pool
};
