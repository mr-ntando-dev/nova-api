'use strict';
const router = require('express').Router();
const axios  = require('axios');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── Movie/TV Search (OMDB free tier) ─────────────────────────────────────────
router.get('/movie', async (req, res) => {
  const { title, q, year, type = 'movie' } = req.query;
  const searchTitle = title || q; // accept both ?title= and ?q= for convenience
  if (!searchTitle) return err(res, 'Missing ?title= (or ?q=)');
  try {
    // Using free OMDB key (limited) or fallback
    const key = process.env.OMDB_API_KEY || '3e362930';
    const r = await axios.get(`https://www.omdbapi.com/?t=${encodeURIComponent(searchTitle)}&y=${year || ''}&type=${type}&apikey=${key}`, { timeout: 10000 });
    if (r.data.Response === 'False') return err(res, r.data.Error || 'Not found', 404);
    ok(res, {
      title: r.data.Title,
      year: r.data.Year,
      rated: r.data.Rated,
      released: r.data.Released,
      runtime: r.data.Runtime,
      genre: r.data.Genre,
      director: r.data.Director,
      actors: r.data.Actors,
      plot: r.data.Plot,
      poster: r.data.Poster,
      imdb_rating: r.data.imdbRating,
      imdb_id: r.data.imdbID,
      type: r.data.Type
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Book Search (Open Library — free, no key) ────────────────────────────────
router.get('/book', async (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    const r = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}`, { timeout: 15000 });
    const books = r.data.docs.slice(0, parseInt(limit)).map(b => ({
      title: b.title,
      author: b.author_name?.[0] || 'Unknown',
      first_published: b.first_publish_year,
      isbn: b.isbn?.[0],
      pages: b.number_of_pages_median,
      cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
      subjects: b.subject?.slice(0, 5),
      url: `https://openlibrary.org${b.key}`
    }));
    ok(res, { query: q, results: books });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Horoscope ────────────────────────────────────────────────────────────────
router.get('/horoscope', async (req, res) => {
  const { sign, day = 'today' } = req.query;
  const signs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
  if (!sign || !signs.includes(sign.toLowerCase())) return err(res, `Missing or invalid ?sign=. Valid: ${signs.join(', ')}`);
  try {
    const r = await axios.post(`https://aztro.sameerkumar.website/?sign=${sign.toLowerCase()}&day=${day}`, {}, { timeout: 10000 });
    ok(res, {
      sign: sign.toLowerCase(),
      day,
      date_range: r.data.date_range,
      description: r.data.description,
      mood: r.data.mood,
      color: r.data.color,
      lucky_number: r.data.lucky_number,
      lucky_time: r.data.lucky_time,
      compatibility: r.data.compatibility
    });
  } catch (e) {
    // Fallback: generate a basic horoscope
    const moods = ['Energetic', 'Calm', 'Adventurous', 'Thoughtful', 'Creative', 'Determined'];
    const colors = ['Blue', 'Red', 'Green', 'Purple', 'Gold', 'Silver'];
    ok(res, {
      sign: sign.toLowerCase(),
      day,
      description: `Today is a day for ${sign} to embrace new opportunities. Trust your instincts and stay open to unexpected connections.`,
      mood: moods[Math.floor(Math.random() * moods.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      lucky_number: Math.floor(Math.random() * 50) + 1,
      provider: 'fallback'
    });
  }
});

// ─── Random Riddle ────────────────────────────────────────────────────────────
router.get('/riddle', async (req, res) => {
  try {
    const r = await axios.get('https://riddles-api.vercel.app/random', { timeout: 10000 });
    ok(res, { riddle: r.data.riddle, answer: r.data.answer });
  } catch (e) {
    // Fallback riddles
    const riddles = [
      { riddle: "What has keys but no locks?", answer: "A piano" },
      { riddle: "What has a head and a tail but no body?", answer: "A coin" },
      { riddle: "What gets wetter the more it dries?", answer: "A towel" },
      { riddle: "I speak without a mouth and hear without ears. What am I?", answer: "An echo" },
      { riddle: "What can travel around the world while staying in a corner?", answer: "A stamp" }
    ];
    const r = riddles[Math.floor(Math.random() * riddles.length)];
    ok(res, { ...r, provider: 'fallback' });
  }
});

// ─── Random Fact ──────────────────────────────────────────────────────────────
router.get('/fact', async (req, res) => {
  const { category = 'random' } = req.query;
  try {
    const r = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 10000 });
    ok(res, { fact: r.data.text, source: r.data.source, source_url: r.data.source_url });
  } catch (e) {
    // Fallback
    const facts = [
      "Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that's still edible.",
      "Octopuses have three hearts and blue blood.",
      "A group of flamingos is called a 'flamboyance'.",
      "Bananas are berries, but strawberries aren't.",
      "The inventor of the Pringles can is buried in one."
    ];
    ok(res, { fact: facts[Math.floor(Math.random() * facts.length)], provider: 'fallback' });
  }
});

// ─── This Day in History ──────────────────────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const r = await axios.get(`https://history.muffinlabs.com/date/${month}/${day}`, { timeout: 10000 });
    const events = r.data.data.Events.slice(0, 5).map(e => ({ year: e.year, text: e.text }));
    const births = r.data.data.Births.slice(0, 3).map(b => ({ year: b.year, name: b.text }));
    ok(res, { date: r.data.date, events, births });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Would You Rather (static pool) ──────────────────────────────────────────
router.get('/wyr', (req, res) => {
  const questions = [
    { optionA: "Be able to fly", optionB: "Be able to read minds" },
    { optionA: "Never use social media again", optionB: "Never watch a movie again" },
    { optionA: "Have unlimited money", optionB: "Have unlimited knowledge" },
    { optionA: "Live 100 years in the past", optionB: "Live 100 years in the future" },
    { optionA: "Be famous but unhappy", optionB: "Be unknown but happy" },
    { optionA: "Always be 10 minutes late", optionB: "Always be 20 minutes early" },
    { optionA: "Have no internet for a month", optionB: "Have no phone for a month" },
    { optionA: "Speak every language fluently", optionB: "Play every instrument perfectly" }
  ];
  const q = questions[Math.floor(Math.random() * questions.length)];
  ok(res, { question: `Would you rather ${q.optionA} OR ${q.optionB}?`, ...q });
});

// ─── Truth or Dare ────────────────────────────────────────────────────────────
router.get('/truthordare', (req, res) => {
  const { type = 'random' } = req.query;
  const truths = [
    "What's the most embarrassing thing you've ever done?",
    "What's a secret you've never told anyone?",
    "What's the biggest lie you've ever told?",
    "What's your biggest fear?",
    "If you could change one thing about yourself, what would it be?"
  ];
  const dares = [
    "Send a message to the 5th person in your contacts saying 'I love you'",
    "Post an ugly selfie on your status for 1 hour",
    "Do 20 pushups right now",
    "Speak in an accent for the next 5 minutes",
    "Let the group choose your profile picture for 24 hours"
  ];

  let chosen;
  if (type === 'truth') chosen = { type: 'truth', prompt: truths[Math.floor(Math.random() * truths.length)] };
  else if (type === 'dare') chosen = { type: 'dare', prompt: dares[Math.floor(Math.random() * dares.length)] };
  else {
    const isTruth = Math.random() > 0.5;
    const pool = isTruth ? truths : dares;
    chosen = { type: isTruth ? 'truth' : 'dare', prompt: pool[Math.floor(Math.random() * pool.length)] };
  }
  ok(res, chosen);
});

module.exports = router;
