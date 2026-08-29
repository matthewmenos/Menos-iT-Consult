/**
 * Set / reset the admin password in Postgres.
 *
 * Previously this wrote backend/data/admin.json (flat file). Now that storage
 * is Postgres-backed (and the Vercel filesystem is read-only), it updates the
 * admin row directly.
 *
 * Usage:  ADMIN_PASSWORD=newpass NODE_ENV=production node setup.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const db     = require('./db');

async function main() {
  const pw = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(pw, 12);
  await db.initDb();
  await db.updateAdminPassword(hash);
  console.log('Admin password set in Postgres. Login with: admin / ' + pw);
  process.exit(0);
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});