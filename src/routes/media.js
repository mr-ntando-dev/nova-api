'use strict';
const router = require('express').Router();
const axios  = require('axios');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── Random Meme ──────────────────────────────────────────────────────────────
router.get('/meme', async (req, res) => {
  const { subreddit = 'memes' } = req.query;
  try {
    const r = await axios.get(`https://meme-api.com/gimme/${subreddit}`, { timeout: 10000 });
    ok(res, {
      title: r.data.title,
      subreddit: r.data.subreddit,
      url: r.data.url,
      author: r.data.author,
      upvotes: r.data.ups,
      nsfw: r.data.nsfw,
      post_link: r.data.postLink
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Anime Waifu / SFW Image ──────────────────────────────────────────────────
router.get('/waifu', async (req, res) => {
  const { type = 'waifu' } = req.query;
  const allowed = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
  if (!allowed.includes(type)) return err(res, `Invalid type. Allowed: ${allowed.join(', ')}`);
  try {
    const r = await axios.get(`https://api.waifu.pics/sfw/${type}`, { timeout: 10000 });
    ok(res, { type, image_url: r.data.url });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Random Cat ───────────────────────────────────────────────────────────────
router.get('/cat', async (req, res) => {
  try {
    const r = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 10000 });
    ok(res, { image_url: r.data[0]?.url, breed: r.data[0]?.breeds?.[0]?.name || 'Unknown' });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Random Dog ───────────────────────────────────────────────────────────────
router.get('/dog', async (req, res) => {
  try {
    const r = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 10000 });
    const breed = r.data.message?.split('/').slice(-3, -2)[0]?.replace(/-/g, ' ') || 'Unknown';
    ok(res, { image_url: r.data.message, breed });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Neko Image ───────────────────────────────────────────────────────────────
router.get('/neko', async (req, res) => {
  try {
    const r = await axios.get('https://nekos.life/api/v2/img/neko', { timeout: 10000 });
    ok(res, { image_url: r.data.url });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Anime Quote ─────────────────────────────────────────────────────────────
router.get('/animequote', async (req, res) => {
  try {
    const r = await axios.get('https://animechan.xyz/api/random', { timeout: 10000 });
    ok(res, { quote: r.data.quote, character: r.data.character, anime: r.data.anime });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Pokémon Info ─────────────────────────────────────────────────────────────
router.get('/pokemon', async (req, res) => {
  const { name } = req.query;
  if (!name) return err(res, 'Missing ?name=');
  try {
    const r = await axios.get(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`, { timeout: 10000 });
    ok(res, {
      id: r.data.id,
      name: r.data.name,
      height: r.data.height,
      weight: r.data.weight,
      types: r.data.types.map(t => t.type.name),
      abilities: r.data.abilities.map(a => a.ability.name),
      sprite: r.data.sprites.front_default,
      sprite_shiny: r.data.sprites.front_shiny,
      base_stats: r.data.stats.reduce((acc, s) => { acc[s.stat.name] = s.base_stat; return acc; }, {})
    });
  } catch (e) {
    err(res, `Pokémon "${name}" not found`, 404);
  }
});

// ─── Anime Info (Jikan / MAL) ─────────────────────────────────────────────────
router.get('/anime', async (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    const r = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=${limit}`, { timeout: 15000 });
    const results = r.data.data.map(a => ({
      mal_id: a.mal_id,
      title: a.title,
      title_english: a.title_english,
      type: a.type,
      episodes: a.episodes,
      score: a.score,
      status: a.status,
      synopsis: a.synopsis?.slice(0, 200) + '...',
      image: a.images?.jpg?.image_url,
      url: a.url
    }));
    ok(res, { query: q, results });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Minecraft Username → UUID ────────────────────────────────────────────────
router.get('/minecraft', async (req, res) => {
  const { username } = req.query;
  if (!username) return err(res, 'Missing ?username=');
  try {
    const r = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`, { timeout: 10000 });
    ok(res, {
      username: r.data.name,
      uuid: r.data.id,
      skin: `https://crafatar.com/renders/body/${r.data.id}?overlay`,
      head: `https://crafatar.com/avatars/${r.data.id}?overlay`
    });
  } catch (e) {
    err(res, `Player "${username}" not found`, 404);
  }
});

module.exports = router;
