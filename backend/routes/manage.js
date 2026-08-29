/**
 * Admin manage routes — full CRUD over site content (auth required).
 *   GET/POST            /api/manage/testimonials
 *   GET/PUT/DELETE      /api/manage/testimonials/:id
 *   PATCH               /api/manage/testimonials/:id/status
 *   GET/POST            /api/manage/projects
 *   GET/PUT/DELETE      /api/manage/projects/:id
 *   PATCH               /api/manage/projects/:id/status
 *   GET/PUT             /api/manage/settings
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

const newId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;

function cleanStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}
function clampRating(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : fallback;
}
function cleanOutcomes(v, fallback) {
  if (!Array.isArray(v)) return fallback;
  return v.map(cleanStr).filter(Boolean).slice(0, 8);
}
function cleanStatus(v, fallback) {
  if (v === 'draft' || v === 'published') return v;
  return fallback;
}
// image = our own /api/images/:id URL (set by the upload endpoint) or a remote URL
function cleanImage(v) {
  const s = cleanStr(v);
  if (!s) return '';
  return /^\/api\/images\//.test(s) || /^https:\/\//.test(s) ? s.slice(0, 500) : '';
}

// ── uploads ─────────────────────────────────────────────────────────────────
// The client sends the raw image bytes as the request body (Content-Type:
// image/jpeg etc.) — no multipart parser needed. Returns { id, url }.
router.post(
  '/upload',
  express.raw({ type: () => true, limit: '4mb' }),
  async (req, res) => {
    try {
      const mime = (req.headers['content-type'] || '').split(';')[0].trim();
      const saved = await db.saveImage(req.body, mime);
      res.status(201).json(saved);
    } catch (err) {
      if (err.badRequest) return res.status(400).json({ error: err.message });
      if (err.noDb) return res.status(503).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: 'Failed to upload image.' });
    }
  }
);

// ── testimonials ───────────────────────────────────────────────────────────
router.get('/testimonials', async (req, res) => {
  try { res.json(await db.getTestimonials()); }
  catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to load testimonials.' }); }
});

router.post('/testimonials', async (req, res) => {
  try {
    const b = req.body || {};
    if (!cleanStr(b.name) || !cleanStr(b.quote)) {
      return res.status(400).json({ error: 'Name and quote are required.' });
    }
    const t = await db.createTestimonial({
      id: newId('tst'),
      name: cleanStr(b.name).slice(0, 120),
      role: cleanStr(b.role).slice(0, 120),
      company: cleanStr(b.company).slice(0, 120),
      location: cleanStr(b.location).slice(0, 120),
      rating: clampRating(b.rating, 5),
      quote: cleanStr(b.quote).slice(0, 2000),
      image: cleanImage(b.image),
      featured: !!b.featured,
      status: cleanStatus(b.status, 'published'),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(t);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to create testimonial.' }); }
});

router.get('/testimonials/:id', async (req, res) => {
  try {
    const t = await db.getTestimonial(req.params.id);
    if (!t) return res.status(404).json({ error: 'Not found.' });
    res.json(t);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to load testimonial.' }); }
});

router.put('/testimonials/:id', async (req, res) => {
  try {
    const existing = await db.getTestimonial(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    const t = await db.updateTestimonial(req.params.id, {
      name: cleanStr(b.name) || existing.name,
      role: cleanStr(b.role),
      company: cleanStr(b.company),
      location: cleanStr(b.location),
      rating: clampRating(b.rating, existing.rating),
      quote: cleanStr(b.quote) || existing.quote,
      image: b.image === undefined ? existing.image : cleanImage(b.image),
      featured: b.featured === undefined ? existing.featured : !!b.featured,
      status: cleanStatus(b.status, existing.status),
    });
    res.json(t);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to update testimonial.' }); }
});

router.patch('/testimonials/:id/status', async (req, res) => {
  try {
    const status = cleanStatus(req.body && req.body.status, null);
    if (!status) return res.status(400).json({ error: "status must be 'draft' or 'published'." });
    const t = await db.setTestimonialStatus(req.params.id, status);
    if (!t) return res.status(404).json({ error: 'Not found.' });
    res.json(t);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to update status.' }); }
});

router.delete('/testimonials/:id', async (req, res) => {
  try {
    await db.deleteTestimonial(req.params.id);
    res.json({ success: true });
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to delete testimonial.' }); }
});

// ── projects ───────────────────────────────────────────────────────────────
router.get('/projects', async (req, res) => {
  try { res.json(await db.getProjects()); }
  catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to load projects.' }); }
});

router.post('/projects', async (req, res) => {
  try {
    const b = req.body || {};
    if (!cleanStr(b.title)) return res.status(400).json({ error: 'Title is required.' });
    const p = await db.createProject({
      id: newId('prj'),
      title: cleanStr(b.title).slice(0, 200),
      category: cleanStr(b.category).slice(0, 40),
      client: cleanStr(b.client).slice(0, 120),
      location: cleanStr(b.location).slice(0, 120),
      description: cleanStr(b.description).slice(0, 4000),
      image: cleanImage(b.image),
      outcomes: cleanOutcomes(b.outcomes, []),
      year: cleanStr(b.year).slice(0, 10),
      featured: !!b.featured,
      status: cleanStatus(b.status, 'published'),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(p);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to create project.' }); }
});

router.get('/projects/:id', async (req, res) => {
  try {
    const p = await db.getProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    res.json(p);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to load project.' }); }
});

router.put('/projects/:id', async (req, res) => {
  try {
    const existing = await db.getProject(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found.' });
    const b = req.body || {};
    const p = await db.updateProject(req.params.id, {
      title: cleanStr(b.title) || existing.title,
      category: cleanStr(b.category),
      client: cleanStr(b.client),
      location: cleanStr(b.location),
      description: cleanStr(b.description),
      image: b.image === undefined ? existing.image : cleanImage(b.image),
      outcomes: cleanOutcomes(b.outcomes, existing.outcomes),
      year: cleanStr(b.year),
      featured: b.featured === undefined ? existing.featured : !!b.featured,
      status: cleanStatus(b.status, existing.status),
    });
    res.json(p);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to update project.' }); }
});

router.patch('/projects/:id/status', async (req, res) => {
  try {
    const status = cleanStatus(req.body && req.body.status, null);
    if (!status) return res.status(400).json({ error: "status must be 'draft' or 'published'." });
    const p = await db.setProjectStatus(req.params.id, status);
    if (!p) return res.status(404).json({ error: 'Not found.' });
    res.json(p);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to update status.' }); }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    await db.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to delete project.' }); }
});

// ── settings (stats + contact info shown across the site) ──────────────────
router.get('/settings', async (req, res) => {
  try {
    const rows = await db.getSettings();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    res.json(out);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to load settings.' }); }
});

router.put('/settings', async (req, res) => {
  try {
    const b = req.body || {};
    const entries = [];
    if (b.stats && typeof b.stats === 'object' && !Array.isArray(b.stats)) {
      const s = b.stats;
      const num = (v) => Math.max(0, parseInt(v, 10) || 0);
      entries.push(['stats', {
        clients: num(s.clients),
        years: num(s.years),
        satisfaction: Math.min(100, num(s.satisfaction)),
        projects: num(s.projects),
      }]);
    }
    if (b.contact && typeof b.contact === 'object' && !Array.isArray(b.contact)) {
      const c = b.contact;
      entries.push(['contact', {
        email: cleanStr(c.email).slice(0, 200),
        phone: cleanStr(c.phone).slice(0, 40),
        whatsapp: cleanStr(c.whatsapp).replace(/[^0-9]/g, '').slice(0, 20),
        location: cleanStr(c.location).slice(0, 200),
      }]);
    }
    if (entries.length === 0) {
      return res.status(400).json({ error: 'No valid settings provided (expected stats and/or contact).' });
    }
    await db.upsertSettings(entries);
    const rows = await db.getSettings();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    res.json(out);
  } catch (err) { if (err.noDb) return res.status(503).json({ error: err.message }); console.error(err); res.status(500).json({ error: 'Failed to save settings.' }); }
});

module.exports = router;
