/**
 * Vercel Serverless Function entry.
 *
 * The whole site (public pages, admin dashboard, REST API) is one Express app
 * built in backend/server.js. This file re-exports it from the `api/`
 * directory so Vercel's zero-config Node.js runtime detects it as a Serverless
 * Function. `vercel.json` bundles `public/`, `admin/` and `backend/data/` into
 * the function via `functions["api/index.js"].includeFiles` so
 * `express.static` can serve them from the read-only function filesystem.
 *
 * server.js only calls `listen()` when run directly (`node server.js` / PM2),
 * never when imported from here.
 */
module.exports = require('../backend/server');