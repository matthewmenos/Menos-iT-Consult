require('dotenv').config({ path: require('path').join(__dirname, '.env') });

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
const contentRoute    = require('./routes/content');
const manageRoute     = require('./routes/manage');
const imagesRoute     = require('./routes/images');

const app  = express();
app.set('trust proxy', 1); // behind Nginx/Vercel - respect X-Forwarded-* headers
const PORT = process.env.PORT || 3000;

// -- Static dirs across deployment layouts -----------------------------------
// local/PM2: backend/server.js -> ../public; Vercel: includeFiles copies
// public/** and admin/** next to the bundled handler -> __dirname/public.
function firstDir(...candidates) {
  for (const dir of candidates) {
    try { if (fs.statSync(dir).isDirectory()) return dir; } catch (_) { /* next */ }
  }
  return candidates[0];
}
const PUBLIC = firstDir(
  path.join(__dirname, 'public'),
  path.join(__dirname, '../public'),
  path.join(process.cwd(), 'public')
);
const ADMIN = firstDir(
  path.join(__dirname, 'admin'),
  path.join(__dirname, '../admin'),
  path.join(process.cwd(), 'admin')
);

app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}));
// JSON body — raised to 2 MB so base64-encoded image payloads (from the admin
// content editor's image upload) are accepted by the API layer.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// -- Stateless auth -----------------------------------------------------------
// httpOnly *signed* cookie carries the admin flag; nothing expires between
// Vercel cold starts. Signing key is SESSION_SECRET.
app.use(cookieParser(process.env.SESSION_SECRET));

// True only when a validly-signed admin_auth cookie is present (cookie-parser
// drops cookies with a bad signature, so this cannot be forged).
const isAdminAuthed = (req) =>
  !!(req.signedCookies && req.signedCookies.admin_auth === 'true');

// Data-backed API routes need Postgres. Return an actionable 503 (instead of a
// generic 500 from deep inside a route) when POSTGRES_URL is missing — e.g. on
// a fresh Vercel deploy before the env var is added. Once it IS set, tables and
// seed data are created automatically on the first request (see db.js), so this
// middleware then becomes a no-op.
const requireDb = (_req, res, next) => {
  if (!db.pool) {
    return res.status(503).json({
      error:
        'Database not configured. Add POSTGRES_URL (Vercel → Settings → Environment Variables) and redeploy — tables and seed data are created automatically on first request.',
    });
  }
  next();
};

// -- Admin panel ---------------------------------------------------------------
// /admin/login    -> standalone login page (always served)
// /admin          -> dashboard when signed in; 302 to /admin/login when not
// /admin/* assets -> app.js / style.css / editor.js / login.html via static
// /admin/{*path}  -> SPA fallback, same server-side gate as /admin
app.get('/admin/login', (_req, res) => res.sendFile(path.join(ADMIN, 'login.html')));

// /admin/index.html must not bypass the gate - route it through /admin
app.get('/admin/index.html', (req, res) => {
  res.redirect(302, isAdminAuthed(req) ? '/admin' : '/admin/login');
});

app.get('/admin', (req, res) => {
  if (isAdminAuthed(req)) return res.sendFile(path.join(ADMIN, 'index.html'));
  res.redirect(302, '/admin/login');
});
app.use('/admin', express.static(ADMIN, { redirect: false, index: false }));
app.get('/admin/{*path}', (req, res) => {
  if (isAdminAuthed(req)) return res.sendFile(path.join(ADMIN, 'index.html'));
  res.redirect(302, '/admin/login');
});

// -- API routes ----------------------------------------------------------------
app.use('/api/auth',       authRoute);
app.use('/api/contact',    contactRoute);   // enquiries never blocked by DB state — persists to Postgres (or flat-file fallback) AND emails the admin
app.use('/api/newsletter', requireDb, newsletterRoute);
app.use('/api/blogs',      requireDb, blogsRoute);
app.use('/api/messages',   requireDb, messagesRoute);
app.use('/api/content',    requireDb, contentRoute);   // public read-only site content
app.use('/api/manage',     manageRoute);              // admin CRUD — requireAuth inside router runs BEFORE any DB check
app.use('/api/images',     requireDb, imagesRoute);    // uploaded image bytes (from Postgres)
app.get('/api/health', async (_req, res) => {
  let dbState = 'not_configured';
  if (db.pool) {
    try {
      await db.pool.query('SELECT 1');
      dbState = 'connected';
    } catch {
      dbState = 'unreachable';
    }
  }
  res.json({ status: 'ok', db: dbState });
});

// -- Clean URL page routes: /about -> public/pages/about.html, etc. ------------
const PAGE_ROUTES = [
  'about', 'services', 'portfolio', 'testimonials',
  'contact', 'blog', 'privacy', 'terms', 'cookies',
];

PAGE_ROUTES.forEach(page => {
  app.get(`/${page}`, (_req, res) => {
    res.sendFile(path.join(PUBLIC, 'pages', `${page}.html`));
  });
});

// -- *.html -> clean URL redirects (BEFORE static so the address bar stays
//    clean: /about.html -> /about, /index.html -> /) ---------------------------
app.get('/index.html', (_req, res) => res.redirect(301, '/'));
PAGE_ROUTES.forEach(page => {
  app.get(`/${page}.html`, (_req, res) => res.redirect(301, `/${page}`));
});
app.get('/pages/:name', (req, res) => {
  const name = req.params.name.replace(/\.html$/, '');
  if (name === 'index') return res.redirect(301, '/');
  if (name === 'blog-post') return res.redirect(301, '/blog'); // needs a slug
  res.redirect(301, `/${name}`);
});
app.get('/pages/:name.html', (req, res) => {
  const name = req.params.name;
  if (name === 'index') return res.redirect(301, '/');
  if (name === 'blog-post') return res.redirect(301, '/blog'); // needs a slug
  res.redirect(301, `/${name}`);
});

// -- Blog article pages: /blog/<slug> -> blog-post.html (client fetches the
//    post from GET /api/blogs/slug/:slug, published only) ----------------------
app.get('/blog/:slug', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'pages', 'blog-post.html'));
});

// -- Frontend static files, then 404s -------------------------------------------
app.use(express.static(PUBLIC));

app.get('/404', (_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'pages', '404.html'));
});

app.get('/{*path}', (_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'pages', '404.html'));
});

// Only start the HTTP server when run directly (`node server.js` / PM2).
// When imported by api/index.js for Vercel, we just export the app (handler).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Menos iT Consult - http://localhost:${PORT}`);
    console.log(`  Admin panel      - http://localhost:${PORT}/admin`);
    console.log(`  Admin login      - http://localhost:${PORT}/admin/login`);
    console.log(`  API health       - http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = app;