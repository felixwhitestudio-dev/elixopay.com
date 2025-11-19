// Quick script to update demo user password
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'elixopay',
  user: process.env.DB_USER || process.env.USER,
  password: process.env.DB_PASSWORD || '',
});

async function fixPassword() {
  try {
    const hash = await bcrypt.hash('Password123', 12);
    
    const result = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE email = 'demo@elixopay.com' RETURNING id, email`,
      [hash]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Demo user password updated successfully');
      console.log('📧 Email: demo@elixopay.com');
      console.log('🔑 Password: Password123');
    } else {
      console.log('⚠️  Demo user not found, creating...');
      await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status, email_verified)
         VALUES ('demo@elixopay.com', $1, 'Demo', 'User', 'active', true)
         RETURNING id, email`,
        [hash]
      );
      console.log('✅ Demo user created successfully');
      console.log('📧 Email: demo@elixopay.com');
      console.log('🔑 Password: Password123');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixPassword();
