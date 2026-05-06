'use strict';
const router = require('express').Router();
const axios  = require('axios');
const sharp  = require('sharp');
const QRCode = require('qrcode');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── Sticker Maker (image URL → WebP base64) ──────────────────────────────────
router.post('/sticker', async (req, res) => {
  const { imageUrl, size = 512 } = req.body;
  if (!imageUrl) return err(res, 'Missing body: { imageUrl }');
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    const webp = await sharp(Buffer.from(response.data))
      .resize(parseInt(size), parseInt(size), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 })
      .toBuffer();
    ok(res, {
      format: 'webp',
      size_bytes: webp.length,
      base64: webp.toString('base64'),
      data_url: `data:image/webp;base64,${webp.toString('base64')}`
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Text to Image (generates a simple styled image card) ────────────────────
router.get('/text2img', async (req, res) => {
  const { text, bg = '1a1a2e', color = 'ffffff', size = '800x400', font = 'bold 48px sans-serif' } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  try {
    const [w, h] = (size || '800x400').split('x').map(Number);
    const bgBuf = Buffer.from(bg.replace('#', ''), 'hex');
    const r = bgBuf[0], g = bgBuf[1], b = bgBuf[2];
    // Create a solid color image with text overlay using sharp SVG
    const fgColor = '#' + color.replace('#', '');
    const lines = text.match(/.{1,30}/g) || [text];
    const lineHeight = 60;
    const startY = Math.max(80, (h - lines.length * lineHeight) / 2);
    const svgText = lines.map((line, i) =>
      `<text x="50%" y="${startY + i * lineHeight}" dominant-baseline="middle" text-anchor="middle"
       font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${fgColor}">${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text>`
    ).join('\n');
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgb(${r},${g},${b})"/>
      ${svgText}
    </svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Welcome Card ─────────────────────────────────────────────────────────────
router.get('/welcome', async (req, res) => {
  const { name = 'User', group = 'The Group', bg = '0f3460', accent = 'e94560' } = req.query;
  try {
    const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${bg.replace('#','')};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#bg)" rx="20"/>
      <circle cx="400" cy="130" r="60" fill="#${accent.replace('#','')}33" stroke="#${accent.replace('#','')}" stroke-width="3"/>
      <text x="400" y="145" text-anchor="middle" font-family="Arial" font-size="48" fill="#${accent.replace('#','')}">👋</text>
      <text x="400" y="240" text-anchor="middle" font-family="Arial" font-size="36" font-weight="bold" fill="white">Welcome, ${name.replace(/&/g,'&amp;').replace(/</g,'&lt;')}!</text>
      <text x="400" y="290" text-anchor="middle" font-family="Arial" font-size="22" fill="#aaaaaa">You've joined ${group.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>
      <rect x="150" y="330" width="500" height="3" fill="#${accent.replace('#','')}" rx="2"/>
      <text x="400" y="370" text-anchor="middle" font-family="Arial" font-size="18" fill="#666">Powered by NovaSpark ⚡</text>
    </svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Goodbye Card ─────────────────────────────────────────────────────────────
router.get('/goodbye', async (req, res) => {
  const { name = 'User', group = 'The Group' } = req.query;
  try {
    const svg = `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#bg2)" rx="20"/>
      <text x="400" y="145" text-anchor="middle" font-family="Arial" font-size="56" fill="#e94560">😢</text>
      <text x="400" y="240" text-anchor="middle" font-family="Arial" font-size="36" font-weight="bold" fill="white">Goodbye, ${name.replace(/&/g,'&amp;').replace(/</g,'&lt;')}!</text>
      <text x="400" y="290" text-anchor="middle" font-family="Arial" font-size="22" fill="#aaaaaa">You left ${group.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>
      <rect x="150" y="330" width="500" height="3" fill="#e94560" rx="2"/>
      <text x="400" y="370" text-anchor="middle" font-family="Arial" font-size="18" fill="#666">See you around ✌️</text>
    </svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Rank Card ────────────────────────────────────────────────────────────────
router.get('/rankcard', async (req, res) => {
  const { name = 'User', level = 1, xp = 0, maxXp = 100, rank = 1, bg = '0f3460', accent = 'e94560' } = req.query;
  const pct = Math.min(100, Math.round((parseInt(xp) / parseInt(maxXp)) * 100));
  const barWidth = Math.round((pct / 100) * 460);
  try {
    const svg = `<svg width="600" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="200" fill="#${bg.replace('#','')}" rx="15"/>
      <circle cx="100" cy="100" r="55" fill="#${accent.replace('#','')}33" stroke="#${accent.replace('#','')}" stroke-width="3"/>
      <text x="100" y="110" text-anchor="middle" font-family="Arial" font-size="36" fill="white">🎮</text>
      <text x="200" y="65" font-family="Arial" font-size="26" font-weight="bold" fill="white">${name.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>
      <text x="200" y="95" font-family="Arial" font-size="18" fill="#aaa">Level ${level} • Rank #${rank}</text>
      <rect x="200" y="120" width="360" height="18" fill="#ffffff22" rx="9"/>
      <rect x="200" y="120" width="${barWidth}" height="18" fill="#${accent.replace('#','')}" rx="9"/>
      <text x="200" y="160" font-family="Arial" font-size="14" fill="#aaa">${xp} / ${maxXp} XP (${pct}%)</text>
    </svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── QR for WhatsApp ──────────────────────────────────────────────────────────
router.get('/qr', async (req, res) => {
  const { text } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  try {
    const buf = await QRCode.toBuffer(text, { type: 'png', width: 300 });
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) {
    err(res, e.message, 500);
  }
});

module.exports = router;
