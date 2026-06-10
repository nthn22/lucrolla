// ============================================================
// server.js — Photography Portfolio Backend
// Run: node server.js  →  http://localhost:3000
// ============================================================

require('dotenv').config(); // loads .env into process.env

const express    = require('express');
const multer     = require('multer');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const cloudinary = require('cloudinary').v2;

const app  = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'config.json')
  : path.join(__dirname, 'config.json');

// Keep local dirs for legacy local-dev compatibility
const PHOTOS_DIR = path.join(__dirname, 'public', 'photos');
const MEDIA_DIR  = path.join(__dirname, 'public', 'media');
[PHOTOS_DIR, MEDIA_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

console.log(`Config path: ${CONFIG_PATH}`);

// Initialize config on fresh volume (first deploy)
if (!fs.existsSync(CONFIG_PATH)) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    name: 'Lucrolla', tagline: '', instagram: '',
    heroImages: [], heroImage: '', aboutImage: '', about: '',
    photos: [], media: []
  }, null, 2));
}

// ── Cloudinary ───────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true
});

// ── Session token ────────────────────────────────────────────
// Fresh random token each server start — anyone logged in to admin re-logins after redeploy.
const SESSION_TOKEN = crypto.randomBytes(32).toString('hex');

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ──────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.headers['authorization'] === `Bearer ${SESSION_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Multer (memory storage — files go to Cloudinary, not disk) ──
// .any() avoids LIMIT_UNEXPECTED_FILE; fileFilter still enforces allowed types.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (/\.(jpe?g|png|gif|webp)$/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Images only (jpg, png, gif, webp)'));
  }
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (/\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error('Video files only (mp4, mov, avi, webm, mkv, m4v)'));
  }
});

// ── Helpers ──────────────────────────────────────────────────
function readConfig() { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
function writeConfig(data) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8'); }

// Normalise config for the frontend — strips internal cloudId, flattens heroImages to string array
function publicConfig(data) {
  const out = { ...data };
  if (out.heroImages) out.heroImages = out.heroImages.map(h => (typeof h === 'string' ? h : h.src));
  if (out.aboutImage && typeof out.aboutImage === 'object') out.aboutImage = out.aboutImage.src || '';
  return out;
}

// Upload a Buffer to Cloudinary and return { src, cloudId }
function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve({ src: result.secure_url, cloudId: result.public_id });
    });
    stream.end(buffer);
  });
}

// ── Routes ───────────────────────────────────────────────────

// POST /auth — verify password, return session token
app.post('/auth', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true, token: SESSION_TOKEN });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

// GET /config — public, used by main site and admin panel
app.get('/config', (req, res) => {
  try {
    const data = readConfig();
    if (!data.heroImages || !data.heroImages.length) data.heroImages = data.heroImage ? [data.heroImage] : [];
    if (data.about  === undefined) data.about  = '';
    if (!data.media)               data.media  = [];
    res.json(publicConfig(data));
  } catch (err) {
    res.status(500).json({ error: 'Could not read config' });
  }
});

// POST /config — update text fields (name, tagline, instagram, about)
app.post('/config', requireAuth, (req, res) => {
  try {
    const updated = { ...readConfig(), ...req.body };
    writeConfig(updated);
    res.json({ success: true, config: publicConfig(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Could not save config' });
  }
});

// POST /upload — image upload to Cloudinary
//   ?hero=true  → appends to heroImages carousel
//   ?about=true → sets the about section image (one only)
//   (default)   → appends to gallery photos
app.post('/upload', requireAuth, imageUpload.any(), async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });

    const config  = readConfig();
    const isHero  = req.query.hero  === 'true';
    const isAbout = req.query.about === 'true';

    for (const file of req.files) {
      const item = await uploadBuffer(file.buffer, { folder: 'portfolio/photos' });

      if (isHero) {
        if (!config.heroImages) config.heroImages = [];
        config.heroImages.push(item);
        config.heroImage = item.src;
      } else if (isAbout) {
        config.aboutImage = item;
        break; // only one about image
      } else {
        config.photos.push({ ...item, alt: '' });
      }
    }

    writeConfig(config);
    res.json({ success: true, config: publicConfig(config) });
  } catch (err) {
    console.error('POST /upload error:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// POST /upload/media — video upload to Cloudinary
app.post('/upload/media', requireAuth, videoUpload.any(), async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });

    const config = readConfig();
    if (!config.media) config.media = [];

    for (const file of req.files) {
      const item = await uploadBuffer(file.buffer, { folder: 'portfolio/media', resource_type: 'video' });
      config.media.push({ ...item, alt: '' });
    }

    writeConfig(config);
    res.json({ success: true, config: publicConfig(config) });
  } catch (err) {
    console.error('POST /upload/media error:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// DELETE /photo?src=<url> — delete a gallery photo (also clears aboutImage if it matches)
app.delete('/photo', requireAuth, async (req, res) => {
  try {
    const src    = req.query.src;
    const config = readConfig();

    const item = config.photos.find(p => p.src === src);
    if (item?.cloudId) await cloudinary.uploader.destroy(item.cloudId);
    config.photos = config.photos.filter(p => p.src !== src);

    const ai = config.aboutImage;
    if (ai && (ai === src || ai.src === src)) {
      if (ai.cloudId) await cloudinary.uploader.destroy(ai.cloudId);
      config.aboutImage = '';
    }

    writeConfig(config);
    res.json({ success: true, config: publicConfig(config) });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed: ' + err.message });
  }
});

// DELETE /hero?src=<url> — remove one image from the hero carousel
app.delete('/hero', requireAuth, async (req, res) => {
  try {
    const src    = req.query.src;
    const config = readConfig();
    if (!config.heroImages) config.heroImages = [];

    const item = config.heroImages.find(h => (typeof h === 'string' ? h : h.src) === src);
    if (item?.cloudId) await cloudinary.uploader.destroy(item.cloudId);
    config.heroImages = config.heroImages.filter(h => (typeof h === 'string' ? h : h.src) !== src);

    const first = config.heroImages[0];
    config.heroImage = first ? (typeof first === 'string' ? first : first.src) : '';

    writeConfig(config);
    res.json({ success: true, config: publicConfig(config) });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed: ' + err.message });
  }
});

// DELETE /media?src=<url> — delete a video
app.delete('/media', requireAuth, async (req, res) => {
  try {
    const src    = req.query.src;
    const config = readConfig();
    if (!config.media) config.media = [];

    const item = config.media.find(m => m.src === src);
    if (item?.cloudId) await cloudinary.uploader.destroy(item.cloudId, { resource_type: 'video' });
    config.media = config.media.filter(m => m.src !== src);

    writeConfig(config);
    res.json({ success: true, config: publicConfig(config) });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed: ' + err.message });
  }
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n📷  Portfolio running at http://localhost:${PORT}`);
  console.log(`🔒  Admin panel at  http://localhost:${PORT}/admin.html\n`);
  if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
    console.warn('⚠️   Cloudinary not configured — fill in CLOUDINARY_* values in .env\n');
  }
});
