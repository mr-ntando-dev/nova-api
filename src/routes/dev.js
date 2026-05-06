'use strict';
const router = require('express').Router();
const axios  = require('axios');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── GitHub User Info ─────────────────────────────────────────────────────────
router.get('/github', async (req, res) => {
  const { username } = req.query;
  if (!username) return err(res, 'Missing ?username=');
  try {
    const r = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'NovaSpark-API' },
      timeout: 10000
    });
    const d = r.data;
    ok(res, {
      username: d.login,
      name: d.name,
      avatar: d.avatar_url,
      bio: d.bio,
      location: d.location,
      company: d.company,
      blog: d.blog,
      public_repos: d.public_repos,
      public_gists: d.public_gists,
      followers: d.followers,
      following: d.following,
      created: d.created_at,
      url: d.html_url
    });
  } catch (e) {
    if (e.response?.status === 404) return err(res, `User "${username}" not found`, 404);
    err(res, e.message, 500);
  }
});

// ─── GitHub Repos ─────────────────────────────────────────────────────────────
router.get('/github/repos', async (req, res) => {
  const { username, sort = 'stars', limit = 10 } = req.query;
  if (!username) return err(res, 'Missing ?username=');
  try {
    const r = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=${sort}&per_page=${limit}`, {
      headers: { 'User-Agent': 'NovaSpark-API' },
      timeout: 10000
    });
    const repos = r.data.map(repo => ({
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      url: repo.html_url,
      created: repo.created_at,
      updated: repo.updated_at
    }));
    ok(res, { username, repos });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── NPM Package Info ─────────────────────────────────────────────────────────
router.get('/npm', async (req, res) => {
  const { package: pkg } = req.query;
  if (!pkg) return err(res, 'Missing ?package=');
  try {
    const r = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`, { timeout: 10000 });
    const d = r.data;
    const latest = d['dist-tags']?.latest;
    const latestData = d.versions?.[latest];
    ok(res, {
      name: d.name,
      description: d.description,
      latest_version: latest,
      license: latestData?.license,
      author: d.author?.name || latestData?.author?.name,
      homepage: d.homepage,
      repository: d.repository?.url,
      keywords: d.keywords?.slice(0, 10),
      dependencies: latestData?.dependencies ? Object.keys(latestData.dependencies).length : 0,
      npm_url: `https://www.npmjs.com/package/${d.name}`,
      created: d.time?.created,
      modified: d.time?.modified
    });
  } catch (e) {
    if (e.response?.status === 404) return err(res, `Package "${pkg}" not found`, 404);
    err(res, e.message, 500);
  }
});

// ─── HTTP Status Code Info ────────────────────────────────────────────────────
router.get('/httpstatus', (req, res) => {
  const { code } = req.query;
  if (!code) return err(res, 'Missing ?code=');

  const codes = {
    100: { name: 'Continue', description: 'Server received request headers, client should send body' },
    200: { name: 'OK', description: 'Request succeeded' },
    201: { name: 'Created', description: 'Resource created successfully' },
    204: { name: 'No Content', description: 'Success but no response body' },
    301: { name: 'Moved Permanently', description: 'Resource has moved to a new URL permanently' },
    302: { name: 'Found', description: 'Temporary redirect' },
    304: { name: 'Not Modified', description: 'Cached version is still valid' },
    400: { name: 'Bad Request', description: 'Server cannot process the request due to client error' },
    401: { name: 'Unauthorized', description: 'Authentication required' },
    403: { name: 'Forbidden', description: 'Server refuses to authorize the request' },
    404: { name: 'Not Found', description: 'Resource does not exist' },
    405: { name: 'Method Not Allowed', description: 'HTTP method not supported for this resource' },
    408: { name: 'Request Timeout', description: 'Server timed out waiting for request' },
    409: { name: 'Conflict', description: 'Request conflicts with current state of resource' },
    410: { name: 'Gone', description: 'Resource is no longer available and won\'t be again' },
    418: { name: 'I\'m a Teapot', description: 'The server is a teapot (RFC 2324 joke)' },
    429: { name: 'Too Many Requests', description: 'Rate limit exceeded' },
    500: { name: 'Internal Server Error', description: 'Server encountered an unexpected condition' },
    502: { name: 'Bad Gateway', description: 'Server received invalid response from upstream' },
    503: { name: 'Service Unavailable', description: 'Server temporarily unable to handle request' },
    504: { name: 'Gateway Timeout', description: 'Upstream server failed to respond in time' }
  };

  const info = codes[parseInt(code)];
  if (!info) return err(res, `Unknown status code: ${code}. Common codes: 200, 201, 301, 400, 401, 403, 404, 500`);
  ok(res, { code: parseInt(code), ...info, category: parseInt(code) < 200 ? 'Informational' : parseInt(code) < 300 ? 'Success' : parseInt(code) < 400 ? 'Redirect' : parseInt(code) < 500 ? 'Client Error' : 'Server Error' });
});

