'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, slow down.' }
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/downloader', require('./src/routes/downloader'));
app.use('/api/ai',         require('./src/routes/ai'));
app.use('/api/tools',      require('./src/routes/tools'));
app.use('/api/whatsapp',   require('./src/routes/whatsapp'));
app.use('/api/search',     require('./src/routes/search'));
app.use('/api/media',      require('./src/routes/media'));

// ─── Health & Root ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'NovaSpark All-in-One API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      downloader: {
        youtube_video:    'GET /api/downloader/youtube?url=',
        youtube_audio:    'GET /api/downloader/youtube/audio?url=',
        youtube_search:   'GET /api/downloader/youtube/search?q=',
        tiktok:           'GET /api/downloader/tiktok?url=',
        instagram:        'GET /api/downloader/instagram?url=',
        facebook:         'GET /api/downloader/facebook?url=',
        twitter:          'GET /api/downloader/twitter?url=',
        pinterest:        'GET /api/downloader/pinterest?url=',
        soundcloud:       'GET /api/downloader/soundcloud?url=',
        spotify_info:     'GET /api/downloader/spotify?url='
      },
      ai: {
        chat:             'POST /api/ai/chat  body:{message}',
        imagine:          'GET  /api/ai/imagine?prompt=',
        translate:        'GET  /api/ai/translate?text=&to=',
        summarize:        'POST /api/ai/summarize  body:{text}',
        sentiment:        'POST /api/ai/sentiment  body:{text}',
        lyrics:           'GET  /api/ai/lyrics?song=&artist=',
        trivia:           'GET  /api/ai/trivia?category=',
        definition:       'GET  /api/ai/define?word='
      },
      tools: {
        qr_generate:      'GET  /api/tools/qr?text=',
        url_shorten:      'GET  /api/tools/shorten?url=',
        password:         'GET  /api/tools/password?length=&symbols=true',
        ip_lookup:        'GET  /api/tools/ip?ip=',
        weather:          'GET  /api/tools/weather?city=',
        currency:         'GET  /api/tools/currency?from=USD&to=ZAR&amount=1',
        joke:             'GET  /api/tools/joke?type=',
        quote:            'GET  /api/tools/quote',
        wikipedia:        'GET  /api/tools/wiki?q=',
        dictionary:       'GET  /api/tools/dictionary?word=',
        base64_encode:    'GET  /api/tools/base64/encode?text=',
        base64_decode:    'GET  /api/tools/base64/decode?text=',
        hash:             'GET  /api/tools/hash?text=&algo=md5',
        color:            'GET  /api/tools/color?hex=',
        unit_convert:     'GET  /api/tools/convert?value=&from=km&to=miles',
        palindrome:       'GET  /api/tools/palindrome?text=',
        reverse_text:     'GET  /api/tools/reverse?text=',
        word_count:       'GET  /api/tools/wordcount?text=',
        number_fact:      'GET  /api/tools/numfact?number=',
        time_zones:       'GET  /api/tools/time?city='
      },
      whatsapp: {
        sticker:          'POST /api/whatsapp/sticker  body:{imageUrl}',
        text2img:         'GET  /api/whatsapp/text2img?text=&bg=&color=',
        pp_get:           'GET  /api/whatsapp/pp?jid=',
        welcome_card:     'GET  /api/whatsapp/welcome?name=&group='
      },
      search: {
        google:           'GET  /api/search/google?q=',
        news:             'GET  /api/search/news?q=',
        images:           'GET  /api/search/images?q=',
        gifs:             'GET  /api/search/gif?q='
      },
      media: {
        meme:             'GET  /api/media/meme',
        anime_waifu:      'GET  /api/media/waifu?type=',
        cat:              'GET  /api/media/cat',
        dog:              'GET  /api/media/dog',
        neko:             'GET  /api/media/neko'
      }
    }
  });
});

// ─── 404 & Error Handler ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// ─── Keep-alive ping (prevents Render free tier from sleeping) ────────────────
if (process.env.RENDER_URL) {
  setInterval(() => {
    require('node-fetch')(process.env.RENDER_URL + '/health').catch(() => {});
  }, 14 * 60 * 1000); // ping every 14 minutes
}

app.listen(PORT, () => {
  console.log(`🚀 NovaSpark API running on port ${PORT}`);
});

module.exports = app;
