/**
 * Content routes — public (read-only), consumed by the website pages.
 *   GET /api/content/testimonials  -> published testimonials (featured first, then newest)
 *   GET /api/content/projects      -> published projects     (featured first, then newest)
 *   GET /api/content/settings      -> editable site settings (stats, contact info, etc.)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

const DEFAULT_SETTINGS = {
  stats: { clients: 150, years: 12, satisfaction: 98, projects: 150 },
  contact: {
    email: 'minnahmat50@gmail.com',
    phone: '+233 549 128 384',
    whatsapp: '233549128384',
    location: 'Agona, Western Region, Ghana',
  },
};

router.get('/testimonials', async (req, res) => {
  try {
    const all = await db.getTestimonials();
    const published = all.filter(t => t.status === 'published');
    published.sort((a, b) => (b.featured - a.featured) ||
      (new Date(b.createdAt) - new Date(a.createdAt)));
    res.json(published);
  } catch (err) {
    console.error('[content] testimonials error:', err.message);
    res.status(500).json({ error: 'Failed to load testimonials.' });
  }
});

router.get('/projects', async (req, res) => {
  try {
    const all = await db.getProjects();
    const published = all.filter(p => p.status === 'published');
    published.sort((a, b) => (b.featured - a.featured) ||
      (new Date(b.createdAt) - new Date(a.createdAt)));
    res.json(published);
  } catch (err) {
    console.error('[content] projects error:', err.message);
    res.status(500).json({ error: 'Failed to load projects.' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const rows = await db.getSettings();
    const stored = {};
    for (const r of rows) stored[r.key] = r.value;
    res.json({ ...DEFAULT_SETTINGS, ...stored });
  } catch (err) {
    console.error('[content] settings error:', err.message);
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

module.exports = router;
