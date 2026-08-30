/**
 * Postgres data-access layer.
 *
 * Exposes small async DAOs that return objects in the SAME camelCase shape the
 * rest of the app already expects (id/title/slug/readTime/...). This lets every
 * route file stay almost identical â€” it just `await`s the DAO instead of
 * reading/writing JSON files â€” and keeps storage in Postgres so writes survive
 * Vercel's read-only filesystem and cross cold start.
 */
// Load `pg` on demand so the app still boots (for static serving / local dev)
  // when pg is not installed or POSTGRES_URL is absent. In production pg is
// always present and pool is created below.
let Pool;
try {
  ({ Pool } = require('pg'));
} catch {
  Pool = null;
}

const pool =
  (process.env.POSTGRES_URL || process.env.DATABASE_URL) && Pool
    ? new Pool({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : false,
      })
    : null;

function needPool() {
  if (!pool) throw noDbError();
  return lazyPool;
}

function noDbError() {
  const err = new Error(
    'Database not configured. Set POSTGRES_URL (Vercel â†’ Settings â†’ Environment Variables) and redeploy.'
  );
  err.noDb = true;
  return err;
}

// â”€â”€ data dir across deployment layouts (used by first-boot seeding) â”€â”€â”€â”€â”€â”€â”€â”€
// local/PM2: backend/db.js -> ./data;  Vercel: includeFiles copies
// backend/data/** to <lambda>/backend/data, and the bundled handler's
// __dirname is <lambda>/api (same rule server.js uses for public/admin).
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const DATA_DIR = (() => {
  const candidates = [
    path.join(__dirname, 'data'),
    path.join(__dirname, '../backend/data'),
    path.join(__dirname, '../data'),
    path.join(process.cwd(), 'backend', 'data'),
  ];
  for (const dir of candidates) {
    try { if (fs.statSync(dir).isDirectory()) return dir; } catch (_) { /* next */ }
  }
  return candidates[0];
})();

function readSeedJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}

// â”€â”€ one-time bootstrap: create tables + seed on the first query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Deploying with POSTGRES_URL set is enough â€” no manual `node migrate.js`
// needed. Failures (e.g. transient network) reset the promise so the next
// request retries.
let readyPromise  = null;
let bootstrapping = false;

function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      bootstrapping = true;
      try {
        await initDb();
        await seedAll(console.log);
      } finally {
        bootstrapping = false;
      }
    })().catch(err => {
      readyPromise = null; // allow the next request to retry
      // A bootstrap failure means the database is configured but unusable
      // (unreachable, bad credentials, permissions). Tag it so route error
      // handlers answer 503 with the real cause instead of a generic 500.
      if (!err.noDb) err.noDb = true;
      throw err;
    });
  }
  return readyPromise;
}

// Thin pool facade: every DAO call waits for the bootstrap before touching
// SQL. During the bootstrap itself the guard is off, so the seeder's own DAO
// calls (which go through needPool) don't deadlock on their own promise.
const lazyPool = {
  query: async (...args) => {
    if (!bootstrapping) await ensureReady();
    return pool.query(...args);
  },
  connect: (...args) => pool.connect(...args),
  end:     (...args) => pool.end(...args),
};

function iso(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date(v).toISOString();
}

// â”€â”€ row â†’ camelCase mappers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mapBlog(r) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    category: r.category,
    readTime: r.read_time,
    excerpt: r.excerpt,
    content: r.content,
    featured: !!r.featured,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}
function mapMessage(r) {
  return {
    id: r.id,
    createdAt: iso(r.created_at),
    read: !!r.read,
    name: r.name,
    email: r.email,
    phone: r.phone,
    service: r.service,
    source: r.source,
    message: r.message,
  };
}
function mapSubscriber(r) {
  return { email: r.email, subscribedAt: iso(r.subscribed_at) };
}
function mapTestimonial(r) {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    company: r.company,
    location: r.location,
    quote: r.quote,
    image: r.image || '',
    rating: r.rating != null ? Number(r.rating) : 5,
    featured: !!r.featured,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}
function mapProject(r) {
  let outcomes = [];
  if (r.outcomes != null) {
    if (typeof r.outcomes === 'string') {
      try { outcomes = JSON.parse(r.outcomes); } catch { outcomes = []; }
    } else if (Array.isArray(r.outcomes)) {
      outcomes = r.outcomes;
    }
  }
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    client: r.client,
    location: r.location,
    description: r.description,
    image: r.image || '',
    outcomes: Array.isArray(outcomes) ? outcomes : [],
    year: r.year,
    featured: !!r.featured,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}
