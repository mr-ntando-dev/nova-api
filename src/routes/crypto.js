'use strict';
const router = require('express').Router();
const axios  = require('axios');

const ok  = (res, data) => res.json({ success: true, ...data });
const err = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

// ─── Crypto Price (CoinGecko — free, no key) ─────────────────────────────────
router.get('/price', async (req, res) => {
  const { coin = 'bitcoin', currency = 'usd' } = req.query;
  try {
    const r = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.toLowerCase()}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`, { timeout: 10000 });
    const data = r.data[coin.toLowerCase()];
    if (!data) return err(res, `Coin "${coin}" not found. Use CoinGecko IDs (e.g. bitcoin, ethereum, solana)`);
    ok(res, {
      coin: coin.toLowerCase(),
      currency: currency.toLowerCase(),
      price: data[currency],
      change_24h: data[`${currency}_24h_change`],
      market_cap: data[`${currency}_market_cap`],
      volume_24h: data[`${currency}_24h_vol`]
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Multiple Prices ──────────────────────────────────────────────────────────
router.get('/prices', async (req, res) => {
  const { coins = 'bitcoin,ethereum,solana', currency = 'usd' } = req.query;
  try {
    const r = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=${currency}&include_24hr_change=true`, { timeout: 10000 });
    const results = Object.entries(r.data).map(([id, data]) => ({
      coin: id,
      price: data[currency],
      change_24h: data[`${currency}_24h_change`]?.toFixed(2) + '%'
    }));
    ok(res, { currency, results });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Trending Coins ───────────────────────────────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const r = await axios.get('https://api.coingecko.com/api/v3/search/trending', { timeout: 10000 });
    const coins = r.data.coins.map(c => ({
      name: c.item.name,
      symbol: c.item.symbol,
      id: c.item.id,
      market_cap_rank: c.item.market_cap_rank,
      thumb: c.item.thumb,
      price_btc: c.item.price_btc
    }));
    ok(res, { trending: coins });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Coin Details ─────────────────────────────────────────────────────────────
router.get('/info', async (req, res) => {
  const { coin = 'bitcoin' } = req.query;
  try {
    const r = await axios.get(`https://api.coingecko.com/api/v3/coins/${coin.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false`, { timeout: 15000 });
    const d = r.data;
    ok(res, {
      id: d.id,
      name: d.name,
      symbol: d.symbol,
      image: d.image?.large,
      description: d.description?.en?.slice(0, 500),
      market_cap_rank: d.market_cap_rank,
      current_price_usd: d.market_data?.current_price?.usd,
      ath_usd: d.market_data?.ath?.usd,
      ath_date: d.market_data?.ath_date?.usd,
      atl_usd: d.market_data?.atl?.usd,
      total_supply: d.market_data?.total_supply,
      circulating_supply: d.market_data?.circulating_supply,
      homepage: d.links?.homepage?.[0],
      genesis_date: d.genesis_date
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Search Coins ─────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return err(res, 'Missing ?q=');
  try {
    const r = await axios.get(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`, { timeout: 10000 });
    const coins = r.data.coins.slice(0, 10).map(c => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      market_cap_rank: c.market_cap_rank,
      thumb: c.thumb
    }));
    ok(res, { query: q, results: coins });
  } catch (e) {
    err(res, e.message, 500);
  }
});

// ─── Global Crypto Stats ──────────────────────────────────────────────────────
router.get('/global', async (req, res) => {
  try {
    const r = await axios.get('https://api.coingecko.com/api/v3/global', { timeout: 10000 });
    const d = r.data.data;
    ok(res, {
      active_cryptocurrencies: d.active_cryptocurrencies,
      markets: d.markets,
      total_market_cap_usd: d.total_market_cap?.usd,
      total_volume_24h_usd: d.total_volume?.usd,
      bitcoin_dominance: d.market_cap_percentage?.btc?.toFixed(2) + '%',
      ethereum_dominance: d.market_cap_percentage?.eth?.toFixed(2) + '%',
      market_cap_change_24h: d.market_cap_change_percentage_24h_usd?.toFixed(2) + '%'
    });
  } catch (e) {
    err(res, e.message, 500);
  }
});

module.exports = router;
