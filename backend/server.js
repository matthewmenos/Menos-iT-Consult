require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const fs            = require('fs');
const cookieParser  = require('cookie-parser');
const db            = require('./db');

const contactRoute    = require('./routes/contact');
const newsletterRoute = require('./routes/newsletter');
const authRoute       = require('./routes/auth');
const blogsRoute      = require('./routes/blogs');
const messagesRoute   = require('./routes/messages');

const app    = express();
app.set('trust proxy', 1); // served behind Nginx/Vercel — respect X-Forwarded-* headers
const PORT   = process.env.PORT || 3000;

// ── Static directories across deployment layouts ────────────────────────────
//  • local / PM2:            backend/server.js        → ../public (one level up)
//  • Vercel function:        includeFiles copies `public/**` next to the bundled
//    handler (api/index.js)  → __dirname/public
// Pick the first directory that actually exists so both layouts work.
function firstDir(...candidates) {
  for (const dir of candidates) {
    try { if (fs.statSync(dir).isDirectory()) return dir; } catch (_) { /* keep looking */ }
  }
  return candidates[0];
}
const PUBLIC = firstDir(
  path.join(__dirname, 'public'),
  path.join(__dirname, '../public'),
  path.join(process.cwd(), 'public')
);
const ADMIN  = firstDir(
  path.join(__dirname, 'admin'),
  path.join(__dirname, '../admin'),
  path.join(process.cwd(), 'admin')
);

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Stateless auth (no in-memory session store) ────────────────────────────
// Admin logs in once; an httpOnly *signed* cookie carries the auth flag, so
// nothing expires between Vercel cold starts and the same cookie is honoured
// on every request (via req.signedCookies). The signing key is SESSION_SECRET.
app.use(cookieParser(process.env.SESSION_SECRET));

// ── Admin panel ────────────────────────────────────────────────────────────
// Serve /admin directly (200) and disable the static trailing-slash redirect
// so the admin entry point never 301s. /admin/* assets and the SPA fallback
// (/admin/<anything> -> index.html) still work via the handlers below.
app.get('/admin', (_req, res) => res.sendFile(path.join(ADMIN, 'index.html')));
app.use('/admin', express.static(ADMIN, { redirect: false }));
// Dedicated admin login page (served before the SPA fallback; /admin/login.html
// is also served directly by the static handler above).
app.get('/admin/login', (_req, res) => res.sendFile(path.join(ADMIN, 'login.html')));
app.get('/admin/*path', (_req, res) => res.sendFile(path.join(ADMIN, 'index.html')));

// ── API routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoute);
app.use('/api/contact',    contactRoute);
app.use('/api/newsletter', newsletterRoute);
app.use('/api/blogs',      blogsRoute);
app.use('/api/messages',   messagesRoute);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Frontend static files ──────────────────────────────────────────────────
app.use(express.static(PUBLIC));

// ── Clean URL routing for pages ────────────────────────────────────────────
// /about  -> public/pages/about.html
// /blog   -> public/pages/blog.html  etc.
const PAGE_ROUTES = [
  'about', 'services', 'portfolio', 'testimonials',
  'contact', 'blog', 'privacy', 'terms', 'cookies',
];

PAGE_ROUTES.forEach(page => {
  app.get(`/${page}`, (_req, res) => {
    res.sendFile(path.join(PUBLIC, 'pages', `${page}.html`));
  });
});

// ── Page aliases (*.html) ─────────────────────────────────────────────────
// Lets the relative links used inside pages/*.html (e.g. `about.html`) resolve
// even when a visitor arrives via a clean URL such as /contact.
PAGE_ROUTES.forEach(page => {
  app.get(`/${page}.html`, (_req, res) => {
    res.sendFile(path.join(PUBLIC, 'pages', `${page}.html`));
  });
});

// ── Blog article pages ─────────────────────────────────────────────────────
// /blog/<slug> → public/pages/blog-post.html. The page fetches the post from
// GET /api/blogs/slug/:slug (published only) and renders it client-side.
app.get('/blog/:slug', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'pages', 'blog-post.html'));
});

// ── 404 page ───────────────────────────────────────────────────────────────
app.get('/404', (_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'pages', '404.html'));
});

// ── Fallback ─────────────────────────────────────────────────
app.get('/{*path}', (_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'pages', '404.html'));
});

  // Only start the HTTP server when run directly (`node server.js` / PM2).
// When imported by api.js for Vercel, we just export the app (handler).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Menos iT Consult — http://localhost:${PORT}`);
    console.log(`  Admin panel       — http://localhost:${PORT}/admin`);
    console.log(`  API health        — http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;