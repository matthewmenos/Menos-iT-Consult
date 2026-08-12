const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const router  = express.Router();

const PROD        = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 8 * 60 * 60 * 1000 };
const CLEAR_OPTS  = { httpOnly: true, sameSite: 'lax', secure: PROD };

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const admin = await db.getAdmin();
    if (username !== admin.username) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const match = await bcrypt.compare(password, admin.passwordHash);
    if (!match) {
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
    res.status(500).json({ error: 'Password update failed.' });
  }
});

module.exports = router;