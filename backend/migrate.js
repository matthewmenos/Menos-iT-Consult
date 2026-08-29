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

  // ── testimonials ──
  const testimonials = readJson('testimonials.json', []);
  let tstAdded = 0;
  for (const t of testimonials) {
    if (!t.id || !t.quote) continue;
    const exists = await db.getTestimonial(t.id);
    if (!exists) {
      await db.createTestimonial({
        id: t.id,
        name: t.name || '',
        role: t.role || '',
        company: t.company || '',
        location: t.location || '',
        rating: t.rating || 5,
        quote: t.quote,
        featured: !!t.featured,
        status: t.status || 'published',
        createdAt: t.createdAt,
      });
      tstAdded++;
    }
  }
  console.log('Testimonials migrated: ' + tstAdded + '/' + testimonials.length);

  // ── projects ──
  const projects = readJson('projects.json', []);
  let prjAdded = 0;
  for (const p of projects) {
    if (!p.id || !p.title) continue;
    const exists = await db.getProject(p.id);
    if (!exists) {
      await db.createProject({
        id: p.id,
        title: p.title,
        category: p.category || '',
        client: p.client || '',
        location: p.location || '',
        description: p.description || '',
        outcomes: Array.isArray(p.outcomes) ? p.outcomes : [],
        year: p.year || '',
        featured: !!p.featured,
        status: p.status || 'published',
        createdAt: p.createdAt,
      });
      prjAdded++;
    }
  }
  console.log('Projects migrated: ' + prjAdded + '/' + projects.length);

  // ── settings (defaults; skipped if already set) ──
  const existingStats = await db.getSetting('stats');
  if (!existingStats) {
    await db.setSetting('stats', { clients: 150, years: 12, satisfaction: 98, projects: 150 });
    console.log('Default stats seeded.');
  }
  const existingContact = await db.getSetting('contact');
  if (!existingContact) {
    await db.setSetting('contact', {
      email: 'minnahmat50@gmail.com',
      phone: '+233 549 128 384',
      whatsapp: '233549128384',
      location: 'Agona, Western Region, Ghana',
    });
    console.log('Default contact info seeded.');
  }

  console.log('Migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});