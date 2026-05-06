'use strict';
const router = require('express').Router();
const axios  = require('axios');
const crypto = require('crypto');
const QRCode = require('qrcode');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── QR Code Generator ────────────────────────────────────────────────────────
router.get('/qr', async (req, res) => {
  const { text, format = 'url' } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  try {
    if (format === 'png') {
      const buf = await QRCode.toBuffer(text, { type: 'png', width: 300 });
      res.set('Content-Type', 'image/png');
      return res.send(buf);
    }
    const dataUrl = await QRCode.toDataURL(text, { width: 300 });
    ok(res, { text, qr_base64: dataUrl, qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}` });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── URL Shortener (TinyURL — no key) ────────────────────────────────────────
router.get('/shorten', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url=');
  try {
    const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
    ok(res, { original: url, short: r.data });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Password Generator ───────────────────────────────────────────────────────
router.get('/password', (req, res) => {
  const { length = 16, symbols = 'true', numbers = 'true', upper = 'true' } = req.query;
  const len = Math.min(128, Math.max(4, parseInt(length)));
  let chars = 'abcdefghijklmnopqrstuvwxyz';
  if (upper === 'true')   chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers === 'true') chars += '0123456789';
  if (symbols === 'true') chars += '!@#$%^&*()-_=+[]{}|;:,.<>?';
  let password = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) password += chars[bytes[i] % chars.length];
  ok(res, { password, length: password.length, strength: len >= 16 && symbols === 'true' ? 'strong' : len >= 12 ? 'medium' : 'weak' });
});

// ─── IP Lookup ────────────────────────────────────────────────────────────────
router.get('/ip', async (req, res) => {
  const { ip } = req.query;
  const target = ip || req.ip || req.headers['x-forwarded-for']?.split(',')[0] || '8.8.8.8';
  try {
    const r = await axios.get(`http://ip-api.com/json/${target}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`, { timeout: 10000 });
    if (r.data.status === 'fail') return err(res, r.data.message || 'IP lookup failed');
    ok(res, { ...r.data });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Weather ──────────────────────────────────────────────────────────────────
router.get('/weather', async (req, res) => {
  const { city, lat, lon } = req.query;
  if (!city && (!lat || !lon)) return err(res, 'Missing ?city= or ?lat=&lon=');
  try {
    if (process.env.OPENWEATHER_API_KEY) {
      const q = city ? `q=${encodeURIComponent(city)}` : `lat=${lat}&lon=${lon}`;
      const r = await axios.get(`https://api.openweathermap.org/data/2.5/weather?${q}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`, { timeout: 10000 });
      return ok(res, {
        city: r.data.name,
        country: r.data.sys.country,
        temperature: r.data.main.temp + '°C',
        feels_like: r.data.main.feels_like + '°C',
        humidity: r.data.main.humidity + '%',
        description: r.data.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${r.data.weather[0].icon}@2x.png`,
        wind: r.data.wind.speed + 'm/s',
        visibility: (r.data.visibility / 1000) + 'km'
      });
    }
    // Free fallback: wttr.in
    const q2 = city || `${lat},${lon}`;
    const r2 = await axios.get(`https://wttr.in/${encodeURIComponent(q2)}?format=j1`, { timeout: 10000 });
    const w = r2.data.current_condition[0];
    ok(res, {
      city: q2,
      temperature: w.temp_C + '°C',
      feels_like: w.FeelsLikeC + '°C',
      humidity: w.humidity + '%',
      description: w.weatherDesc[0].value,
      wind: w.windspeedKmph + 'km/h',
      provider: 'wttr.in'
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Currency Converter ───────────────────────────────────────────────────────
router.get('/currency', async (req, res) => {
  const { from = 'USD', to = 'ZAR', amount = 1 } = req.query;
  try {
    const r = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`, { timeout: 10000 });
    const rate = r.data.rates[to.toUpperCase()];
    if (!rate) return err(res, `Unknown currency: ${to}`);
    const result = (parseFloat(amount) * rate).toFixed(2);
    ok(res, { from: from.toUpperCase(), to: to.toUpperCase(), amount: parseFloat(amount), rate, result: parseFloat(result), timestamp: r.data.time_last_updated });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Joke ─────────────────────────────────────────────────────────────────────
router.get('/joke', async (req, res) => {
  const { type = 'Any' } = req.query;
  try {
    const r = await axios.get(`https://v2.jokeapi.dev/joke/${type}?blacklistFlags=racist,sexist,explicit`, { timeout: 10000 });
    if (r.data.type === 'twopart') {
      ok(res, { type: 'twopart', setup: r.data.setup, delivery: r.data.delivery, category: r.data.category });
    } else {
      ok(res, { type: 'single', joke: r.data.joke, category: r.data.category });
    }
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Quote ────────────────────────────────────────────────────────────────────
router.get('/quote', async (req, res) => {
  const { category } = req.query;
  try {
    const url = category ? `https://api.quotable.io/random?tags=${category}` : 'https://api.quotable.io/random';
    const r = await axios.get(url, { timeout: 10000 });
    ok(res, { quote: r.data.content, author: r.data.author, tags: r.data.tags, length: r.data.length });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Wikipedia Search ─────────────────────────────────────────────────────────
router.get('/wiki', async (req, res) => {
  const { q, lang = 'en' } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    const r = await axios.get(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=5`, { timeout: 10000 });
    const results = r.data.query.search.map(s => ({
      title: s.title,
      snippet: s.snippet.replace(/<[^>]*>/g, ''),
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`
    }));
    if (!results.length) return err(res, 'No results found', 404);
    // Get summary of top result
    const summary = await axios.get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(results[0].title.replace(/ /g, '_'))}`, { timeout: 10000 });
    ok(res, { top_result: { title: summary.data.title, extract: summary.data.extract, url: summary.data.content_urls?.desktop?.page, image: summary.data.thumbnail?.source }, all_results: results });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Base64 ───────────────────────────────────────────────────────────────────
router.get('/base64/encode', (req, res) => {
  const { text } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  ok(res, { original: text, encoded: Buffer.from(text).toString('base64') });
});

router.get('/base64/decode', (req, res) => {
  const { text } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  try {
    ok(res, { encoded: text, decoded: Buffer.from(text, 'base64').toString('utf8') });
  } catch (e) {
    err(res, 'Invalid base64 string');
  }
});

// ─── Hash Generator ───────────────────────────────────────────────────────────
router.get('/hash', (req, res) => {
  const { text, algo = 'md5' } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  const supported = ['md5', 'sha1', 'sha256', 'sha512'];
  if (!supported.includes(algo)) return err(res, `Supported algorithms: ${supported.join(', ')}`);
  ok(res, { text, algorithm: algo, hash: crypto.createHash(algo).update(text).digest('hex') });
});

// ─── Color Info ───────────────────────────────────────────────────────────────
router.get('/color', async (req, res) => {
  const { hex } = req.query;
  if (!hex) return err(res, 'Missing ?hex= (e.g. FF5733)');
  const clean = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) return err(res, 'Invalid hex color (6 chars, e.g. FF5733)');
  try {
    const r = await axios.get(`https://www.thecolorapi.com/id?hex=${clean}`, { timeout: 10000 });
    const d = r.data;
    ok(res, {
      hex: d.hex.value,
      rgb: d.rgb.value,
      hsl: d.hsl.value,
      hsv: d.hsv.value,
      name: d.name.value,
      is_exact_match: d.name.exact_match_name,
      image: d.image.bare
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Unit Converter ───────────────────────────────────────────────────────────
router.get('/convert', (req, res) => {
  const { value, from, to } = req.query;
  if (!value || !from || !to) return err(res, 'Missing ?value=&from=&to=');
  const v = parseFloat(value);
  if (isNaN(v)) return err(res, 'value must be a number');

  const conversions = {
    // Length
    km_miles: v * 0.621371, miles_km: v * 1.60934,
    m_ft: v * 3.28084, ft_m: v / 3.28084,
    cm_inch: v * 0.393701, inch_cm: v * 2.54,
    m_yard: v * 1.09361, yard_m: v / 1.09361,
    // Weight
    kg_lb: v * 2.20462, lb_kg: v / 2.20462,
    g_oz: v * 0.035274, oz_g: v / 0.035274,
    kg_g: v * 1000, g_kg: v / 1000,
    // Temperature
    c_f: (v * 9/5) + 32, f_c: (v - 32) * 5/9,
    c_k: v + 273.15, k_c: v - 273.15,
    // Volume
    l_gal: v * 0.264172, gal_l: v / 0.264172,
    ml_oz: v * 0.033814, oz_ml: v / 0.033814,
    // Speed
    kmh_mph: v * 0.621371, mph_kmh: v * 1.60934,
    ms_kmh: v * 3.6, kmh_ms: v / 3.6,
    // Data
    mb_gb: v / 1024, gb_mb: v * 1024,
    gb_tb: v / 1024, tb_gb: v * 1024,
    kb_mb: v / 1024, mb_kb: v * 1024
  };

  const key = `${from.toLowerCase()}_${to.toLowerCase()}`;
  if (conversions[key] === undefined) {
    return err(res, `Unsupported conversion: ${from} → ${to}. Try: km_miles, c_f, kg_lb, l_gal, etc.`);
  }
  ok(res, { value: v, from, to, result: +conversions[key].toFixed(6) });
});

// ─── Text Utilities ───────────────────────────────────────────────────────────
router.get('/palindrome', (req, res) => {
  const { text } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  ok(res, { text, is_palindrome: clean === clean.split('').reverse().join('') });
});

router.get('/reverse', (req, res) => {
  const { text } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  ok(res, { original: text, reversed: text.split('').reverse().join('') });
});

router.get('/wordcount', (req, res) => {
  const { text } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chars = text.length;
  const sentences = (text.match(/[.!?]+/g) || []).length;
  ok(res, { words: words.length, characters: chars, characters_no_spaces: text.replace(/\s/g, '').length, sentences, paragraphs: text.split(/\n\n+/).length, reading_time: Math.ceil(words.length / 200) + ' min' });
});

// ─── Number Fact ──────────────────────────────────────────────────────────────
router.get('/numfact', async (req, res) => {
  const { number = 'random', type = 'trivia' } = req.query;
  try {
    const r = await axios.get(`http://numbersapi.com/${number}/${type}?json`, { timeout: 10000 });
    ok(res, { number: r.data.number, fact: r.data.text, type: r.data.type, found: r.data.found });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Time / Timezone ──────────────────────────────────────────────────────────
router.get('/time', async (req, res) => {
  const { timezone } = req.query;
  try {
    if (timezone) {
      const r = await axios.get(`https://worldtimeapi.org/api/timezone/${timezone}`, { timeout: 10000 });
      return ok(res, { timezone: r.data.timezone, datetime: r.data.datetime, utc_offset: r.data.utc_offset, day_of_week: r.data.day_of_week });
    }
    const r = await axios.get('https://worldtimeapi.org/api/timezone', { timeout: 10000 });
    ok(res, { available_timezones: r.data });
  } catch (e) {
    err(res, e.message, 500);
  }
});

module.exports = router;
