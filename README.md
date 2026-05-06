# ⚡ NovaSpark API v3.0.0

**All-in-One API for WhatsApp Bots** — 75+ endpoints covering AI, downloaders, crypto, dev tools, entertainment & more. Deploy in 1 click.

![Version](https://img.shields.io/badge/version-3.0.0-6c5ce7)
![Endpoints](https://img.shields.io/badge/endpoints-75+-00d68f)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🚀 Deploy on Render

1. Push to GitHub
2. Go to [render.com](https://render.com/) → New → Web Service
3. Connect your repo — Render auto-detects `render.yaml`
4. Click **Deploy** — done!

## 📦 API Categories (75+ Endpoints)

| Category | Base Path | Endpoints |
|----------|-----------|-----------|
| 🤖 NovaAI | `/api/novaai` | Chat with personas, code gen, ELI5, compliments, pickup lines |
| 📥 Downloader | `/api/downloader` | YouTube, TikTok, Instagram, Facebook, Twitter, Pinterest |
| 🧠 AI | `/api/ai` | Chat, imagine, translate, summarize, sentiment, lyrics, trivia |
| 🛠️ Tools | `/api/tools` | QR, weather, currency, password, hash, base64, wiki, jokes |
| 💰 Crypto | `/api/crypto` | Prices, trending, coin info, global stats (CoinGecko) |
| 🎬 Entertainment | `/api/entertainment` | Movies, books, horoscope, riddles, facts, truth/dare |
| 👨‍💻 Dev Tools | `/api/dev` | GitHub, NPM, HTTP codes, regex, JSON, UUID, timestamps |
| 🔍 Search | `/api/search` | Web, news, images, GIFs, Urban Dictionary |
| 🎮 Media | `/api/media` | Memes, anime, pokemon, cats, dogs |
| 📱 WhatsApp | `/api/whatsapp` | Stickers, welcome/goodbye cards, rank cards |

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Auto | Server port (default 3000) |
| `OPENAI_API_KEY` | Optional | Enables GPT for AI chat |
| `HUGGINGFACE_API_KEY` | Optional | Enables HuggingFace models |
| `OPENWEATHER_API_KEY` | Optional | Better weather data |
| `RENDER_URL` | Optional | Keep-alive ping for free tier |

> **All endpoints work without API keys** using free fallbacks.

## 💻 Quick Start

```bash
git clone https://github.com/mr-ntando-dev/nova-api.git
cd nova-api
npm install
npm start
# Open http://localhost:3000
```

## 📡 Usage Examples

```javascript
const API = 'https://your-app.onrender.com';

// AI Chat with persona
const chat = await fetch(`${API}/api/novaai/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello!', persona: 'coder' })
}).then(r => r.json());

// Crypto price
const btc = await fetch(`${API}/api/crypto/price?coin=bitcoin`).then(r => r.json());

// TikTok download
const tt = await fetch(`${API}/api/downloader/tiktok?url=${videoUrl}`).then(r => r.json());

// GitHub user
const gh = await fetch(`${API}/api/dev/github?username=torvalds`).then(r => r.json());
```

## 🏗️ Stack

- Node.js 18+ / Express
- Sharp (image processing)
- @distube/ytdl-core (YouTube)
- Cheerio (scraping)
- CoinGecko API (crypto)
- Multiple free AI providers with fallbacks

## 📄 License

MIT — do whatever you want with it.
