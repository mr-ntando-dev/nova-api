# NovaSpark All-in-One API 🚀

A massive all-in-one API server for WhatsApp bots. **50+ endpoints** covering downloaders, AI, tools, media, and search.

## Deploy on Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — just click **Deploy**
5. Set optional env vars in the Render dashboard (see below)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Auto-set | `production` |
| `PORT` | Auto-set | `10000` on Render |
| `OPENAI_API_KEY` | Optional | Enables GPT-3.5 for `/api/ai/chat` |
| `OPENWEATHER_API_KEY` | Optional | Enables detailed weather data |
| `HUGGINGFACE_API_KEY` | Optional | Enables summarizer + better AI chat |
| `RENDER_URL` | Optional | Your Render URL — keeps service alive |

> Without API keys, most endpoints still work using free fallbacks.

## API Endpoints

### 📥 Downloader `/api/downloader`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/youtube?url=` | YouTube video info + download links |
| GET | `/youtube/audio?url=` | YouTube audio (MP3) |
| GET | `/youtube/search?q=` | YouTube search |
| GET | `/tiktok?url=` | TikTok no-watermark download |
| GET | `/instagram?url=` | Instagram media |
| GET | `/facebook?url=` | Facebook video |
| GET | `/twitter?url=` | Twitter/X video |
| GET | `/pinterest?url=` | Pinterest media |
| GET | `/soundcloud?url=` | SoundCloud track info |
| GET | `/spotify?url=` | Spotify track info + preview |

### 🤖 AI `/api/ai`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat` `{message}` | AI chat (GPT / Pollinations fallback) |
| GET | `/imagine?prompt=` | AI image generation (Pollinations) |
| GET | `/translate?text=&to=` | Text translation (90+ languages) |
| POST | `/summarize` `{text}` | Text summarizer |
| POST | `/sentiment` `{text}` | Sentiment analysis |
| GET | `/lyrics?song=&artist=` | Song lyrics |
| GET | `/trivia` | Trivia questions |
| GET | `/define?word=` | Word definition |

### 🛠️ Tools `/api/tools`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/qr?text=` | QR code generator |
| GET | `/shorten?url=` | URL shortener (TinyURL) |
| GET | `/password?length=` | Password generator |
| GET | `/ip?ip=` | IP lookup |
| GET | `/weather?city=` | Weather info |
| GET | `/currency?from=&to=&amount=` | Currency converter |
| GET | `/joke` | Random joke |
| GET | `/quote` | Random quote |
| GET | `/wiki?q=` | Wikipedia search |
| GET | `/base64/encode?text=` | Base64 encode |
| GET | `/base64/decode?text=` | Base64 decode |
| GET | `/hash?text=&algo=md5` | Hash generator |
| GET | `/color?hex=` | Color info |
| GET | `/convert?value=&from=&to=` | Unit converter |
| GET | `/palindrome?text=` | Palindrome check |
| GET | `/reverse?text=` | Reverse text |
| GET | `/wordcount?text=` | Word counter |
| GET | `/numfact?number=` | Number fact |
| GET | `/time?timezone=` | Time/timezone |

### 📱 WhatsApp `/api/whatsapp`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/sticker` `{imageUrl}` | Image → WebP sticker |
| GET | `/text2img?text=` | Text → PNG image |
| GET | `/welcome?name=&group=` | Welcome card PNG |
| GET | `/goodbye?name=&group=` | Goodbye card PNG |
| GET | `/rankcard?name=&level=&xp=&maxXp=` | Rank card PNG |
| GET | `/qr?text=` | QR code PNG |

### 🔍 Search `/api/search`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/google?q=` | Web search (DuckDuckGo) |
| GET | `/news?q=` | News search |
| GET | `/gif?q=` | GIF search (Tenor) |
| GET | `/images?q=` | Image search |
| GET | `/urban?term=` | Urban Dictionary |

### 🎮 Media `/api/media`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/meme?subreddit=` | Random meme |
| GET | `/waifu?type=` | Anime SFW image |
| GET | `/cat` | Random cat |
| GET | `/dog` | Random dog |
| GET | `/neko` | Neko image |
| GET | `/animequote` | Anime quote |
| GET | `/pokemon?name=` | Pokémon info |
| GET | `/anime?q=` | Anime search |
| GET | `/minecraft?username=` | Minecraft player info |

## Usage from WhatsApp Bot

```js
const API = 'https://your-service.onrender.com';

// Download TikTok
const tiktok = await fetch(`${API}/api/downloader/tiktok?url=${videoUrl}`).then(r => r.json());
console.log(tiktok.video_nowatermark);

// AI Chat
const chat = await fetch(`${API}/api/ai/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello!' })
}).then(r => r.json());
console.log(chat.reply);

// Make sticker
const sticker = await fetch(`${API}/api/whatsapp/sticker`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageUrl: 'https://...' })
}).then(r => r.json());
// sticker.base64 → send as WebP sticker
```

## Stack
- Node.js 18+ / Express
- Sharp (image processing)
- ytdl-core (YouTube)
- Cheerio (scraping)
- QRCode, Sentiment, and more
