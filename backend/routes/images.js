/**
 * Public image-serving route.
 *   - Legacy rows: bytes live in Postgres (Vercel filesystem is read-only).
 *   - R2 rows (storage='r2'): bytes live in Cloudflare R2. If R2_PUBLIC_BASE
 *     is configured we 302 to the permanent public URL; otherwise the bytes
 *     are streamed through this route. IDs are unique per upload, so the
 *     response is cached immutably.
 *   GET /api/images/:id  -> image bytes (Content-Type per stored mime)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const r2 = require('../r2');

router.get('/:id', async (req, res) => {
  try {
    const img = await db.getImage(req.params.id);
    if (!img) return res.status(404).json({ error: 'Image not found.' });

    if (img.storage === 'r2') {
      const base = r2.publicBase();
      if (base) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        return res.redirect(302, `${base}/${img.r2Key}`);
      }
      try {
        const bytes = await r2.getImageBytes(img.r2Key);
        res.set('Content-Type', img.mime);
        res.set('Content-Length', String(bytes.length));
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(bytes);
      } catch (err) {
        console.error('[images] R2 fetch failed:', err.message);
        return res.status(502).json({ error: 'Failed to fetch image from storage.' });
      }
    }

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