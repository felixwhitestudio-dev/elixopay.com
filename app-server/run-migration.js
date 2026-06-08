/**
 * Run Phase 3 migration: merchant_settings + settlements tables
 * Usage: DATABASE_URL=postgres://... node run-migration.js
 * Or: Set DATABASE_URL in .env and run: node run-migration.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set. Please set it in .env or pass it directly:');
    console.error('   DATABASE_URL=postgres://user:pass@host:5432/db node run-migration.js');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    // Test connection
    const testResult = await pool.query('SELECT NOW() as time');
    console.log('✅ Connected at:', testResult.rows[0].time);

    // Read migration SQL
    const sqlPath = path.join(__dirname, 'migrations', '20260608_merchant_settings_settlements.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📦 Running migration: merchant_settings + settlements...');
    await pool.query(sql);

    // Verify tables created
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('merchant_settings', 'settlements')
      ORDER BY table_name
    `);

    console.log('✅ Tables created:');
    tables.rows.forEach(r => console.log('   -', r.table_name));

    // Show column counts
    for (const t of ['merchant_settings', 'settlements']) {
      const cols = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [t]);
      console.log(`   ${t}: ${cols.rows[0].count} columns`);
    }

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Tables may already exist — this is OK if re-running.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
