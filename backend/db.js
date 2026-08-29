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
function mapTestimonial(r) {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    company: r.company,
    location: r.location,
    quote: r.quote,
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
    outcomes: Array.isArray(outcomes) ? outcomes : [],
    year: r.year,
    featured: !!r.featured,
    status: r.status,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}
// ── settings (key → jsonb value) ───────────────────────────────────────────
function mapSetting(r) {
  let v = r.value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* keep raw */ } }
  return { key: r.key, value: v };
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
  await q(`CREATE TABLE IF NOT EXISTS testimonials (
    id text PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    name text, role text, company text, location text,
    rating int DEFAULT 5, quote text,
    featured boolean DEFAULT false, status text DEFAULT 'published'
  );`);
  await q(`CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    title text, category text, client text, location text,
    description text, outcomes jsonb DEFAULT '[]'::jsonb,
    year text, featured boolean DEFAULT false, status text DEFAULT 'published'
  );`);
  await q(`CREATE TABLE IF NOT EXISTS settings (
    key text PRIMARY KEY,
    value jsonb
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

// ── testimonials ───────────────────────────────────────────────────────────
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
      (id, created_at, name, role, company, location, rating, quote, featured, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      t.id, t.createdAt || new Date().toISOString(), t.name, t.role || '',
      t.company || '', t.location || '', t.rating || 5, t.quote,
      !!t.featured, t.status || 'published',
    ]
  );
  return mapTestimonial(rows[0]);
}
async function updateTestimonial(id, t) {
  const { rows } = await needPool().query(
    `UPDATE testimonials
        SET name=$1, role=$2, company=$3, location=$4, rating=$5,
            quote=$6, featured=$7, status=$8
      WHERE id=$9 RETURNING *`,
    [
      t.name, t.role || '', t.company || '', t.location || '',
      t.rating || 5, t.quote, !!t.featured, t.status || 'published', id,
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

// ── projects ───────────────────────────────────────────────────────────────
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
      (id, created_at, title, category, client, location, description, outcomes, year, featured, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      p.id, p.createdAt || new Date().toISOString(), p.title, p.category || '',
      p.client || '', p.location || '', p.description || '',
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
            outcomes=$6, year=$7, featured=$8, status=$9
      WHERE id=$10 RETURNING *`,
    [
      p.title, p.category || '', p.client || '', p.location || '',
      p.description || '',
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

// ── settings ───────────────────────────────────────────────────────────────
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
  getTestimonials, getTestimonial, createTestimonial, updateTestimonial, deleteTestimonial, setTestimonialStatus,
  getProjects, getProject, createProject, updateProject, deleteProject, setProjectStatus,
  getSettings, getSetting, setSetting, upsertSettings,
  getAdmin, updateAdminPassword,
};