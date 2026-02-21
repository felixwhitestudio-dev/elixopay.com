const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

async function fixUser() {
    try {
        console.log('Fixing demo user...');
        const email = 'demo@elixopay.com';
        const password = 'Elixopay2026!';
        const hash = await bcrypt.hash(password, 10);

        console.log(`Generated hash for ${email}`);

        // Insert or Update
        const query = `
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, is_verified, email_verified, created_at, updated_at)
      VALUES (
        'abef67f2-6f02-4085-b0f5-f6b845cd2346',
        $1, $2, 'Demo', 'User', 'merchant', 'active', true, true, NOW(), NOW()
      )
      ON CONFLICT (email) DO UPDATE 
      SET password_hash = $2, role = 'merchant', status = 'active', updated_at = NOW()
      RETURNING *;
    `;

        const res = await pool.query(query, [email, hash]);
        console.log('User saved:', res.rows[0].email, res.rows[0].id);

        process.exit(0);
    } catch (e) {
        console.error('Error fixing user:', e);
        process.exit(1);
    }
}

fixUser();