// â”€â”€ settings (key â†’ jsonb value) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mapSetting(r) {
  let v = r.value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* keep raw */ } }
  return { key: r.key, value: v };
}

// â”€â”€ schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function initDb() {
  if (!pool) {
    console.warn(
      '[db] POSTGRES_URL not set â€” persistence disabled (static/API serving still works; data-backed API routes return 503 until configured).'
    );
    return;
  }
  const q = (sql) => pool.query(sql);
  await q(`CREATE TABLE IF NOT EXISTS admin (
    username text PRIMARY KEY,
    password_hash text NOT NULL
  );`);
  await q(`CREATE TABLE IF NOT EXISTS blogs (
    id text PRIMARY KEY,
    title text, slug text, category text, read_time text,
    excerpt text, content text,
    featured boolean DEFAULT false,
    status text DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );`);
  await q(`CREATE TABLE IF NOT EXISTS messages (
    id text PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    read boolean DEFAULT false,
    name text, email text, phone text,
    service text, source text, message text
  );`);
    await q(`CREATE TABLE IF NOT EXISTS subscribers (
    email text PRIMARY KEY,
    subscribed_at timestamptz DEFAULT now()
  );`);
  await q(`CREATE TABLE IF NOT EXISTS testimonials (
    id text PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    name text, role text, company text, location text,
    rating int DEFAULT 5, quote text,
    image text,
    featured boolean DEFAULT false, status text DEFAULT 'published'
  );`);
  await q(`CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    title text, category text, client text, location text,
    description text, outcomes jsonb DEFAULT '[]'::jsonb,
    year text, featured boolean DEFAULT false, status text DEFAULT 'published'
  );`);
  // image column migration for databases bootstrapped before images existed
  await q('ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS image text');
  await q('ALTER TABLE projects ADD COLUMN IF NOT EXISTS image text');
  // uploaded image bytes (served back via GET /api/images/:id) â€” the Vercel
  // filesystem is read-only, so binaries live in Postgres
  await q(`CREATE TABLE IF NOT EXISTS images (
    id text PRIMARY KEY,
    mime text NOT NULL,
    bytes bytea NOT NULL,
    size int NOT NULL,
    created_at timestamptz DEFAULT now()
  );`);
  await q(`CREATE TABLE IF NOT EXISTS settings (
    key text PRIMARY KEY,
    value jsonb
  );`);
  console.log('[db] tables ensured');
}

// â”€â”€ blogs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getBlogs() {
  const { rows } = await needPool().query('SELECT * FROM blogs ORDER BY created_at DESC');
  return rows.map(mapBlog);
}
async function getBlog(id) {
  const { rows } = await needPool().query('SELECT * FROM blogs WHERE id = $1', [id]);
  return rows[0] ? mapBlog(rows[0]) : null;
}
async function getBlogBySlug(slug) {
  const { rows } = await needPool().query(
    'SELECT * FROM blogs WHERE slug = $1 ORDER BY created_at DESC LIMIT 1',
    [slug]
  );
  return rows[0] ? mapBlog(rows[0]) : null;
}
async function createBlog(blog) {
  const now = new Date().toISOString();
  const created = blog.createdAt || now;
  const updated = blog.updatedAt || now;
  const { rows } = await needPool().query(
    `INSERT INTO blogs
      (id, title, slug, category, read_time, excerpt, content, featured, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      blog.id, blog.title, blog.slug, blog.category, blog.readTime,
      blog.excerpt, blog.content, blog.featured, blog.status, created, updated,
    ]
  );
  return mapBlog(rows[0]);
}
async function updateBlog(id, blog) {
  const now = new Date().toISOString();
  const { rows } = await needPool().query(
    `UPDATE blogs
        SET title=$1, slug=$2, category=$3, read_time=$4, excerpt=$5,
            content=$6, featured=$7, updated_at=$8
      WHERE id=$9 RETURNING *`,
    [
      blog.title, blog.slug, blog.category, blog.readTime, blog.excerpt,
      blog.content, blog.featured, now, id,
    ]
  );
  return rows[0] ? mapBlog(rows[0]) : null;
}
async function deleteBlog(id) {
  await needPool().query('DELETE FROM blogs WHERE id = $1', [id]);
}
async function setBlogStatus(id, status) {
  const { rows } = await needPool().query(
    `UPDATE blogs SET status=$1, updated_at=now() WHERE id=$2 RETURNING *`,
    [status, id]
  );
  return rows[0] ? mapBlog(rows[0]) : null;
}

// â”€â”€ messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getMessages() {
  const { rows } = await needPool().query('SELECT * FROM messages ORDER BY created_at DESC');
  return rows.map(mapMessage);
}
async function getMessage(id) {
  const { rows } = await needPool().query('SELECT * FROM messages WHERE id = $1', [id]);
  return rows[0] ? mapMessage(rows[0]) : null;
}
async function deleteMessage(id) {
  await needPool().query('DELETE FROM messages WHERE id = $1', [id]);
}
async function markMessageRead(id) {
  const { rows } = await needPool().query(
    'UPDATE messages SET read=true WHERE id=$1 RETURNING *',
    [id]
  );
  return rows[0] ? mapMessage(rows[0]) : null;
}
async function saveMessage(m) {
  const { rows } = await needPool().query(
    `INSERT INTO messages
      (id, created_at, read, name, email, phone, service, source, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      m.id, m.createdAt, m.read, m.name, m.email,
      m.phone, m.service, m.source, m.message,
    ]
  );
  return mapMessage(rows[0]);
}

