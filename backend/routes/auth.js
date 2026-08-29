const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const db      = require('../db');
const router  = express.Router();

const PROD        = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 8 * 60 * 60 * 1000 };
const CLEAR_OPTS  = { httpOnly: true, sameSite: 'lax', secure: PROD };

const ENV_USER = process.env.ADMIN_USERNAME || 'admin';
const ENV_PASS = process.env.ADMIN_PASSWORD  || 'admin123';

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Credential check, in order of preference:
 *  1. bcrypt hash in the Postgres `admin` table (DB configured + seeded).
 *  2. ADMIN_PASSWORD / ADMIN_USERNAME env vars — used when the database is
 *     not configured (local dev without POSTGRES_URL) or not yet seeded
 *     (fresh deploy). Keeps the admin panel usable before migration runs.
 */
async function verifyAdmin(username, password) {
  try {
    const admin = await db.getAdmin(); // throws when no DB pool / table missing
    const hash = admin && admin.passwordHash;
    if (!hash) throw new Error('no password hash stored');
    if (username !== (admin.username || ENV_USER)) return false;
    return bcrypt.compare(String(password), hash);
  } catch {
    // No DB → env-based login
    return username === ENV_USER && safeEqual(password, ENV_PASS);
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const ok = await verifyAdmin(String(username), password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    res.cookie('admin_auth', 'true', { signed: true, ...COOKIE_OPTS });
    res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_auth', CLEAR_OPTS);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const loggedIn = !!(req.signedCookies && req.signedCookies.admin_auth === 'true');
  res.json({ loggedIn });
});

// PUT /api/auth/password
router.put('/password', async (req, res) => {
  if (!req.signedCookies || req.signedCookies.admin_auth !== 'true') {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current and new passwords are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  try {
    const admin = await db.getAdmin();
    const match = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.updateAdminPassword(newHash);
    res.json({ success: true });
  } catch (err) {
    console.error('Password update error:', err);
    if (err.noDb) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: 'Password update failed.' });
  }
});

module.exports = router;