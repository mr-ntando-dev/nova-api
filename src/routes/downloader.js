'use strict';
const router = require('express').Router();
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── YouTube Video Info + Download Link ───────────────────────────────────────
router.get('/youtube', async (req, res) => {
  const { url, quality = '720p' } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    if (!ytdl.validateURL(url)) return err(res, 'Invalid YouTube URL');
    const info = await ytdl.getInfo(url);
    const details = info.videoDetails;
    const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
    const chosen = formats.find(f => f.qualityLabel === quality) || formats[0];
    ok(res, {
      title: details.title,
      author: details.author.name,
      duration: details.lengthSeconds + 's',
      views: details.viewCount,
      thumbnail: details.thumbnails.at(-1)?.url,
      download_url: chosen?.url || null,
      quality: chosen?.qualityLabel || null,
      formats: formats.map(f => ({ quality: f.qualityLabel, mimeType: f.mimeType, url: f.url }))
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── YouTube Audio Only (MP3 stream link) ────────────────────────────────────
router.get('/youtube/audio', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    if (!ytdl.validateURL(url)) return err(res, 'Invalid YouTube URL');
    const info = await ytdl.getInfo(url);
    const details = info.videoDetails;
    const formats = ytdl.filterFormats(info.formats, 'audioonly');
    const best = formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
    ok(res, {
      title: details.title,
      author: details.author.name,
      duration: details.lengthSeconds + 's',
      thumbnail: details.thumbnails.at(-1)?.url,
      audio_url: best?.url || null,
      bitrate: best?.audioBitrate ? best.audioBitrate + 'kbps' : null,
      mimeType: best?.mimeType
    });
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
    // Using tikwm.com API — free, no key needed
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
    const r = await axios.get(`https://www.saveinsta.app/api/ajaxSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });
    // Fallback to a reliable scraper approach
    const apiUrl = `https://api.instaloader.workers.dev/?url=${encodeURIComponent(url)}`;
    const resp = await axios.get(apiUrl, { timeout: 15000 });
    if (resp.data && resp.data.url) {
      ok(res, { media_url: resp.data.url, type: resp.data.type || 'unknown' });
    } else {
      // Second fallback
      const r2 = await axios.post('https://saveig.app/api/ajaxSearch', `q=${encodeURIComponent(url)}&t=media&lang=en`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });
      ok(res, { raw: r2.data });
    }
  } catch (e) {
    err(res, 'Instagram download failed: ' + e.message, 500);
  }
});

// ─── Facebook ─────────────────────────────────────────────────────────────────
router.get('/facebook', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(`https://facebook-reel-and-video-downloader.p.rapidapi.com/app/main.php?url=${encodeURIComponent(url)}`, {
      headers: {
        'X-RapidAPI-Host': 'facebook-reel-and-video-downloader.p.rapidapi.com',
        'X-RapidAPI-Key': 'SIGN-UP-FOR-KEY'
      },
      timeout: 15000
    }).catch(async () => {
      // Free fallback
      return await axios.get(`https://fb-downloader.com/api?url=${encodeURIComponent(url)}`, { timeout: 15000 });
    });
    ok(res, { data: r.data });
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
    // Parse HTML for download links
    const cheerio = require('cheerio');
    const $ = cheerio.load(r.data);
    const links = [];
    $('a[href*="video.twimg.com"]').each((i, el) => {
      links.push({ quality: $(el).text().trim(), url: $(el).attr('href') });
    });
    const title = $('p.leading-tight').first().text().trim();
    if (links.length) {
      ok(res, { title, links });
    } else {
      err(res, 'No downloadable video found in that tweet');
    }
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
    const title   = $('meta[property="og:title"]').attr('content');
    ok(res, { title, video_url: videoUrl || null, image_url: imageUrl || null });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── SoundCloud ───────────────────────────────────────────────────────────────
router.get('/soundcloud', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`, { timeout: 10000 });
    ok(res, {
      title: r.data.title,
      author: r.data.author_name,
      thumbnail: r.data.thumbnail_url,
      html: r.data.html,
      note: 'Direct audio download requires SoundCloud API key or a service like scdl'
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Spotify Track Info ───────────────────────────────────────────────────────
router.get('/spotify', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    // Extract track ID
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    if (!match) return err(res, 'Invalid Spotify track URL');
    const trackId = match[1];
    // Use open.spotify.com embed page for metadata (no key needed)
    const r = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { timeout: 10000 });
    ok(res, {
      track_id: trackId,
      title: r.data.title,
      thumbnail: r.data.thumbnail_url,
      embed_url: r.data.html,
      preview_url: `https://p.scdn.co/mp3-preview/${trackId}`,
      note: 'Full audio download requires Spotify Premium API'
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

module.exports = router;
