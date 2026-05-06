'use strict';
const router = require('express').Router();
const axios = require('axios');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── AI Chat (uses multiple free providers with fallback) ─────────────────────
router.post('/chat', async (req, res) => {
  const { message, system = 'You are a helpful WhatsApp assistant.' } = req.body;
  if (!message) return err(res, 'Missing body: { message }');

  // Try OpenAI first if key is set
  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: system }, { role: 'user', content: message }],
        max_tokens: 500
      }, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 20000
      });
      return ok(res, { reply: r.data.choices[0].message.content.trim(), provider: 'openai' });
    } catch (e) { /* fallthrough */ }
  }

  // Fallback: Pollinations AI (free, no key)
  try {
    const prompt = encodeURIComponent(`${system}\n\nUser: ${message}\nAssistant:`);
    const r = await axios.get(`https://text.pollinations.ai/${prompt}`, { timeout: 20000 });
    return ok(res, { reply: r.data.trim(), provider: 'pollinations' });
  } catch (e) { /* fallthrough */ }

  // Fallback: HuggingFace (free tier)
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const r = await axios.post(
        'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1',
        { inputs: `[INST] ${message} [/INST]` },
        { headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` }, timeout: 30000 }
      );
      const reply = Array.isArray(r.data) ? r.data[0]?.generated_text : r.data?.generated_text;
      return ok(res, { reply: reply?.replace(`[INST] ${message} [/INST]`, '').trim(), provider: 'huggingface' });
    } catch (e) { /* fallthrough */ }
  }

  err(res, 'All AI providers failed. Add OPENAI_API_KEY or HUGGINGFACE_API_KEY in env.', 503);
});

// ─── AI Image Generation (Pollinations — free, no key) ────────────────────────
router.get('/imagine', async (req, res) => {
  const { prompt, width = 512, height = 512, model = 'flux' } = req.query;
  if (!prompt) return err(res, 'Missing ?prompt=');
  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&nologo=true`;
    // Verify it works
    await axios.head(imageUrl, { timeout: 10000 });
    ok(res, { prompt, image_url: imageUrl, width: parseInt(width), height: parseInt(height), model });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Translate (using MyMemory — free, no key) ────────────────────────────────
router.get('/translate', async (req, res) => {
  const { text, to = 'en', from = 'auto' } = req.query;
  if (!text) return err(res, 'Missing ?text=');
  try {
    const langPair = from === 'auto' ? `|${to}` : `${from}|${to}`;
    const r = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`, { timeout: 10000 });
    ok(res, {
      original: text,
      translated: r.data.responseData.translatedText,
      from: r.data.responseData.match,
      to,
      quality: r.data.responseData.match
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Text Summarizer ──────────────────────────────────────────────────────────
router.post('/summarize', async (req, res) => {
  const { text } = req.body;
  if (!text) return err(res, 'Missing body: { text }');
  if (text.length < 100) return err(res, 'Text too short to summarize (min 100 chars)');
  try {
    if (process.env.HUGGINGFACE_API_KEY) {
      const r = await axios.post(
        'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
        { inputs: text.slice(0, 1024) },
        { headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` }, timeout: 30000 }
      );
      const summary = Array.isArray(r.data) ? r.data[0]?.summary_text : r.data?.summary_text;
      return ok(res, { original_length: text.length, summary, provider: 'huggingface' });
    }
    // Fallback: basic extractive summarizer (no API needed)
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [];
    const topN = Math.max(2, Math.ceil(sentences.length * 0.3));
    const summary = sentences.slice(0, topN).join(' ');
    ok(res, { original_length: text.length, summary, provider: 'extractive' });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Sentiment Analysis ───────────────────────────────────────────────────────
router.post('/sentiment', (req, res) => {
  const { text } = req.body;
  if (!text) return err(res, 'Missing body: { text }');
  const result = sentiment.analyze(text);
  const label = result.score > 0 ? 'positive' : result.score < 0 ? 'negative' : 'neutral';
  const emoji = result.score > 0 ? '😊' : result.score < 0 ? '😞' : '😐';
  ok(res, {
    text,
    score: result.score,
    comparative: result.comparative.toFixed(3),
    label,
    emoji,
    positive_words: result.positive,
    negative_words: result.negative
  });
});

// ─── Lyrics Finder ───────────────────────────────────────────────────────────
router.get('/lyrics', async (req, res) => {
  const { song, artist = '' } = req.query;
  if (!song) return err(res, 'Missing ?song=');
  try {
    const q = artist ? `${artist} ${song}` : song;
    const r = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist || song)}/${encodeURIComponent(song)}`, { timeout: 10000 });
    ok(res, { song, artist, lyrics: r.data.lyrics });
  } catch (e) {
    // Fallback to lrclib
    try {
      const r2 = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(song + ' ' + artist)}`, { timeout: 10000 });
      if (r2.data && r2.data[0]) {
        const track = r2.data[0];
        ok(res, { song: track.trackName, artist: track.artistName, lyrics: track.plainLyrics || track.syncedLyrics });
      } else {
        err(res, 'Lyrics not found');
      }
    } catch (e2) {
      err(res, 'Lyrics not found: ' + e2.message, 404);
    }
  }
});

// ─── Trivia ───────────────────────────────────────────────────────────────────
router.get('/trivia', async (req, res) => {
  const { category, difficulty = 'easy', amount = 1 } = req.query;
  try {
    let url = `https://opentdb.com/api.php?amount=${amount}&difficulty=${difficulty}&type=multiple`;
    if (category) url += `&category=${category}`;
    const r = await axios.get(url, { timeout: 10000 });
    if (r.data.response_code !== 0) return err(res, 'No trivia questions found');
    const questions = r.data.results.map(q => ({
      category: q.category,
      difficulty: q.difficulty,
      question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
      correct_answer: q.correct_answer,
      options: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5)
        .map(a => a.replace(/&quot;/g, '"').replace(/&#039;/g, "'"))
    }));
    ok(res, { questions });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Dictionary / Word Definition ─────────────────────────────────────────────
router.get('/define', async (req, res) => {
  const { word } = req.query;
  if (!word) return err(res, 'Missing ?word=');
  try {
    const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 10000 });
    const entry = r.data[0];
    ok(res, {
      word: entry.word,
      phonetic: entry.phonetic,
      audio: entry.phonetics?.find(p => p.audio)?.audio,
      meanings: entry.meanings.map(m => ({
        part_of_speech: m.partOfSpeech,
        definitions: m.definitions.slice(0, 3).map(d => ({ definition: d.definition, example: d.example })),
        synonyms: m.synonyms.slice(0, 5),
        antonyms: m.antonyms.slice(0, 5)
      }))
    });
  } catch (e) {
    err(res, `Word "${word}" not found`, 404);
  }
});

module.exports = router;
