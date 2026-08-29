/**
 * Manual migration helper — creates the Postgres schema and seeds it from
 * backend/data/*.json (admin password, blogs, messages, subscribers,
 * testimonials, projects, default settings).
 *
 * NOTE: the app now SELF-BOOTSTRAPS. Deploying with POSTGRES_URL set is
 * enough — on the first request the tables are created and seed data is
 * inserted automatically (see ensureReady/seedAll in db.js). Running this
 * script is optional: useful for seeding ahead of time, or from a machine
 * with direct access to the production database.
 *
 * Idempotent: existing rows (by id/email) are skipped, so re-running is safe.
 *
 * Usage:  node migrate.js
 * Env:    POSTGRES_URL, ADMIN_PASSWORD (for the admin login), NODE_ENV=production
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const db = require('./db');

(async () => {
  try {
    await db.ensureReady();
    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    console.error('Check POSTGRES_URL and that the database is reachable from this machine.');
    process.exit(1);
  }
})();