// Flat-file fallback for contact-form enquiries. Used when Postgres is
// unavailable (or the write fails) so an enquiry is never lost. The entries
// are picked up by seedAll() into the `messages` table once Postgres is
// configured (idempotent by id).
async function saveMessageFile(m) {
  const file = path.join(DATA_DIR, 'messages.json');
  let all = readSeedJson('messages.json', []);
  if (!Array.isArray(all)) all = [];
  if (!all.some(x => x.id === m.id)) {
    all.push(m);
    fs.writeFileSync(file, JSON.stringify(all, null, 2), 'utf8');
    all = readSeedJson('messages.json', []);
  }
  return all.find(x => x.id === m.id) || m;
}

// â”€â”€ subscribers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getSubscribers() {
  const { rows } = await needPool().query('SELECT * FROM subscribers ORDER BY subscribed_at DESC');
  return rows.map(mapSubscriber);
}
async function addSubscriber(email) {
  const { rows } = await needPool().query(
    `INSERT INTO subscribers (email) VALUES ($1)
     ON CONFLICT (email) DO NOTHING RETURNING *`,
    [email]
  );
  return rows[0] ? mapSubscriber(rows[0]) : null;
}
async function deleteSubscriber(email) {
  await needPool().query('DELETE FROM subscribers WHERE email = $1', [email]);
}

// â”€â”€ testimonials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getTestimonials() {
  const { rows } = await needPool().query('SELECT * FROM testimonials ORDER BY created_at DESC');
  return rows.map(mapTestimonial);
}
async function getTestimonial(id) {
  const { rows } = await needPool().query('SELECT * FROM testimonials WHERE id = $1', [id]);
  return rows[0] ? mapTestimonial(rows[0]) : null;
}
async function createTestimonial(t) {
  const { rows } = await needPool().query(
    `INSERT INTO testimonials
      (id, created_at, name, role, company, location, rating, quote, image, featured, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      t.id, t.createdAt || new Date().toISOString(), t.name, t.role || '',
      t.company || '', t.location || '', t.rating || 5, t.quote,
      t.image || '', !!t.featured, t.status || 'published',
    ]
  );
  return mapTestimonial(rows[0]);
}
async function updateTestimonial(id, t) {
  const { rows } = await needPool().query(
    `UPDATE testimonials
        SET name=$1, role=$2, company=$3, location=$4, rating=$5,
            quote=$6, image=$7, featured=$8, status=$9
      WHERE id=$10 RETURNING *`,
    [
      t.name, t.role || '', t.company || '', t.location || '',
      t.rating || 5, t.quote, t.image || '', !!t.featured, t.status || 'published', id,
    ]
  );
  return rows[0] ? mapTestimonial(rows[0]) : null;
}
async function deleteTestimonial(id) {
  await needPool().query('DELETE FROM testimonials WHERE id = $1', [id]);
}
async function setTestimonialStatus(id, status) {
  const { rows } = await needPool().query(
    'UPDATE testimonials SET status=$1 WHERE id=$2 RETURNING *',
    [status, id]
  );
  return rows[0] ? mapTestimonial(rows[0]) : null;
}

// â”€â”€ projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getProjects() {
  const { rows } = await needPool().query('SELECT * FROM projects ORDER BY created_at DESC');
  return rows.map(mapProject);
}
async function getProject(id) {
  const { rows } = await needPool().query('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] ? mapProject(rows[0]) : null;
}
async function createProject(p) {
  const { rows } = await needPool().query(
    `INSERT INTO projects
      (id, created_at, title, category, client, location, description, image, outcomes, year, featured, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      p.id, p.createdAt || new Date().toISOString(), p.title, p.category || '',
      p.client || '', p.location || '', p.description || '',
      p.image || '',
      JSON.stringify(Array.isArray(p.outcomes) ? p.outcomes : []),
      p.year || '', !!p.featured, p.status || 'published',
    ]
  );
  return mapProject(rows[0]);
}
async function updateProject(id, p) {
  const { rows } = await needPool().query(
    `UPDATE projects
        SET title=$1, category=$2, client=$3, location=$4, description=$5,
            image=$6, outcomes=$7, year=$8, featured=$9, status=$10
      WHERE id=$11 RETURNING *`,
    [
      p.title, p.category || '', p.client || '', p.location || '',
      p.description || '',
      p.image || '',
      JSON.stringify(Array.isArray(p.outcomes) ? p.outcomes : []),
      p.year || '', !!p.featured, p.status || 'published', id,
    ]
  );
  return rows[0] ? mapProject(rows[0]) : null;
}
async function deleteProject(id) {
  await needPool().query('DELETE FROM projects WHERE id = $1', [id]);
}
async function setProjectStatus(id, status) {
  const { rows } = await needPool().query(
    'UPDATE projects SET status=$1 WHERE id=$2 RETURNING *',
    [status, id]
  );
  return rows[0] ? mapProject(rows[0]) : null;
}

