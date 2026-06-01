# 🎵 ListenUp - Advanced Music Streaming Client

A premium, serverless web music streaming application that lets you search, stream, organize music, and listen with friends in real-time, powered directly by YouTube's vast audio library.

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4
- **Backend:** Python Flask + Flask-SocketIO + yt-dlp (YouTube search scraper)
- **Playback:** YouTube Iframe Player API (legal, unlimited, zero bandwidth cost)
- **Real-time:** WebSockets for synchronized "Listen Together" rooms

## Project Structure

```text
listenup/
├── backend/                   # Python Flask Server
│   ├── server.py              # Main API and WebSocket server
│   ├── requirements.txt       # Python dependencies
│   └── Procfile               # Deployment config for Render
├── listenup-web/              # React Frontend (Vite)
│   ├── src/
│   │   ├── App.jsx            # Main application component & player UI
│   │   ├── main.jsx           # React entry point
│   │   └── index.css          # Tailwind and custom global styles
│   ├── public/                # Static assets (logo, etc.)
│   ├── index.html             # HTML entry point
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── vite.config.js         # Vite bundler configuration
│   ├── .env.example           # Example environment variables
│   └── package.json           # Node dependencies and scripts
└── README.md                  # Project documentation
```

## Features

- 🔍 **Unlimited Search** — No API key needed, powered by yt-dlp scraping. Features auto-suggestions.
- ▶️ **YouTube Iframe Playback** — Legal, high-quality audio streaming.
- 🎧 **Music Rooms (Listen Together)** — Create a room and listen to music in perfect sync with friends globally.
- ❤️ **Favorites** — Curate your favorite songs, saved locally in your browser.
- 📋 **Play Queue** — Add, remove, reorder, and auto-play next tracks seamlessly.
- 🔀 **Shuffle & Repeat** — Single track or full queue looping.
- 🎨 **Premium Dark UI** — Responsive layout, glassmorphism, neon gradients, and micro-animations.

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
Frontend runs at `http://localhost:5173`. Make sure to set `VITE_API_URL` if connecting to a remote backend.

## Deployment

- **Backend:** Deployed easily to services like [Render](https://render.com) using the provided `Procfile` and Gunicorn with Eventlet.
- **Frontend:** Deployed easily to static hosting like [Vercel](https://vercel.com). Configure the `VITE_API_URL` environment variable to point to your live backend.

## License

See [LICENSE](./LICENSE) for details.