// ─── Regex Tester ─────────────────────────────────────────────────────────────
router.post('/regex', (req, res) => {
  const { pattern, text, flags = 'g' } = req.body;
  if (!pattern || !text) return err(res, 'Missing body: { pattern, text }');
  try {
    const regex = new RegExp(pattern, flags);
    const matches = [...text.matchAll(regex)].map(m => ({
      match: m[0],
      index: m.index,
      groups: m.groups || null
    }));
    ok(res, { pattern, flags, text, matches, total_matches: matches.length, is_match: matches.length > 0 });
  } catch (e) {
    err(res, `Invalid regex: ${e.message}`);
  }
});

// ─── JSON Formatter / Validator ───────────────────────────────────────────────
router.post('/json', (req, res) => {
  const { text, indent = 2 } = req.body;
  if (!text) return err(res, 'Missing body: { text }');
  try {
    const parsed = JSON.parse(text);
    const formatted = JSON.stringify(parsed, null, parseInt(indent));
    const stats = {
      keys: 0,
      arrays: 0,
      objects: 0,
      strings: 0,
      numbers: 0,
      booleans: 0,
      nulls: 0
    };
    function analyze(obj) {
      if (obj === null) { stats.nulls++; return; }
      if (Array.isArray(obj)) { stats.arrays++; obj.forEach(analyze); return; }
      if (typeof obj === 'object') { stats.objects++; Object.keys(obj).forEach(k => { stats.keys++; analyze(obj[k]); }); return; }
      if (typeof obj === 'string') stats.strings++;
      if (typeof obj === 'number') stats.numbers++;
      if (typeof obj === 'boolean') stats.booleans++;
    }
    analyze(parsed);
    ok(res, { valid: true, formatted, stats, size_bytes: Buffer.byteLength(formatted) });
  } catch (e) {
    ok(res, { valid: false, error: e.message, position: e.message.match(/position (\d+)/)?.[1] });
  }
});

// ─── UUID Generator ───────────────────────────────────────────────────────────
router.get('/uuid', (req, res) => {
  const { count = 1, version = 'v4' } = req.query;
  const { v4: uuidv4 } = require('uuid');
  const n = Math.min(parseInt(count) || 1, 50);
  const uuids = Array.from({ length: n }, () => uuidv4());
  ok(res, { version, count: n, uuids: n === 1 ? uuids[0] : uuids });
});

// ─── Timestamp Converter ──────────────────────────────────────────────────────
router.get('/timestamp', (req, res) => {
  const { ts, date } = req.query;
  if (ts) {
    const d = new Date(parseInt(ts) * (ts.length <= 10 ? 1000 : 1));
    if (isNaN(d.getTime())) return err(res, 'Invalid timestamp');
    ok(res, { timestamp: parseInt(ts), iso: d.toISOString(), utc: d.toUTCString(), local: d.toString(), unix_seconds: Math.floor(d.getTime() / 1000), unix_ms: d.getTime() });
  } else if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return err(res, 'Invalid date string');
    ok(res, { date, unix_seconds: Math.floor(d.getTime() / 1000), unix_ms: d.getTime(), iso: d.toISOString(), utc: d.toUTCString() });
  } else {
    const now = new Date();
    ok(res, { now_iso: now.toISOString(), now_utc: now.toUTCString(), unix_seconds: Math.floor(now.getTime() / 1000), unix_ms: now.getTime() });
  }
});

// ─── User Agent Parser ────────────────────────────────────────────────────────
router.get('/useragent', (req, res) => {
  const ua = req.query.ua || req.headers['user-agent'] || '';
  const info = {
    raw: ua,
    is_mobile: /Mobile|Android|iPhone/i.test(ua),
    is_bot: /bot|crawl|spider|scrape/i.test(ua),
    browser: ua.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\/\s]?([\d.]+)?/i)?.[0] || 'Unknown',
    os: ua.match(/(Windows NT [\d.]+|Mac OS X [\d_.]+|Linux|Android [\d.]+|iOS [\d_.]+)/i)?.[0] || 'Unknown',
    engine: ua.match(/(Gecko|WebKit|Blink|Trident|Presto)/i)?.[0] || 'Unknown'
  };
  ok(res, info);
});

module.exports = router;
