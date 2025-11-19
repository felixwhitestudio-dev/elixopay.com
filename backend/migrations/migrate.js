const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function runMigrations() {
  let poolConfig;
  
  if (process.env.DATABASE_URL) {
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  } else {
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'elixopay',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };
  }
  
  const pool = new Pool(poolConfig);

  try {
    console.log('🚀 Starting database migrations...');
    
    // Check if tables already exist
    const checkTables = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    const tablesExist = checkTables.rows[0].exists;
    
    if (!tablesExist) {
      // Read schema.sql
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute schema
      console.log('📦 Creating tables and indexes...');
      await pool.query(schemaSql);
      console.log('✅ Schema migration completed');
    } else {
      console.log('⏭️  Tables already exist, skipping schema migration');
    }

    // Ensure schema_migrations tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auto-run additional *.sql migration files (excluding schema.sql)
    // This lets us drop new migration files in the folder without editing this script.
    const migrationDir = __dirname;
    const files = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.sql') && f !== 'schema.sql')
      .sort(); // filename order ensures chronological if prefixed with date

    for (const file of files) {
      try {
        const check = await pool.query('SELECT filename FROM schema_migrations WHERE filename = $1', [file]);
        if (check.rows.length) {
          console.log(`⏭️  Migration ${file} already applied`);
          continue;
        }
        console.log(`🚧 Applying migration file: ${file}`);
        const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
        // Run inside a transaction for safety
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await pool.query('COMMIT');
        console.log(`✅ Migration ${file} applied`);
      } catch (err) {
        console.error(`❌ Failed applying migration ${file}:`, err.message);
        try { await pool.query('ROLLBACK'); } catch (_) {}
      }
    }

    // Ensure new tables introduced after initial deploys exist (idempotent)
    // 1) webhook_endpoints
    const checkWebhookTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'webhook_endpoints'
      );
    `);
    if (!checkWebhookTable.rows[0].exists) {
      console.log('🧩 Creating table webhook_endpoints...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS webhook_endpoints (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id),
          url VARCHAR(255) NOT NULL,
          enabled_events TEXT[] NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Table webhook_endpoints created');
    } else {
      console.log('⏭️  Table webhook_endpoints already exists');
    }
    
    // Check if demo user exists
    const checkUser = await pool.query(`
      SELECT id FROM users WHERE email = 'demo@elixopay.com';
    `);
    
    if (checkUser.rows.length === 0) {
      console.log('👤 Creating demo user...');
      const initialPassword = process.env.DEMO_USER_PASSWORD || 'Password123';
      const demoHash = await bcrypt.hash(initialPassword, 10);
      await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, company_name, status, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        ['demo@elixopay.com', demoHash, 'Demo', 'User', 'Demo Company', 'active', true]
      );
      console.log(`✅ Demo user created (password: ${initialPassword === 'Password123' ? 'Password123 (default)' : 'custom'})`);
    } else {
      // Only update password if DEMO_USER_PASSWORD is set AND DEMO_USER_PASSWORD_FORCE=1
      const newPw = process.env.DEMO_USER_PASSWORD;
      const force = process.env.DEMO_USER_PASSWORD_FORCE === '1';
      if (newPw && force) {
        if (newPw.length < 8) {
          console.log('⚠️  Skipping demo password update: DEMO_USER_PASSWORD must be at least 8 chars');
        } else {
          console.log('🔐 Updating demo user password (forced)...');
          const newHash = await bcrypt.hash(newPw, 10);
          await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2;`, [newHash, 'demo@elixopay.com']);
          console.log('✅ Demo user password updated');
        }
      } else if (newPw && !force) {
        console.log('ℹ️  DEMO_USER_PASSWORD provided but not applied (set DEMO_USER_PASSWORD_FORCE=1 to update)');
      } else {
        console.log('⏭️  Demo user exists; password preserved');
      }
    }
    
    // Check if demo data already exists
    const checkData = await pool.query(`
      SELECT COUNT(*) FROM payments;
    `);
    
    const dataCount = parseInt(checkData.rows[0].count);
    
    if (dataCount === 0) {
      // Read seed_demo_data.sql
      const seedPath = path.join(__dirname, 'seed_demo_data.sql');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      
      // Execute seed data
      console.log('🌱 Seeding demo data...');
      await pool.query(seedSql);
      console.log('✅ Demo data seeded successfully');
    } else {
      console.log(`⏭️  Demo data already exists (${dataCount} payments), skipping seed`);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️  Database not available - skipping migrations');
      console.log('ℹ️  Server will run in memory-only mode');
    } else {
      console.error(error);
    }
    // Don't exit - allow server to start without database
  } finally {
    await pool.end();
  }
}

runMigrations();
