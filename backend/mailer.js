/**
 * Contact-form mailer — sends two branded emails per submission:
 *   1. CUSTOMER  — confirmation with their details + what happens next
 *   2. ADMIN     — new-lead alert, reply-to the customer
 *
 * SMTP is read lazily from env (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS).
 * If it isn't configured, sendContactEmails() reports ok:false for both and
 * the contact route still succeeds — the enquiry is persisted regardless.
 *
 * Recipient + phone/WhatsApp/location copy come from RECIPIENT_EMAIL and the
 * admin-maintained "contact" setting (Admin → Settings) so emails always
 * reflect what the site shows.
 */
const nodemailer = require('nodemailer');
const db = require('./db');

const SITE_URL = (process.env.SITE_URL || 'https://menositsolutions.vercel.app').replace(/\/$/, '');

// ── transport (lazy, cached) ───────────────────────────────────────────────
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

// ── who receives the admin alert / what contact copy to show ──────────────
// RECIPIENT_EMAIL first, then the admin-maintained contact email from
// Settings, then the SMTP account itself.
async function resolveContactContext() {
  const ctx = { email: null, phone: '', whatsapp: '', location: '' };
  try {
    const s = await db.getSetting('contact');
    if (s && typeof s === 'object') {
      if (typeof s.email === 'string' && s.email.trim()) ctx.email = s.email.trim();
      ctx.phone = typeof s.phone === 'string' ? s.phone.trim() : '';
      ctx.whatsapp = typeof s.whatsapp === 'string' ? s.whatsapp.trim() : '';
      ctx.location = typeof s.location === 'string' ? s.location.trim() : '';
    }
  } catch (_) { /* DB not available — fall through to env defaults */ }
  const fromEnv = (process.env.RECIPIENT_EMAIL || '').trim();
  if (fromEnv) ctx.email = fromEnv;
  if (!ctx.email) ctx.email = (process.env.SMTP_USER || '').trim() || null;
  return ctx;
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  return `<tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:140px">${label}</td><td style="padding:8px 0;font-weight:600">${value}</td></tr>`;
}

function waLink(ctx) {
  return ctx.whatsapp ? `https://wa.me/${ctx.whatsapp.replace(/[^\d]/g, '')}` : '';
}

