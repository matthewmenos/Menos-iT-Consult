const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const nodemailer = require('nodemailer');
const requireAuth = require('../middleware/auth');
const router   = express.Router();

const DATA_FILE = path.join(__dirname, '../data/subscribers.json');

function loadSubscribers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveSubscribers(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// POST / — subscribe
router.post('/', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const subscribers = loadSubscribers();
  const already = subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());

  if (already) {
    return res.json({ success: true, message: "You're already subscribed — thanks!" });
  }

  subscribers.push({ email, subscribedAt: new Date().toISOString() });
  saveSubscribers(subscribers);

  // Notify the business
  try {
    await transporter.sendMail({
      from: `"Menos iT Website" <${process.env.SMTP_USER}>`,
      to: process.env.RECIPIENT_EMAIL,
      subject: 'New newsletter subscriber',
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;color:#0f172a">
          <p style="margin:0 0 12px">A new visitor subscribed to the Menos iT newsletter:</p>
          <p style="background:#eff6ff;border-radius:8px;padding:14px 18px;margin:0;font-weight:600;color:#1a56db">${email}</p>
          <p style="font-size:13px;color:#94a3b8;margin:16px 0 0">Total subscribers: ${subscribers.length}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Newsletter notify error:', err);
  }

  res.json({ success: true, message: "You're subscribed! Practical IT tips coming your way." });
});

// GET /subscribers — admin only (session auth)
router.get('/subscribers', requireAuth, (req, res) => {
  const subscribers = loadSubscribers();
  res.json({ subscribers, count: subscribers.length });
});

// DELETE /subscribers/:email — admin only, remove a subscriber
router.delete('/subscribers/:email', requireAuth, (req, res) => {
  const emailParam = decodeURIComponent(req.params.email);
  let subscribers = loadSubscribers();
  const before = subscribers.length;
  subscribers = subscribers.filter(s => s.email.toLowerCase() !== emailParam.toLowerCase());
  if (subscribers.length === before) {
    return res.status(404).json({ error: 'Subscriber not found.' });
  }
  saveSubscribers(subscribers);
  res.json({ success: true });
});

module.exports = router;
