'use strict';
const router = require('express').Router();
const axios  = require('axios');
const cheerio = require('cheerio');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── Google Search (DuckDuckGo scrape — no key needed) ───────────────────────
router.get('/google', async (req, res) => {
  const { q, limit = 8 } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    const r = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const results = [];
    $('.result__body').each((i, el) => {
      if (i >= parseInt(limit)) return false;
      const title = $(el).find('.result__title').text().trim();
      const url   = $(el).find('.result__url').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      if (title) results.push({ title, url: url.startsWith('http') ? url : 'https://' + url, snippet });
    });
    ok(res, { query: q, results });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── News Search ──────────────────────────────────────────────────────────────
router.get('/news', async (req, res) => {
  const { q, lang = 'en', limit = 8 } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    // Use GNews free tier (no key for basic) 
    const r = await axios.get(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=${lang}&max=${limit}&apikey=free`, { timeout: 15000 });
    if (r.data.articles) {
      return ok(res, {
        query: q,
        total: r.data.totalArticles,
        articles: r.data.articles.map(a => ({
          title: a.title,
          description: a.description,
          url: a.url,
          image: a.image,
          source: a.source?.name,
          published: a.publishedAt
        }))
      });
    }
    throw new Error('No articles');
  } catch (e) {
    // Fallback: RSS feed
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${lang}`;
      const r2 = await axios.get(rssUrl, { timeout: 15000 });
      const $ = cheerio.load(r2.data, { xmlMode: true });
      const articles = [];
      $('item').each((i, el) => {
        if (i >= parseInt(limit)) return false;
        articles.push({
          title: $(el).find('title').text(),
          url: $(el).find('link').text(),
          published: $(el).find('pubDate').text(),
          source: $(el).find('source').text()
        });
      });
      ok(res, { query: q, articles, provider: 'google-rss' });
    } catch (e2) {
      err(res, e2.message, 500);
    }
  }
});

// ─── GIF Search (Tenor — no key needed for basic) ────────────────────────────
router.get('/gif', async (req, res) => {
  const { q, limit = 6 } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    const r = await axios.get(`https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&limit=${limit}&key=LIVDSRZULELA`, { timeout: 10000 });
    const gifs = r.data.results.map(g => ({
      id: g.id,
      title: g.title || q,
      url: g.url,
      gif: g.media[0]?.gif?.url,
      mp4: g.media[0]?.mp4?.url,
      preview: g.media[0]?.tinygif?.url
    }));
    ok(res, { query: q, gifs });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Image Search ─────────────────────────────────────────────────────────────
router.get('/images', async (req, res) => {
  const { q, limit = 6 } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    // Bing image search scrape
    const r = await axios.get(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&count=${limit}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    });
    const $ = cheerio.load(r.data);
    const images = [];
    $('a.iusc').each((i, el) => {
      if (i >= parseInt(limit)) return false;
      try {
        const m = JSON.parse($(el).attr('m') || '{}');
        if (m.murl) images.push({ title: m.t || q, image_url: m.murl, page_url: m.purl });
      } catch (_) {}
    });
    ok(res, { query: q, images });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Urban Dictionary ─────────────────────────────────────────────────────────
router.get('/urban', async (req, res) => {
  const { term } = req.query;
  if (!term) return err(res, 'Missing ?term=');
  try {
    const r = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`, { timeout: 10000 });
    if (!r.data.list || !r.data.list.length) return err(res, 'Term not found', 404);
    const top = r.data.list[0];
    ok(res, {
      word: top.word,
      definition: top.definition.replace(/[\[\]]/g, ''),
      example: top.example.replace(/[\[\]]/g, ''),
      thumbs_up: top.thumbs_up,
      thumbs_down: top.thumbs_down,
      author: top.author,
      permalink: top.permalink
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

module.exports = router;