// ── email 1: customer confirmation ─────────────────────────────────────────
function customerEmail(sub, ctx) {
  const firstName = esc(sub.name.split(' ')[0] || sub.name);
  const wa = waLink(ctx);
  const subject = "We've received your message — Menos iT Consult";
  const html = `
  <div style="font-family:Inter,system-ui,Segoe UI,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;background:#f1f5f9;padding:24px 12px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#1a56db,#1e3a8a);padding:30px 32px;text-align:center">
        <img src="${SITE_URL}/assets/logo.jpg" alt="Menos iT Consult" width="64" height="64" style="width:64px;height:64px;border-radius:50%;border:3px solid rgba(255,255,255,.35);display:inline-block"/>
        <p style="color:#ffffff;margin:12px 0 0;font-size:19px;font-weight:700;letter-spacing:.2px">Menos <span style="color:#93c5fd">iT</span> Consult</p>
      </div>
      <div style="padding:32px">
        <h2 style="margin:0 0 10px;font-size:21px">Thanks, ${firstName}! 👋</h2>
        <p style="margin:0 0 22px;line-height:1.7;font-size:15px;color:#334155">
          We've received your message and one of our engineers will get back to you
          <strong>within one business day</strong>. Here's what you sent us:
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px">
          <table style="width:100%;border-collapse:collapse">
            ${row('Name', esc(sub.name))}
            ${row('Email', `<a href="mailto:${esc(sub.email)}" style="color:#1a56db">${esc(sub.email)}</a>`)}
            ${sub.phone ? row('Phone', esc(sub.phone)) : ''}
            ${sub.service ? row('Service', esc(sub.service)) : ''}
          </table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
          <p style="font-size:13px;color:#64748b;margin:0 0 8px">Your message</p>
          <p style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:0;line-height:1.7;font-size:14px">${esc(sub.message).replace(/\n/g, '<br>')}</p>
        </div>
        <p style="margin:24px 0 10px;font-size:14px;font-weight:700">What happens next</p>
        <ol style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:2">
          <li>We review your enquiry and match it to the right specialist.</li>
          <li>You'll hear from us by email or phone within one business day.</li>
          ${wa ? '<li>Need us sooner? Chat with us on WhatsApp below.</li>' : ''}
        </ol>
        ${wa ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto 4px"><tr>
          <td bgcolor="#1a56db" style="border-radius:8px">
            <a href="${wa}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">Chat on WhatsApp</a>
          </td>
        </tr></table>` : ''}
        <p style="margin:26px 0 0;font-size:13px;color:#94a3b8;text-align:center">
          Didn't submit this form? You can ignore this email — or
          <a href="mailto:${esc(ctx.email || process.env.SMTP_USER || '')}" style="color:#1a56db">let us know</a>.
        </p>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;text-align:center">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.8">
          ${esc(ctx.location || 'Agona, Western Region, Ghana')}<br/>
          ${ctx.phone ? `${esc(ctx.phone)} · ` : ''}<a href="${SITE_URL}" style="color:#64748b">${SITE_URL.replace('https://', '')}</a>
        </p>
      </div>
    </div>
  </div>`;
  const text = [
    `Thanks, ${sub.name.split(' ')[0] || sub.name}!`,
    '',
    "We've received your message and will get back to you within one business day.",
    '',
    `Name: ${sub.name}`,
    `Email: ${sub.email}`,
    sub.phone ? `Phone: ${sub.phone}` : '',
    sub.service ? `Service: ${sub.service}` : '',
    '',
    'Your message:',
    sub.message,
    '',
    wa ? `WhatsApp us: ${wa}` : '',
    SITE_URL,
  ].filter(Boolean).join('\n');
  return { subject, html, text };
}

// ── email 2: admin alert ───────────────────────────────────────────────────
function adminEmail(sub) {
  const subject = `New enquiry from ${sub.name}`;
  const html = `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
    <div style="background:#1a56db;padding:28px 32px;border-radius:12px 12px 0 0">
      <h2 style="color:#fff;margin:0;font-size:20px">New Contact Form Submission</h2>
      <p style="color:#93c5fd;margin:4px 0 0;font-size:14px">Menos iT Consult Website</p>
    </div>
    <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
      <table style="width:100%;border-collapse:collapse">
        ${row('Name', esc(sub.name))}
        ${row('Email', `<a href="mailto:${esc(sub.email)}" style="color:#1a56db">${esc(sub.email)}</a>`)}
        ${sub.phone ? row('Phone', esc(sub.phone)) : ''}
        ${sub.service ? row('Service', esc(sub.service)) : ''}
        ${sub.source ? row('Found us via', esc(sub.source)) : ''}
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
      <p style="font-size:13px;color:#64748b;margin:0 0 8px">Message</p>
      <p style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0;line-height:1.7;font-size:15px">${esc(sub.message).replace(/\n/g, '<br>')}</p>
      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Reply directly to this email to respond to ${esc(sub.name.split(' ')[0] || sub.name)}. A confirmation copy was also sent to the customer.</p>
    </div>
  </div>`;
  const text = [
    'New contact form submission:',
    '',
    `Name: ${sub.name}`,
    `Email: ${sub.email}`,
    sub.phone ? `Phone: ${sub.phone}` : '',
    sub.service ? `Service: ${sub.service}` : '',
    sub.source ? `Source: ${sub.source}` : '',
    '',
    sub.message,
  ].filter(Boolean).join('\n');
  return { subject, html, text };
}

// ── send both (parallel; one failing must not block the other) ─────────────
async function sendContactEmails(sub) {
  const result = {
    configured: !!getTransporter(),
    recipient: null,
    admin:    { ok: false, error: '' },
    customer: { ok: false, error: '' },
  };
  const transporter = getTransporter();
  if (!transporter) {
    result.admin.error = result.customer.error = 'SMTP not configured';
    return result;
  }
  const ctx = await resolveContactContext();
  result.recipient = ctx.email;

  const from = `"Menos iT Consult" <${process.env.SMTP_USER}>`;
  const customer = customerEmail(sub, ctx);
  const admin = adminEmail(sub);

  const jobs = [
    transporter.sendMail({
      from,
      to: sub.email,
      subject: customer.subject,
      html: customer.html,
      text: customer.text,
    }).then(
      () => { result.customer.ok = true; },
      (err) => {
        result.customer.error = err && err.message ? err.message : String(err);
        console.error('Customer email error:', err);
      }
    ),
    transporter.sendMail({
      from,
      to: ctx.email,
      replyTo: sub.email,
      subject: admin.subject,
      html: admin.html,
      text: admin.text,
    }).then(
      () => { result.admin.ok = true; },
      (err) => {
        result.admin.error = err && err.message ? err.message : String(err);
        console.error('Admin email error:', err);
      }
    ),
  ];
  await Promise.all(jobs);
  return result;
}

module.exports = { sendContactEmails, resolveContactContext, getTransporter };


