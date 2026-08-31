/**
 * Cloudflare R2 (S3-compatible) media storage.
 *
 * Enabled when R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET are set
 * (R2_ACCOUNT_ID builds the endpoint; or pass R2_ENDPOINT directly).
 * If R2_PUBLIC_BASE is set (e.g. a custom domain or r2.dev URL), uploads
 * return a permanent public URL; otherwise objects are served through
 * GET /api/images/:id which streams them from R2.
 */
const crypto = require('crypto');

let client = null;

function env(name) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function r2Enabled() {
  return !!(env('R2_ACCESS_KEY_ID') && env('R2_SECRET_ACCESS_KEY') && env('R2_BUCKET'));
}

function publicBase() {
  return env('R2_PUBLIC_BASE').replace(/\/+$/, '');
}

function getClient() {
  if (!r2Enabled()) {
    const e = new Error('R2 is not configured (set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).');
    e.noR2 = true;
    throw e;
  }
  if (!client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    const endpoint = env('R2_ENDPOINT') ||
      (env('R2_ACCOUNT_ID') ? `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com` : '');
    client = new S3Client({
      region: 'auto',
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId: env('R2_ACCESS_KEY_ID'),
        secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      },
    });
  }
  return client;
}

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/avif': 'avif',
};

/**
 * Upload a Buffer to R2 under media/<yyyy>/<id>.<ext>.
 * Returns { key, mime, size, publicUrl|null }.
 */
async function putImage(buffer, mime) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const ext = EXT[mime] || 'bin';
  const id = 'img-' + Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
  const key = `media/${new Date().getFullYear()}/${id}.${ext}`;
  await getClient().send(new PutObjectCommand({
    Bucket: env('R2_BUCKET'),
    Key: key,
    Body: buffer,
    ContentType: mime,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return { key, mime, size: buffer.length, publicUrl: publicBase() ? `${publicBase()}/${key}` : null };
}

/** Fetch an object's bytes from R2 (for proxy serving). */
async function getImageBytes(key) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const out = await getClient().send(new GetObjectCommand({ Bucket: env('R2_BUCKET'), Key: key }));
  return Buffer.from(await out.transformToByteArray());
}

module.exports = { r2Enabled, publicBase, putImage, getImageBytes };
