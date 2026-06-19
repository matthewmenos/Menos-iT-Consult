const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAuth = require('../middleware/auth');
const router = express.Router();

const MESSAGES_FILE = path.join(__dirname, '../data/messages.json');

function loadMessages() {
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveMessages(messages) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// GET / — all messages sorted newest first (auth required)
router.get('/', requireAuth, (req, res) => {
  const messages = loadMessages();
  const sorted = messages.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted);
});

// DELETE /:id — delete message (auth required)
router.delete('/:id', requireAuth, (req, res) => {
  const messages = loadMessages();
  const idx = messages.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Message not found.' });

  messages.splice(idx, 1);
  saveMessages(messages);
  res.json({ success: true });
});

// PATCH /:id/read — mark message as read (auth required)
router.patch('/:id/read', requireAuth, (req, res) => {
  const messages = loadMessages();
  const idx = messages.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Message not found.' });

  messages[idx].read = true;
  saveMessages(messages);
  res.json(messages[idx]);
});

module.exports = router;
