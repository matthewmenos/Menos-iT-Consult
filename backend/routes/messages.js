const express     = require('express');
const db          = require('../db');
const requireAuth = require('../middleware/auth');
const router      = express.Router();

// GET / — all messages sorted newest first (auth required)
router.get('/', requireAuth, async (req, res) => {
  try {
    res.json(await db.getMessages());
  } catch (err) {
    console.error(err);
    if (err.noDb) {
      return res.status(503).json({ error: err.message });    }
    res.status(500).json({ error: 'Database error.' });
  }
});

// DELETE /:id — delete message (auth required)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const m = await db.getMessage(req.params.id);
    if (!m) return res.status(404).json({ error: 'Message not found.' });
    await db.deleteMessage(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.noDb) {
      return res.status(503).json({ error: err.message });    }
    res.status(500).json({ error: 'Database error.' });
  }
});

// PATCH /:id/read — mark message as read (auth required)
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const m = await db.markMessageRead(req.params.id);
    if (!m) return res.status(404).json({ error: 'Message not found.' });
    res.json(m);
  } catch (err) {
    console.error(err);
    if (err.noDb) {
      return res.status(503).json({ error: err.message });    }
    res.status(500).json({ error: 'Database error.' });
  }
});

module.exports = router;