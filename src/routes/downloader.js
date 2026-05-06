'use strict';
const router = require('express').Router();
const axios = require('axios');
const ytSearch = require('yt-search');

// yt-dlp-exec: reliable YouTube extraction via the yt-dlp binary
let ytDlp;
try { ytDlp = require('yt-dlp-exec'); } catch(e) { ytDlp = null; }

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// Helper: extract YouTube video ID from any URL format
function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ─── YouTube Video Info ───────────────────────────────────────────────────────
router.get('/youtube', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  const videoId = extractVideoId(url);
  if (!videoId) return err(res, 'Invalid YouTube URL');
  try {
    if (ytDlp) {
      const d = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
      });
      const formats = (d.formats || [])
        .filter(f => f.url && f.vcodec !== 'none')
        .slice(-6)
        .map(f => ({ quality: f.format_note || f.height + 'p', ext: f.ext, url: f.url, size_mb: f.filesize ? (f.filesize/1048576).toFixed(1)+'MB' : null }))
        .reverse();
      return ok(res, {
        title: d.title,
        author: d.uploader,
        duration: d.duration + 's',
        views: d.view_count,
        thumbnail: d.thumbnail,
        video_id: videoId,
        download_url: d.url || formats[0]?.url || null,
        audio_url: (d.formats||[]).filter(f=>f.acodec!=='none'&&f.vcodec==='none'&&f.url).slice(-1)[0]?.url || null,
        formats: formats.slice(0, 5),
        source: 'yt-dlp'
      });
    }
    // Fallback: oembed metadata only
    const info = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 10000 });
    ok(res, { title: info.data.title, author: info.data.author_name, thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, video_id: videoId, download_url: null, source: 'oembed' });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── YouTube Audio ────────────────────────────────────────────────────────────
router.get('/youtube/audio', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  const videoId = extractVideoId(url);
  if (!videoId) return err(res, 'Invalid YouTube URL');
  try {
    if (ytDlp) {
      const d = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        format: 'bestaudio'
      });
      const audioFormats = (d.formats || [])
        .filter(f => f.acodec !== 'none' && f.vcodec === 'none' && f.url)
        .map(f => ({ ext: f.ext, abr: f.abr ? Math.round(f.abr)+'kbps' : null, url: f.url }));
      return ok(res, {
        title: d.title,
        author: d.uploader,
        duration: d.duration + 's',
        thumbnail: d.thumbnail,
        video_id: videoId,
        audio_url: d.url || audioFormats.slice(-1)[0]?.url,
        ext: d.ext,
        bitrate: d.abr ? Math.round(d.abr) + 'kbps' : null,
        all_audio_formats: audioFormats.slice(-4).reverse(),
        note: 'URLs expire in ~6 hours. Re-fetch for fresh links.',
        source: 'yt-dlp'
      });
    }
    err(res, 'yt-dlp not available on this server', 503);
  } catch (e) {
    err(res, e.message.includes('ERROR') ? e.message.split('\n').find(l=>l.includes('ERROR')) || e.message : e.message, 500);
  }
});

// ─── YouTube Search ───────────────────────────────────────────────────────────
router.get('/youtube/search', async (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    const r = await ytSearch(q);
    const videos = r.videos.slice(0, parseInt(limit)).map(v => ({
      title: v.title,
      url: v.url,
      video_id: v.videoId,
      duration: v.duration.timestamp,
      views: v.views,
      author: v.author.name,
      thumbnail: v.thumbnail,
      published: v.ago
    }));
    ok(res, { query: q, results: videos });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── TikTok (no watermark) ────────────────────────────────────────────────────
router.get('/tiktok', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, { timeout: 15000 });
    const d = r.data?.data;
    if (!d) return err(res, 'Could not fetch TikTok data');
    ok(res, {
      title: d.title,
      author: d.author?.nickname,
      duration: d.duration + 's',
      plays: d.play_count,
      likes: d.digg_count,
      thumbnail: d.cover,
      video_nowatermark: d.play,
      video_hd: d.hdplay || d.play,
      audio: d.music
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Instagram ────────────────────────────────────────────────────────────────
router.get('/instagram', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    // Try multiple free services
    const r = await axios.post('https://saveig.app/api/ajaxSearch', `q=${encodeURIComponent(url)}&t=media&lang=en`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    if (r.data?.data) {
      const cheerio = require('cheerio');
      const $ = cheerio.load(r.data.data);
      const links = [];
      $('a[href]').each((i, el) => { const h = $(el).attr('href'); if (h && h.startsWith('http')) links.push(h); });
      return ok(res, { url, media: links });
    }
    err(res, 'Could not extract Instagram media', 503);
  } catch (e) {
    err(res, 'Instagram download failed: ' + e.message, 500);
  }
});

// ─── Facebook ─────────────────────────────────────────────────────────────────
router.get('/facebook', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(`https://www.getfvid.com/downloader`, {
      params: { url },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    const cheerio = require('cheerio');
    const $ = cheerio.load(r.data);
    const links = [];
    $('a.btn-download').each((i, el) => {
      links.push({ quality: $(el).text().trim(), url: $(el).attr('href') });
    });
    if (links.length) return ok(res, { url, downloads: links });
    err(res, 'Could not extract Facebook video', 503);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Twitter / X ──────────────────────────────────────────────────────────────
router.get('/twitter', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(`https://twitsave.com/info?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const cheerio = require('cheerio');
    const $ = cheerio.load(r.data);
    const links = [];
    $('a[href*="video.twimg.com"]').each((i, el) => {
      links.push({ quality: $(el).text().trim(), url: $(el).attr('href') });
    });
    const title = $('p.leading-tight').first().text().trim();
    if (links.length) return ok(res, { title, links });
    err(res, 'No downloadable video found', 404);
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Pinterest ────────────────────────────────────────────────────────────────
router.get('/pinterest', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    const cheerio = require('cheerio');
    const $ = cheerio.load(r.data);
    const videoUrl = $('video source').attr('src') || $('meta[property="og:video"]').attr('content');
    const imageUrl = $('meta[property="og:image"]').attr('content');
    const title = $('meta[property="og:title"]').attr('content');
    ok(res, { title, video: videoUrl || null, image: imageUrl || null });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── SoundCloud ───────────────────────────────────────────────────────────────
router.get('/soundcloud', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const cheerio = require('cheerio');
    const $ = cheerio.load(r.data);
    const title = $('meta[property="og:title"]').attr('content');
    const description = $('meta[property="og:description"]').attr('content');
    const image = $('meta[property="og:image"]').attr('content');
    ok(res, { title, description, image, original_url: url });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Spotify (track info) ─────────────────────────────────────────────────────
router.get('/spotify', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });
    const cheerio = require('cheerio');
    const $ = cheerio.load(r.data);
    const title = $('meta[property="og:title"]').attr('content');
    const description = $('meta[property="og:description"]').attr('content');
    const image = $('meta[property="og:image"]').attr('content');
    const audio = $('meta[property="og:audio"]').attr('content');
    ok(res, { title, description, image, preview_url: audio || null });
  } catch (e) {
    err(res, e.message, 500);
  }
});

module.exports = router;
