const express   = require('express');
const db        = require('../db');
const mailer    = require('../mailer');
const router    = express.Router();

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

  // 2) Auto-subscribe to the newsletter (best-effort — never fails the form).
  //    New subscribers get first/last name captured so admin can personalise
  //    tips with {{firstName}} / {{lastName}} / {{fullName}} etc.
  try {
    await db.addSubscriber(email, firstName, lastName);
  } catch (err) {
    console.warn('[contact] could not add to newsletter:', err.message || err);
  }

  // 3) Notify — branded confirmation to the customer + new-lead alert to the
  //    admin, sent in parallel. Email failure never fails the form: the
  //    enquiry is already persisted, and mailer reports per-recipient status.
  const mail = await mailer.sendContactEmails(msgEntry);
  if (!mail.configured) {
    console.warn('[contact] SMTP not configured — enquiry saved without emails.');
  }

  if (persisted || mail.admin.ok || mail.customer.ok) {
    return res.json({
      success: true,
      message: "Message sent! We'll get back to you within one business day.",
      storedIn: storageWhere,
      notifiedAdmin: mail.admin.ok,
      confirmedCustomer: mail.customer.ok,
    });
  }

  // Neither storage nor email succeeded — be honest with the visitor.
  const reason = mail.admin.error || mail.customer.error || 'delivery error';
  return res.status(500).json({
    error: `Sorry, your message could not be delivered right now (${reason}). Please email us directly at ${mail.recipient || process.env.SMTP_USER || 'our support address'}.`,
  });
});

module.exports = router;