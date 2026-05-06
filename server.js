'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, slow down.' }
});
app.use('/api/', limiter);

// ─── Static Frontend ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/novaai',       require('./src/routes/novaai'));
app.use('/api/downloader',   require('./src/routes/downloader'));
app.use('/api/ai',           require('./src/routes/ai'));
app.use('/api/tools',        require('./src/routes/tools'));
app.use('/api/whatsapp',     require('./src/routes/whatsapp'));
app.use('/api/search',       require('./src/routes/search'));
app.use('/api/media',        require('./src/routes/media'));
app.use('/api/entertainment', require('./src/routes/entertainment'));
app.use('/api/crypto',       require('./src/routes/crypto'));
app.use('/api/dev',          require('./src/routes/dev'));
app.use('/api/shazam',       require('./src/routes/shazam'));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '3.1.0',
    endpoints_count: 82
  });
});

// ─── API Index ────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    name: 'NovaSpark All-in-One API',
    version: '3.1.0',
    status: 'running',
    author: 'NovaSpark Dev',
    dashboard: '/',
    total_endpoints: 82,
    categories: {
      novaai: '/api/novaai - Advanced AI with personas, code gen, vision, TTS',
      downloader: '/api/downloader - YouTube, TikTok, Instagram, Facebook, Twitter, Pinterest',
      ai: '/api/ai - Chat, imagine, translate, summarize, sentiment, lyrics',
      tools: '/api/tools - QR, weather, currency, password, hash, encode/decode',
      whatsapp: '/api/whatsapp - Stickers, welcome/goodbye cards, rank cards',
      search: '/api/search - Web, news, images, GIFs, Urban Dictionary',
      media: '/api/media - Memes, anime, pokemon, cats, dogs',
      entertainment: '/api/entertainment - Movies, books, horoscope, riddles, facts',
      crypto: '/api/crypto - Prices, trending, exchanges, NFTs',
      dev: '/api/dev - GitHub user, npm package, HTTP status, regex tester, JSON formatter',
      shazam: '/api/shazam - Song identification, search, lyrics, artist info, trending charts'
    }
  });
});

// ─── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((error, req, res, next) => {
  console.error('Server Error:', error.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`⚡ NovaSpark API v3.0.0 running on port ${PORT}`);
  console.log(`📡 Dashboard: http://localhost:${PORT}`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);
});

// ─── Keep Alive (Render free tier) ────────────────────────────────────────────
if (process.env.RENDER_URL) {
  setInterval(() => {
    const https = require('https');
    https.get(process.env.RENDER_URL + '/health').on('error', () => {});
  }, 14 * 60 * 1000);
}
