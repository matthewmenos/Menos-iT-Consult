const express   = require('express');
const nodemailer = require('nodemailer');
const db     = require('../db');
const mailer = require('../mailer');
const requireAuth = require('../middleware/auth');
const router    = express.Router();

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

  try {
    const existing = await db.getSubscribers();
    const already = existing.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (already) {
      return res.json({ success: true, message: "You're already subscribed — thanks!" });
    }

    await db.addSubscriber(email);
    const total = (await db.getSubscribers()).length;

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
            <p style="font-size:13px;color:#94a3b8;margin:16px 0 0">Total subscribers: ${total}</p>
          </div>`,
      });
    } catch (err) {
      console.error('Newsletter notify error:', err);
    }

    res.json({ success: true, message: "You're subscribed! Practical IT tips coming your way." });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    if (err.noDb) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: 'Could not subscribe at this time.' });
  }
});

// GET /subscribers — admin only
router.get('/subscribers', requireAuth, async (req, res) => {
  try {
    const subscribers = await db.getSubscribers();
    res.json({ subscribers, count: subscribers.length });
  } catch (err) {
    console.error(err);
    if (err.noDb) {
      return res.status(503).json({ error: err.message });    }
    res.status(500).json({ error: 'Database error.' });
  }
});

// DELETE /subscribers/:email — admin only, remove a subscriber
router.delete('/subscribers/:email', requireAuth, async (req, res) => {
  try {
    const emailParam = decodeURIComponent(req.params.email);
    const existing = await db.getSubscribers();
    const found = existing.find(s => s.email.toLowerCase() === emailParam.toLowerCase());
    if (!found) return res.status(404).json({ error: 'Subscriber not found.' });
    await db.deleteSubscriber(found.email);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.noDb) {
      return res.status(503).json({ error: err.message });    }
    res.status(500).json({ error: 'Database error.' });
  }
});

// POST /send — admin: send an email "tip" to all (or test to) subscribers
router.post('/send', requireAuth, async (req, res) => {
  const { subject, message, testOnly } = req.body || {};

  if (!subject || !message) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  try {
    const result = await mailer.sendTipEmails({
      subject,
      message,
      testOnly: !!testOnly,
    });

    if (result.error) {
      // Not configured, no recipients, etc. — surface to the UI.
      return res.status(200).json({
        success: false,
        message: result.error,
        configured: result.configured,
      });
    }

    res.json({
      success: true,
      message: testOnly
        ? `Test tip sent to ${result.testRecipient}.`
        : `Tip sent to ${result.sent}/${result.total} subscribers.`,
      sent: result.sent,
      failed: result.failed,
      total: result.total,
      errors: result.errors,
    });
    } catch (err) {
    console.error('Tip broadcast error:', err);
    res.status(500).json({
      success: false,
      message: err && err.message ? err.message : 'Broadcast failed.',
    });
  }
});

module.exports = router;