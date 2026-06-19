const express  = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const router   = express.Router();

const MESSAGES_FILE = path.join(__dirname, '../data/messages.json');

function loadMessages() {
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveMessage(entry) {
  const messages = loadMessages();
  messages.push(entry);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
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

router.post('/', async (req, res) => {
  const { firstName, lastName, email, phone, service, source, message } = req.body;

  if (!firstName || !lastName || !email || !message) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const mailOptions = {
    from: `"Menos iT Website" <${process.env.SMTP_USER}>`,
    to: process.env.RECIPIENT_EMAIL,
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
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:140px">Name</td><td style="padding:8px 0;font-weight:600">${firstName} ${lastName}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#1a56db">${email}</a></td></tr>
            ${phone ? `<tr><td style="padding:8px 0;font-size:13px;color:#64748b">Phone</td><td style="padding:8px 0">${phone}</td></tr>` : ''}
            ${service ? `<tr><td style="padding:8px 0;font-size:13px;color:#64748b">Service</td><td style="padding:8px 0">${service}</td></tr>` : ''}
            ${source ? `<tr><td style="padding:8px 0;font-size:13px;color:#64748b">Found us via</td><td style="padding:8px 0">${source}</td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
          <p style="font-size:13px;color:#64748b;margin:0 0 8px">Message</p>
          <p style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0;line-height:1.7;font-size:15px">${message.replace(/\n/g, '<br>')}</p>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Reply directly to this email to respond to ${firstName}.</p>
        </div>
      </div>
    `,
  };

  // Always save message to messages.json regardless of email outcome
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
  saveMessage(msgEntry);

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Message sent! We'll get back to you within one business day." });
  } catch (err) {
    console.error('Contact email error:', err);
    // Message was already saved; still return a useful response
    res.json({ success: true, message: "Message received! We'll get back to you within one business day." });
  }
});

module.exports = router;
