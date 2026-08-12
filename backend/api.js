/**
 * Vercel Node.js Serverless Function entry.
 *
 * A single host serves everything (public /, admin /admin, API /api/*): the
 * rewrite in vercel.json points ("/*") here, and this exports the Express app
 * built in server.js. An Express app is itself a valid (req, res) handler, so
 * Vercel invokes it directly. server.js only calls listen() when run as the
 * main module (i.e. `node server.js` locally / via PM2), never when imported.
 */
module.exports = require('./server');