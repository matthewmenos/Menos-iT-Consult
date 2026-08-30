const express   = require('express');
const nodemailer = require('nodemailer');
const db        = require('../db');
const router    = express.Router();

// ── Mail transport (lazy) ────────────────────────────────────────────────
// Built on first send so the route still works (and saves the enquiry) even
// when SMTP isn't configured yet.
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transporter;
}

// Resolve who receives the notification — RECIPIENT_EMAIL first, then the
// admin-maintained contact email from Settings, then the SMTP account itself.
async function resolveRecipient() {
  const fromEnv = (process.env.RECIPIENT_EMAIL || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const s = await db.getSetting('contact');
    if (s && typeof s.email === 'string' && s.email.trim()) return s.email.trim();
  } catch (_) { /* DB not available — fall through */ }
  return (process.env.SMTP_USER || '').trim() || null;
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.post('/', async (req, res) => {
  const { firstName, lastName, email, phone, service, source, message } = req.body;

  if (!firstName || !lastName || !email || !message) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const msgEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    read: false,
    name: `${firstName} ${lastName}`,
    email,
    phone: phone || '',
    service: service || '',
    source: source || '',
    message,
  };

  // 1) Persist — Postgres when available, flat-file fallback otherwise so the
  //    enquiry can never be silently lost.
  let persisted = false;
  let storageWhere = '';
  try {
    await db.saveMessage(msgEntry);
    persisted = true;
    storageWhere = 'database';
  } catch (err) {
    try {
      await db.saveMessageFile(msgEntry);
      persisted = true;
      storageWhere = 'file';
    } catch (fileErr) {
      console.error('Contact persist error:', err, fileErr);
    }
  }

  // 2) Notify the admin by email — independent of the storage result.
  const transporter = getTransporter();
  const recipient   = await resolveRecipient();
  let emailed = false;
  let emailError = '';
  if (transporter && recipient) {
    const mailOptions = {
      from: `"Menos iT Website" <${process.env.SMTP_USER}>`,
      to: recipient,
      replyTo: email,
      subject: `New enquiry from ${firstName} ${lastName}`,
      html: `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
        <div style="background:#1a56db;padding:28px 32px;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0;font-size:20px">New Contact Form Submission</h2>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:14px">Menos iT Consult Website</p>
        </div>
        <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:140px">Name</td><td style="padding:8px 0;font-weight:600">${esc(firstName)} ${esc(lastName)}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Email</td><td style="padding:8px 0"><a href="mailto:${esc(email)}" style="color:#1a56db">${esc(email)}</a></td></tr>
            ${phone ? `<tr><td style="padding:8px 0;font-size:13px;color:#64748b">Phone</td><td style="padding:8px 0">${esc(phone)}</td></tr>` : ''}
            ${service ? `<tr><td style="padding:8px 0;font-size:13px;color:#64748b">Service</td><td style="padding:8px 0">${esc(service)}</td></tr>` : ''}
            ${source ? `<tr><td style="padding:8px 0;font-size:13px;color:#64748b">Found us via</td><td style="padding:8px 0">${esc(source)}</td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
          <p style="font-size:13px;color:#64748b;margin:0 0 8px">Message</p>
          <p style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0;line-height:1.7;font-size:15px">${esc(message).replace(/\n/g, '<br>')}</p>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Reply directly to this email to respond to ${esc(firstName)}.</p>
        </div>
      </div>`,
    };
    try {
      await transporter.sendMail(mailOptions);
      emailed = true;
    } catch (err) {
      emailError = err && err.message ? err.message : String(err);
      console.error('Contact email error:', err);
    }
  } else if (!transporter) {
    emailError = 'SMTP not configured';
  }

  if (persisted || emailed) {
    return res.json({
      success: true,
      message: "Message sent! We'll get back to you within one business day.",
      storedIn: storageWhere,
      notifiedAdmin: emailed,
    });
  }

  // Neither storage nor email succeeded — be honest with the visitor.
  return res.status(500).json({
    error: `Sorry, your message could not be delivered right now (${emailError}). Please email us directly at ${recipient || process.env.SMTP_USER || 'our support address'}.`,
  });
});

module.exports = router;