// â”€â”€ settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ uploaded images (bytes in Postgres; served via GET /api/images/:id) â”€â”€â”€â”€â”€â”€
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const IMAGE_MAX_BYTES = 4 * 1024 * 1024; // Vercel request body cap is ~4.5 MB

async function saveImage(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const e = new Error('Empty upload.'); e.badRequest = true; throw e;
  }
  if (!IMAGE_MIMES.includes(mime)) {
    const e = new Error('Unsupported image type. Use JPEG, PNG, WebP, GIF or AVIF.'); e.badRequest = true; throw e;
  }
  if (buffer.length > IMAGE_MAX_BYTES) {
    const e = new Error('Image too large (max 4 MB).'); e.badRequest = true; throw e;
  }
  const id = 'img-' + Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
  await needPool().query(
    'INSERT INTO images (id, mime, bytes, size) VALUES ($1,$2,$3,$4)',
    [id, mime, buffer, buffer.length]
  );
  return { id, url: `/api/images/${id}`, mime, size: buffer.length };
}

async function getImage(id) {
  const { rows } = await needPool().query('SELECT * FROM images WHERE id = $1', [id]);
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    mime: rows[0].mime,
    size: Number(rows[0].size),
    bytes: Buffer.isBuffer(rows[0].bytes) ? rows[0].bytes : Buffer.from(rows[0].bytes),
  };
}

async function getSettings() {
  const { rows } = await needPool().query('SELECT * FROM settings');
  return rows.map(mapSetting);
}
async function upsertSettings(entries) {
  const values = [];
  const tuples = entries.map(([key, value], i) => {
    values.push(key, JSON.stringify(value));
    return `($${i * 2 + 1}::text, $${i * 2 + 2}::jsonb)`;
  });
  if (tuples.length === 0) return;
  await needPool().query(
    `INSERT INTO settings (key, value) VALUES ${tuples.join(', ')}
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    values
  );
}
async function getSetting(key) {
  const { rows } = await needPool().query('SELECT * FROM settings WHERE key = $1', [key]);
  return rows[0] ? mapSetting(rows[0]) : null;
}
async function setSetting(key, value) {
  const { rows } = await needPool().query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
     RETURNING *`,
    [key, JSON.stringify(value)]
  );
  return mapSetting(rows[0]);
}

