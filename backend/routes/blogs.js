const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../middleware/auth');
const router = express.Router();

const BLOGS_FILE = path.join(__dirname, '../data/blogs.json');

function loadBlogs() {
  try {
    return JSON.parse(fs.readFileSync(BLOGS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveBlogs(blogs) {
  fs.writeFileSync(BLOGS_FILE, JSON.stringify(blogs, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// GET / — all blogs (public)
router.get('/', (req, res) => {
  const blogs = loadBlogs();
  res.json(blogs);
});

// GET /:id — single blog (public)
router.get('/:id', (req, res) => {
  const blogs = loadBlogs();
  const blog = blogs.find(b => b.id === req.params.id);
  if (!blog) return res.status(404).json({ error: 'Blog post not found.' });
  res.json(blog);
});

// POST / — create blog (auth required)
router.post('/', requireAuth, (req, res) => {
  const blogs = loadBlogs();
  const now = new Date().toISOString();
  const newBlog = {
    id: generateId(),
    title: req.body.title || '',
    slug: req.body.slug || '',
    category: req.body.category || '',
    readTime: req.body.readTime || '',
    excerpt: req.body.excerpt || '',
    content: req.body.content || '',
    featured: req.body.featured || false,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  blogs.push(newBlog);
  saveBlogs(blogs);
  res.status(201).json(newBlog);
});

// PUT /:id — update blog (auth required)
router.put('/:id', requireAuth, (req, res) => {
  const blogs = loadBlogs();
  const idx = blogs.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Blog post not found.' });

  const existing = blogs[idx];
  const updated = {
    ...existing,
    title: req.body.title !== undefined ? req.body.title : existing.title,
    slug: req.body.slug !== undefined ? req.body.slug : existing.slug,
    category: req.body.category !== undefined ? req.body.category : existing.category,
    readTime: req.body.readTime !== undefined ? req.body.readTime : existing.readTime,
    excerpt: req.body.excerpt !== undefined ? req.body.excerpt : existing.excerpt,
    content: req.body.content !== undefined ? req.body.content : existing.content,
    featured: req.body.featured !== undefined ? req.body.featured : existing.featured,
    updatedAt: new Date().toISOString(),
  };
  blogs[idx] = updated;
  saveBlogs(blogs);
  res.json(updated);
});

// DELETE /:id — delete blog (auth required)
router.delete('/:id', requireAuth, (req, res) => {
  const blogs = loadBlogs();
  const idx = blogs.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Blog post not found.' });

  blogs.splice(idx, 1);
  saveBlogs(blogs);
  res.json({ success: true });
});

// PATCH /:id/publish — publish blog (auth required)
router.patch('/:id/publish', requireAuth, (req, res) => {
  const blogs = loadBlogs();
  const idx = blogs.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Blog post not found.' });

  blogs[idx].status = 'published';
  blogs[idx].updatedAt = new Date().toISOString();
  saveBlogs(blogs);
  res.json(blogs[idx]);
});

// PATCH /:id/unpublish — unpublish blog (auth required)
router.patch('/:id/unpublish', requireAuth, (req, res) => {
  const blogs = loadBlogs();
  const idx = blogs.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Blog post not found.' });

  blogs[idx].status = 'draft';
  blogs[idx].updatedAt = new Date().toISOString();
  saveBlogs(blogs);
  res.json(blogs[idx]);
});

module.exports = router;
