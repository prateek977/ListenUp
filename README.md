# 🎵 ListenUp Web - Advanced Music Streaming Client

A premium, serverless web music streaming application that lets you search, stream, and organize music directly from YouTube's vast audio library.

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4
- **Backend:** Python Flask + yt-dlp (YouTube search scraper)
- **Playback:** YouTube Iframe Player API (legal, unlimited, zero bandwidth cost)

## Quick Start

### 1. Start the Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python server.py
```
Backend runs at `http://localhost:5001`

### 2. Start the Frontend (Development)
```bash
cd listenup-web
npm install
npm run dev
```
Frontend runs at `http://localhost:5173` (proxies API calls to backend)

## Features

- 🔍 **Unlimited Search** — No API key needed, powered by yt-dlp scraping
- ▶️ **YouTube Iframe Playback** — Legal, high-quality streaming
- ❤️ **Favorites** — Saved locally in your browser
- 📋 **Play Queue** — Add, remove, reorder, auto-play next
- 🔀 **Shuffle & Repeat** — Single track or full queue
- 🎨 **Premium Dark UI** — Glassmorphism, neon gradients, micro-animations

## License

See [LICENSE](./LICENSE) for details.
