'use strict';
const router = require('express').Router();
const axios = require('axios');
const ytSearch = require('yt-search');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── YouTube Video Info (using Invidious public instances) ────────────────────
router.get('/youtube', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    // Extract video ID
    const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return err(res, 'Invalid YouTube URL');
    const videoId = match[1];

    // Try cobalt.tools API (free, reliable)
    try {
      const r = await axios.post('https://api.cobalt.tools/api/json', {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3'
      }, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        timeout: 15000
      });
      if (r.data?.url) {
        // Get video info via oembed
        const info = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 10000 }).catch(() => null);
        return ok(res, {
          title: info?.data?.title || 'Unknown',
          author: info?.data?.author_name || 'Unknown',
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          video_id: videoId,
          download_url: r.data.url,
          source: 'cobalt'
        });
      }
    } catch(e) { /* fallthrough */ }

    // Fallback: Invidious API
    const instances = ['https://inv.nadeko.net', 'https://invidious.privacyredirect.com', 'https://vid.puffyan.us'];
    for (const instance of instances) {
      try {
        const r = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: 10000 });
        const d = r.data;
        const formats = (d.formatStreams || []).concat(d.adaptiveFormats || []);
        const videoFormats = formats.filter(f => f.type?.includes('video') && f.url);
        const audioFormats = formats.filter(f => f.type?.includes('audio') && f.url);
        return ok(res, {
          title: d.title,
          author: d.author,
          duration: d.lengthSeconds + 's',
          views: d.viewCount,
          thumbnail: d.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          video_id: videoId,
          download_url: videoFormats[0]?.url || null,
          formats: videoFormats.slice(0, 5).map(f => ({ quality: f.qualityLabel || f.quality, type: f.type, url: f.url })),
          audio_url: audioFormats[0]?.url || null,
          source: 'invidious'
        });
      } catch(e) { continue; }
    }

    // Last fallback: just return metadata via oembed
    const info = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 10000 });
    ok(res, {
      title: info.data.title,
      author: info.data.author_name,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      video_id: videoId,
      download_url: null,
      note: 'Direct download unavailable, use video ID with a client-side player',
      source: 'oembed'
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── YouTube Audio ────────────────────────────────────────────────────────────
router.get('/youtube/audio', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return err(res, 'Invalid YouTube URL');
    const videoId = match[1];

    // Try cobalt for audio
    try {
      const r = await axios.post('https://api.cobalt.tools/api/json', {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        isAudioOnly: true,
        aFormat: 'mp3'
      }, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        timeout: 15000
      });
      if (r.data?.url) {
        const info = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 10000 }).catch(() => null);
        return ok(res, {
          title: info?.data?.title || 'Unknown',
          author: info?.data?.author_name || 'Unknown',
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          audio_url: r.data.url,
          source: 'cobalt'
        });
      }
    } catch(e) { /* fallthrough */ }

    // Invidious fallback
    const instances = ['https://inv.nadeko.net', 'https://invidious.privacyredirect.com', 'https://vid.puffyan.us'];
    for (const instance of instances) {
      try {
        const r = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: 10000 });
        const audioFormats = (r.data.adaptiveFormats || []).filter(f => f.type?.includes('audio') && f.url);
        if (audioFormats.length) {
          return ok(res, {
            title: r.data.title,
            author: r.data.author,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            audio_url: audioFormats[0].url,
            bitrate: audioFormats[0].bitrate,
            source: 'invidious'
          });
        }
      } catch(e) { continue; }
    }
    err(res, 'Could not extract audio. YouTube may be blocking server IPs.', 503);
  } catch (e) {
    err(res, e.message, 500);
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
