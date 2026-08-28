/**
 * Postgres data-access layer.
 *
 * Exposes small async DAOs that return objects in the SAME camelCase shape the
 * rest of the app already expects (id/title/slug/readTime/...). This lets every
 * route file stay almost identical — it just `await`s the DAO instead of
 * reading/writing JSON files — and keeps storage in Postgres so writes survive
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
    if (!pool) throw new Error('POSTGRES_URL is not set');
  return pool;
}

function iso(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date(v).toISOString();
}

// ── row → camelCase mappers ────────────────────────────────────────────────
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

// ── schema ─────────────────────────────────────────────────────────────────
async function initDb() {
  if (!pool) {
    console.warn(
      '[db] POSTGRES_URL not set — persistence disabled (static/API serving still works; DB routes will 400 until configured).'
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
  console.log('[db] tables ensured');
}

// ── blogs ──────────────────────────────────────────────────────────────────
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

// ── messages ───────────────────────────────────────────────────────────────
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

// ── subscribers ──────────────────────────────────────────────────────────────
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

// ── admin ───────────────────────────────────────────────────────────────────
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

module.exports = {
  pool,
  initDb,
  getBlogs, getBlog, getBlogBySlug, createBlog, updateBlog, deleteBlog, setBlogStatus,
  getMessages, getMessage, deleteMessage, markMessageRead, saveMessage,
  getSubscribers, addSubscriber, deleteSubscriber,
  getAdmin, updateAdminPassword,
};