/**
 * Stateless admin guard.
 *
 * Replaces express-session: admin auth is carried in an httpOnly *signed*
 * cookie (`admin_auth`) rather than server memory, so it survives Vercel cold
 * starts. cookie-parser (configured in server.js with SESSION_SECRET) exposes
 * the tamper-proof value on req.signedCookies; we only trust the literal 'true'.
 */
module.exports = function requireAuth(req, res, next) {
  if (req.signedCookies && req.signedCookies.admin_auth === 'true') return next();
  res.status(401).json({ error: 'Unauthorised' });
};