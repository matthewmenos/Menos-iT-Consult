/**
 * Public image-serving route — bytes for uploaded images live in Postgres
 * (the Vercel filesystem is read-only). IDs are unique per upload, so the
 * response is cached immutably.
 *   GET /api/images/:id  -> image bytes (Content-Type per stored mime)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/:id', async (req, res) => {
  try {
    const img = await db.getImage(req.params.id);
    if (!img) return res.status(404).json({ error: 'Image not found.' });
    res.set('Content-Type', img.mime);
    res.set('Content-Length', String(img.bytes.length));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(img.bytes);
  } catch (err) {
    if (err.noDb) return res.status(503).json({ error: err.message });
    console.error('[images] error:', err.message);
    res.status(500).json({ error: 'Failed to load image.' });
  }
});

module.exports = router;