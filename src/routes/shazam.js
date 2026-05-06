'use strict';
const router = require('express').Router();
const axios  = require('axios');
const https  = require('https');

// Render's outbound TLS can be finicky with some hosts — use a permissive agent as fallback
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── Helper: ACRCloud fingerprint-based identification ────────────────────────
// Falls back to audd.io (free tier, no key needed for basic)
// Supports: URL-based audio identify, YouTube URL identify, and manual search

// ─── Identify song from audio URL ────────────────────────────────────────────
// GET /api/shazam/identify?url=<audio_url>
router.get('/identify', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url= (direct link to .mp3 / .wav / .ogg / etc.)');
  try {
    const form = new URLSearchParams();
    form.append('url', url);
    form.append('return', 'apple_music,spotify');
    const r = await axios.post('https://api.audd.io/', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });
    if (!r.data?.result) {
      return err(res, 'Song not recognized. Try a clearer audio clip (5-20 seconds).', 404);
    }
    const s = r.data.result;
    ok(res, {
      identified: true,
      title: s.title,
      artist: s.artist,
      album: s.album,
      release_date: s.release_date,
      label: s.label,
      timecode: s.timecode,
      song_link: s.song_link,
      apple_music: s.apple_music ? {
        preview: s.apple_music.previews?.[0]?.url,
        artwork: s.apple_music.artwork?.url?.replace('{w}', '500').replace('{h}', '500'),
        url: s.apple_music.url,
        genres: s.apple_music.genreNames
      } : null,
      spotify: s.spotify ? {
        id: s.spotify.id,
        preview: s.spotify.preview_url,
        url: `https://open.spotify.com/track/${s.spotify.id}`,
        popularity: s.spotify.popularity
      } : null
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Identify from YouTube URL ────────────────────────────────────────────────
// GET /api/shazam/youtube?url=<youtube_url>
router.get('/youtube', async (req, res) => {
  const { url } = req.query;
  if (!url) return err(res, 'Missing ?url= (YouTube video URL)');
  try {
    const form = new URLSearchParams();
    form.append('url', url);
    form.append('return', 'apple_music,spotify');
    const r = await axios.post('https://api.audd.io/', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 25000
    });
    if (!r.data?.result) {
      return err(res, 'Song not recognized from this YouTube video.', 404);
    }
    const s = r.data.result;
    ok(res, {
      identified: true,
      source: 'youtube',
      youtube_url: url,
      title: s.title,
      artist: s.artist,
      album: s.album,
      release_date: s.release_date,
      song_link: s.song_link,
      spotify: s.spotify ? {
        id: s.spotify.id,
        preview: s.spotify.preview_url,
        url: `https://open.spotify.com/track/${s.spotify.id}`,
        popularity: s.spotify.popularity
      } : null
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Search song by title/artist (no audio needed) ───────────────────────────
// GET /api/shazam/search?q=Blinding+Lights
// GET /api/shazam/search?title=Blinding+Lights&artist=The+Weeknd
router.get('/search', async (req, res) => {
  const { q, title, artist, limit = 5 } = req.query;
  const query = q || [title, artist].filter(Boolean).join(' ');
  if (!query) return err(res, 'Missing ?q= or ?title= / ?artist=');
  try {
    // Use MusicBrainz (free, no key, rich metadata)
    const mbRes = await axios.get('https://musicbrainz.org/ws/2/recording', {
      params: {
        query: `"${query}"`,
        fmt: 'json',
        limit: parseInt(limit)
      },
      httpsAgent, headers: { 'User-Agent': 'NovaSpark-API/3.1 (novaspark-api@example.com)' },
      timeout: 15000
    });
    const recordings = mbRes.data.recordings || [];
    if (!recordings.length) return err(res, 'No results found', 404);
    const results = recordings.map(r => ({
      title: r.title,
      artist: r['artist-credit']?.map(a => a.name).join(', ') || 'Unknown',
      duration_ms: r.length || null,
      duration: r.length ? `${Math.floor(r.length / 60000)}:${String(Math.floor((r.length % 60000) / 1000)).padStart(2, '0')}` : null,
      score: r.score,
      releases: r.releases?.slice(0, 2).map(rel => ({
        title: rel.title,
        date: rel.date,
        country: rel.country,
        status: rel.status
      })) || [],
      musicbrainz_id: r.id,
      musicbrainz_url: `https://musicbrainz.org/recording/${r.id}`
    }));
    ok(res, { query, total: mbRes.data.count, results });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Get full song details by MusicBrainz recording ID ───────────────────────
// GET /api/shazam/details?mbid=<musicbrainz_recording_id>
router.get('/details', async (req, res) => {
  const { mbid } = req.query;
  if (!mbid) return err(res, 'Missing ?mbid= (MusicBrainz recording ID)');
  try {
    const r = await axios.get(`https://musicbrainz.org/ws/2/recording/${mbid}`, {
      params: { fmt: 'json', inc: 'artists+releases+genres+tags+ratings' },
      httpsAgent, headers: { 'User-Agent': 'NovaSpark-API/3.1 (novaspark-api@example.com)' },
      timeout: 15000
    });
    ok(res, {
      mbid: r.data.id,
      title: r.data.title,
      duration_ms: r.data.length,
      duration: r.data.length
        ? `${Math.floor(r.data.length / 60000)}:${String(Math.floor((r.data.length % 60000) / 1000)).padStart(2, '0')}`
        : null,
      artist: r.data['artist-credit']?.map(a => a.name).join(', ') || 'Unknown',
      first_release_date: r.data['first-release-date'],
      genres: r.data.genres?.map(g => g.name) || [],
      tags: r.data.tags?.slice(0, 10).map(t => t.name) || [],
      rating: r.data.rating ? { value: r.data.rating.value, votes: r.data.rating['votes-count'] } : null,
      releases: r.data.releases?.slice(0, 5).map(rel => ({
        id: rel.id,
        title: rel.title,
        date: rel.date,
        country: rel.country,
        label: rel['label-info']?.[0]?.label?.name
      })) || [],
      musicbrainz_url: `https://musicbrainz.org/recording/${r.data.id}`
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Get artist details ───────────────────────────────────────────────────────
// GET /api/shazam/artist?name=The+Weeknd
router.get('/artist', async (req, res) => {
  const { name, mbid } = req.query;
  if (!name && !mbid) return err(res, 'Missing ?name= or ?mbid=');
  try {
    let artistData;
    if (mbid) {
      const r = await axios.get(`https://musicbrainz.org/ws/2/artist/${mbid}`, {
        params: { fmt: 'json', inc: 'url-rels+genres+tags+ratings' },
        httpsAgent, headers: { 'User-Agent': 'NovaSpark-API/3.1 (novaspark-api@example.com)' },
        timeout: 15000
      });
      artistData = r.data;
    } else {
      const r = await axios.get('https://musicbrainz.org/ws/2/artist', {
        params: { query: `"${name}"`, fmt: 'json', limit: 1 },
        httpsAgent, headers: { 'User-Agent': 'NovaSpark-API/3.1 (novaspark-api@example.com)' },
        timeout: 15000
      });
      if (!r.data.artists?.length) return err(res, 'Artist not found', 404);
      const topArtist = r.data.artists[0];
      const r2 = await axios.get(`https://musicbrainz.org/ws/2/artist/${topArtist.id}`, {
        params: { fmt: 'json', inc: 'url-rels+genres+tags+ratings' },
        httpsAgent, headers: { 'User-Agent': 'NovaSpark-API/3.1 (novaspark-api@example.com)' },
        timeout: 15000
      });
      artistData = r2.data;
    }
    // Extract social links
    const links = {};
    if (artistData.relations) {
      for (const rel of artistData.relations) {
        const type = rel.type?.toLowerCase().replace(' ', '_');
        if (rel.url?.resource) links[type] = rel.url.resource;
      }
    }
    ok(res, {
      mbid: artistData.id,
      name: artistData.name,
      sort_name: artistData['sort-name'],
      type: artistData.type,
      gender: artistData.gender,
      country: artistData.country,
      area: artistData.area?.name,
      born: artistData['life-span']?.begin,
      ended: artistData['life-span']?.ended ? artistData['life-span'].end : null,
      genres: artistData.genres?.map(g => g.name) || [],
      tags: artistData.tags?.slice(0, 10).map(t => t.name) || [],
      rating: artistData.rating ? { value: artistData.rating.value, votes: artistData.rating['votes-count'] } : null,
      links,
      musicbrainz_url: `https://musicbrainz.org/artist/${artistData.id}`
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Get trending / charts (via Last.fm free API) ─────────────────────────────
// GET /api/shazam/trending?limit=10
// GET /api/shazam/trending?country=US&limit=10
router.get('/trending', async (req, res) => {
  const { limit = 10, country } = req.query;
  try {
    const key = process.env.LASTFM_API_KEY || 'no-key';
    let endpoint, params;
    if (country) {
      endpoint = 'geo.getTopTracks';
      params = { method: endpoint, country, limit, api_key: key, format: 'json' };
    } else {
      endpoint = 'chart.getTopTracks';
      params = { method: endpoint, limit, api_key: key, format: 'json' };
    }
    const r = await axios.get('https://ws.audioscrobbler.com/2.0/', { params, timeout: 15000 });
    const tracks = (r.data.tracks?.track || r.data.toptracks?.track || []).map((t, i) => ({
      rank: i + 1,
      title: t.name,
      artist: t.artist?.name || t.artist,
      listeners: t.listeners ? parseInt(t.listeners).toLocaleString() : null,
      playcount: t.playcount ? parseInt(t.playcount).toLocaleString() : null,
      url: t.url,
      duration_sec: t.duration ? parseInt(t.duration) : null
    }));
    if (!tracks.length) throw new Error('No data');
    ok(res, { country: country || 'global', limit: parseInt(limit), tracks });
  } catch (e) {
    // Fallback: iTunes top songs RSS
    try {
      const cc = country?.toLowerCase() || 'us';
      const r2 = await axios.get(
        `https://itunes.apple.com/${cc}/rss/topsongs/limit=${limit}/json`,
        { timeout: 15000 }
      );
      const entries = r2.data.feed?.entry || [];
      const tracks = entries.map((e, i) => ({
        rank: i + 1,
        title: e['im:name']?.label,
        artist: e['im:artist']?.label,
        album: e['im:collection']?.['im:name']?.label,
        artwork: e['im:image']?.[2]?.label,
        price: e['im:price']?.label,
        release_date: e['im:releaseDate']?.label,
        itunes_url: e.link?.attributes?.href,
        provider: 'itunes'
      }));
      ok(res, { country: cc, limit: parseInt(limit), tracks });
    } catch (e2) {
      err(res, 'Could not fetch trending charts: ' + e2.message, 500);
    }
  }
});

// ─── Lyrics search ────────────────────────────────────────────────────────────
// GET /api/shazam/lyrics?title=Blinding+Lights&artist=The+Weeknd
router.get('/lyrics', async (req, res) => {
  const { title, artist } = req.query;
  if (!title || !artist) return err(res, 'Missing ?title= and ?artist=');
  try {
    const r = await axios.get(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      { timeout: 15000 }
    );
    if (!r.data?.lyrics) return err(res, 'Lyrics not found', 404);
    ok(res, {
      title,
      artist,
      lyrics: r.data.lyrics.trim(),
      lines: r.data.lyrics.trim().split('\n').length
    });
  } catch (e) {
    err(res, 'Lyrics not found for this song', 404);
  }
});

module.exports = router;