// â”€â”€ admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getAdmin() {
  const { rows } = await needPool().query('SELECT * FROM admin WHERE username = $1', ['admin']);
  if (!rows[0]) return { username: 'admin', passwordHash: '' };
  return { username: rows[0].username, passwordHash: rows[0].password_hash };
}
async function updateAdminPassword(hash) {
  await needPool().query(
    `INSERT INTO admin (username, password_hash) VALUES ('admin', $1)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [hash]
  );
}

// â”€â”€ first-boot seeding (idempotent) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Seeds from backend/data/*.json only where rows are missing. Runs
// automatically on the first query after a cold start (see ensureReady) and
// from `node migrate.js`. Existing rows/settings are always kept.
async function seedAll(log = () => {}) {
  const bcrypt = require('bcryptjs');

  // admin password â€” hash the ADMIN_PASSWORD env var into the DB so DB-backed
  // auth takes over from the env fallback immediately.
  const admin = await getAdmin();
  if (!admin.passwordHash) {
    const pw = process.env.ADMIN_PASSWORD || 'admin123';
    await updateAdminPassword(bcrypt.hashSync(pw, 12));
    log('[seed] admin password set from ADMIN_PASSWORD (username: admin)');
  }

  // blogs
  const blogs = readSeedJson('blogs.json', []);
  let n = 0;
  for (const b of blogs) {
    if (!b.id || (await getBlog(b.id))) continue;
    await createBlog(b); n++;
  }
  if (n) log(`[seed] blogs: ${n}/${blogs.length} added`);

  // messages
  const messages = readSeedJson('messages.json', []);
  n = 0;
  for (const m of messages) {
    if (!m.id || (await getMessage(m.id))) continue;
    await saveMessage(m); n++;
  }
  if (n) log(`[seed] messages: ${n}/${messages.length} added`);

  // subscribers
  const subs = readSeedJson('subscribers.json', []);
  n = 0;
  for (const s of subs) {
    if (!s.email) continue;
    const existing = await getSubscribers();
    if (existing.find(x => x.email.toLowerCase() === s.email.toLowerCase())) continue;
    await addSubscriber(s.email); n++;
  }
  if (n) log(`[seed] subscribers: ${n}/${subs.length} added`);

  // testimonials
  const testimonials = readSeedJson('testimonials.json', []);
  n = 0;
  for (const t of testimonials) {
    if (!t.id || !t.quote || (await getTestimonial(t.id))) continue;
    await createTestimonial({
      id: t.id,
      name: t.name || '',
      role: t.role || '',
      company: t.company || '',
      location: t.location || '',
      rating: t.rating || 5,
      quote: t.quote,
      featured: !!t.featured,
      status: t.status || 'published',
      createdAt: t.createdAt,
    });
    n++;
  }
  if (n) log(`[seed] testimonials: ${n}/${testimonials.length} added`);

  // projects
  const projects = readSeedJson('projects.json', []);
  n = 0;
  for (const p of projects) {
    if (!p.id || !p.title || (await getProject(p.id))) continue;
    await createProject({
      id: p.id,
      title: p.title,
      category: p.category || '',
      client: p.client || '',
      location: p.location || '',
      description: p.description || '',
      outcomes: Array.isArray(p.outcomes) ? p.outcomes : [],
      year: p.year || '',
      featured: !!p.featured,
      status: p.status || 'published',
      createdAt: p.createdAt,
    });
    n++;
  }
  if (n) log(`[seed] projects: ${n}/${projects.length} added`);

  // settings defaults (only if not already set)
  if (!(await getSetting('stats'))) {
    await setSetting('stats', { clients: 150, years: 12, satisfaction: 98, projects: 150 });
    log('[seed] default stats seeded');
  }
  if (!(await getSetting('contact'))) {
    await setSetting('contact', {
      email: 'minnahmat50@gmail.com',
      phone: '+233 549 128 384',
      whatsapp: '233549128384',
      location: 'Agona, Western Region, Ghana',
    });
    log('[seed] default contact info seeded');
  }
  if (!(await getSetting('trustedLogos'))) {
    await setSetting('trustedLogos', [
      { name: 'KAB Enterprises' },
      { name: 'Sarpong & Co.' },
      { name: 'Mensah Logistics' },
      { name: 'Asante Trading Co.' },
      { name: 'Boateng Medical Centre' },
      { name: 'Mac Data Hub' },
      { name: 'Fortis Pharmacy' },
      { name: 'Agyenim School' },
      { name: 'Antwi Group' },
      { name: 'Yeboah Clinic' },
    ]);
    log('[seed] default trusted company logos seeded');
  }
}

module.exports = {
  pool,
  initDb,
  seedAll,
  ensureReady,
  getBlogs, getBlog, getBlogBySlug, createBlog, updateBlog, deleteBlog, setBlogStatus,
  getMessages, getMessage, deleteMessage, markMessageRead, saveMessage, saveMessageFile,
  getSubscribers, addSubscriber, deleteSubscriber,
  getTestimonials, getTestimonial, createTestimonial, updateTestimonial, deleteTestimonial, setTestimonialStatus,
  getProjects, getProject, createProject, updateProject, deleteProject, setProjectStatus,
  saveImage, getImage,
  getSettings, getSetting, setSetting, upsertSettings,
  getAdmin, updateAdminPassword,
};
