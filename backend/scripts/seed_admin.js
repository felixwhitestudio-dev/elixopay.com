#!/usr/bin/env node
/**
 * Seed or update an admin user using environment variables.
 *
 * Env Vars:
 *   ADMIN_EMAIL (required)
 *   ADMIN_PASSWORD (optional; if missing a random secure password is generated and printed)
 *   ADMIN_NAME (optional; default 'Admin User')
 *   ADMIN_VERIFY (optional; 'true' to mark verified)
 *
 * Behavior:
 *   - If user with ADMIN_EMAIL exists, its role, password (if ADMIN_PASSWORD provided) and name are updated.
 *   - If not exists, inserted with Argon2id password hash and role=admin.
 *   - Always sets is_active=true.
 *   - Prints JSON summary and any generated password to stdout.
 */

const argon2 = require('argon2');
const crypto = require('crypto');
require('dotenv').config();
const db = require('../config/database');

async function main() {
  const email = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim();
  if (!email) {
    console.error('ADMIN_EMAIL is required.');
    process.exit(1);
  }
  const name = (process.env.ADMIN_NAME || 'Admin User').trim();
  const verifyFlag = (process.env.ADMIN_VERIFY || 'true').toLowerCase() === 'true';
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = generatePassword();
    generated = true;
  }

  let hash;
  try {
    hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '19456'),
      timeCost: parseInt(process.env.ARGON2_TIME_COST || '2'),
      parallelism: parseInt(process.env.ARGON2_PARALLELISM || '1')
    });
  } catch (e) {
    console.error('Password hashing failed:', e.message);
    process.exit(1);
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      // Update existing admin
      if (process.env.ADMIN_PASSWORD) {
        await db.query('UPDATE users SET name=$1, account_type=$2, is_verified=$3, status=$4, password_hash=$5, updated_at=CURRENT_TIMESTAMP WHERE id=$6', [name, 'admin', verifyFlag, 'active', hash, existing.rows[0].id]);
      } else {
        await db.query('UPDATE users SET name=$1, account_type=$2, is_verified=$3, status=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5', [name, 'admin', verifyFlag, 'active', existing.rows[0].id]);
      }
      console.log(JSON.stringify({ action: 'updated', email, generatedPassword: generated ? password : undefined }, null, 2));
    } else {
      // Insert new admin
      await db.query('INSERT INTO users (email, password_hash, name, account_type, is_verified, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)', [email, hash, name, 'admin', verifyFlag, 'active']);
      console.log(JSON.stringify({ action: 'inserted', email, generatedPassword: generated ? password : undefined }, null, 2));
    }
  } catch (e) {
    console.error('DB operation failed:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

function generatePassword() {
  // 16 chars: letters + digits + symbols
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-';
  let pwd = '';
  for (let i = 0; i < 16; i++) pwd += chars.charAt(crypto.randomInt(0, chars.length));
  return pwd;
}

main();
