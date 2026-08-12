const express        = require('express');
const db             = require('../db');
const requireAuth    = require('../middleware/auth');
const router         = express.Router();

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// GET / — all blogs (public)
router.get('/', async (req, res) => {
  try {
    res.json(await db.getBlogs());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// GET /:id — single blog (public)
router.get('/:id', async (req, res) => {
  try {
    const blog = await db.getBlog(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog post not found.' });
    res.json(blog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// POST / — create blog (auth required)
router.post('/', requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const newBlog = {
      id: generateId(),
      title:     req.body.title || '',
      slug:      req.body.slug || '',
      category:  req.body.category || '',
      readTime:  req.body.readTime || '',
      excerpt:   req.body.excerpt || '',
      content:   req.body.content || '',
      featured:  !!req.body.featured,
      status:    'draft',
      createdAt: now,
      updatedAt: now,
    };
    res.status(201).json(await db.createBlog(newBlog));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// PUT /:id — update blog (auth required)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.getBlog(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Blog post not found.' });
    const updated = {
      ...existing,
      title:     req.body.title !== undefined     ? req.body.title     : existing.title,
      slug:      req.body.slug !== undefined      ? req.body.slug      : existing.slug,
      category:  req.body.category !== undefined  ? req.body.category  : existing.category,
      readTime:  req.body.readTime !== undefined  ? req.body.readTime  : existing.readTime,
      excerpt:   req.body.excerpt !== undefined   ? req.body.excerpt   : existing.excerpt,
      content:   req.body.content !== undefined   ? req.body.content   : existing.content,
      featured:  req.body.featured !== undefined  ? !!req.body.featured : existing.featured,
      updatedAt: new Date().toISOString(),
    };
    res.json(await db.updateBlog(req.params.id, updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// DELETE /:id — delete blog (auth required)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.getBlog(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Blog post not found.' });
    await db.deleteBlog(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// PATCH /:id/publish — publish blog (auth required)
router.patch('/:id/publish', requireAuth, async (req, res) => {
  try {
    const b = await db.setBlogStatus(req.params.id, 'published');
    if (!b) return res.status(404).json({ error: 'Blog post not found.' });
    res.json(b);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

// PATCH /:id/unpublish — unpublish blog (auth required)
router.patch('/:id/unpublish', requireAuth, async (req, res) => {
  try {
    const b = await db.setBlogStatus(req.params.id, 'draft');
    if (!b) return res.status(404).json({ error: 'Blog post not found.' });
    res.json(b);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error.' });
  }
});

module.exports = router;