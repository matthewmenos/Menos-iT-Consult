require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const session  = require('express-session');

const contactRoute    = require('./routes/contact');
const newsletterRoute = require('./routes/newsletter');
const authRoute       = require('./routes/auth');
const blogsRoute      = require('./routes/blogs');
const messagesRoute   = require('./routes/messages');

const app    = express();
const PORT   = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '../public');
const ADMIN  = path.join(__dirname, '../admin');

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'mit-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 },
}));

// ── Admin panel ──────────────────────────────────────────────
app.use('/admin', express.static(ADMIN));
app.get('/admin', (_req, res) => res.sendFile(path.join(ADMIN, 'index.html')));
app.get('/admin/*path', (_req, res) => res.sendFile(path.join(ADMIN, 'index.html')));

// ── API routes ───────────────────────────────────────────────
app.use('/api/auth',       authRoute);
app.use('/api/contact',    contactRoute);
app.use('/api/newsletter', newsletterRoute);
app.use('/api/blogs',      blogsRoute);
app.use('/api/messages',   messagesRoute);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Frontend static files ────────────────────────────────────
app.use(express.static(PUBLIC));

// ── Clean URL routing for pages ──────────────────────────────
// /about  → public/pages/about.html
// /blog   → public/pages/blog.html  etc.
const PAGE_ROUTES = [
  'about', 'services', 'portfolio', 'testimonials',
  'contact', 'blog', 'privacy', 'terms', 'cookies',
];

PAGE_ROUTES.forEach(page => {
  app.get(`/${page}`, (_req, res) => {
    res.sendFile(path.join(PUBLIC, 'pages', `${page}.html`));
  });
});

// ── 404 page ─────────────────────────────────────────────────
app.get('/404', (_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'pages', '404.html'));
});

// ── Fallback ─────────────────────────────────────────────────
app.get('/{*path}', (_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'pages', '404.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Menos iT Consult — http://localhost:${PORT}`);
  console.log(`  Admin panel       — http://localhost:${PORT}/admin\n`);
});
