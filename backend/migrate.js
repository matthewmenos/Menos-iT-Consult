/**
 * One-time migration: creates the Postgres schema (CREATE TABLE IF NOT EXISTS)
 * and seeds it from the existing flat-file JSON in backend/data/*.json.
 *
 * Idempotent: existing rows (by id/email) are skipped, so re-running is safe.
 *
 * Usage:  node migrate.js
  * Env:    POSTGRES_URL, ADMIN_PASSWORD (for the admin login), NODE_ENV=production
 */
require('dotenv').config();
const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const db     = require('./db');

const DATA = path.join(__dirname, 'data');
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
  } catch (err) {
    return fallback;
  }
}

async function main() {
  await db.initDb();

  // ── admin ──
  const admin = await db.getAdmin();
  if (!admin.passwordHash) {
    const pw = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(pw, 12);
    await db.updateAdminPassword(hash);
    console.log('Admin password set. Login with: admin / ' + pw);
  } else {
    console.log('Admin already has a password hash (unchanged).');
  }

  // ── blogs ──
  const blogs = readJson('blogs.json', []);
  let blogsAdded = 0;
  for (const b of blogs) {
    if (!b.id) continue;
    const exists = await db.getBlog(b.id);
    if (!exists) { await db.createBlog(b); blogsAdded++; }
  }
  console.log('Blogs migrated: ' + blogsAdded + '/' + blogs.length);

  // ── messages ──
  const messages = readJson('messages.json', []);
  let msgsAdded = 0;
  for (const m of messages) {
    if (!m.id) continue;
    const exists = await db.getMessage(m.id);
    if (!exists) { await db.saveMessage(m); msgsAdded++; }
  }
  console.log('Messages migrated: ' + msgsAdded + '/' + messages.length);

  // ── subscribers ──
  const subs = readJson('subscribers.json', []);
  let subsAdded = 0;
  for (const s of subs) {
    if (!s.email) continue;
    const existing = await db.getSubscribers();
    const already = existing.find(x => x.email.toLowerCase() === s.email.toLowerCase());
    if (!already) { await db.addSubscriber(s.email); subsAdded++; }
  }
  console.log('Subscribers migrated: ' + subsAdded + '/' + subs.length);

  console.log('Migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});