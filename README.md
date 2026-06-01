# 🎵 ListenUp

### Advanced Music Streaming Client

A premium, serverless music streaming platform that lets users discover, stream, organize music, and listen together in real-time using YouTube's vast audio library.

**Built with React, Flask, WebSockets, and the YouTube Iframe Player API.**

🌐 **Live Demo:** https://listen-up-lilac.vercel.app

---

## ✨ Features

### 🔍 Unlimited Music Search

Search millions of songs directly from YouTube without requiring API keys.

* Powered by `yt-dlp`
* Fast search results
* Auto-suggestions
* Unlimited music catalog

### ▶️ High-Quality Playback

Enjoy seamless music streaming through the YouTube Iframe Player API.

* Legal playback
* Reliable streaming
* No audio hosting required
* Zero bandwidth costs

### 🎧 Music Rooms (Listen Together)

Create rooms and listen to music in perfect sync with friends around the world.

* Real-time room creation
* Shared playback experience
* WebSocket synchronization
* Host-controlled sessions

### ❤️ Favorites

Save your favorite tracks locally for quick access.

### 📋 Smart Queue Management

Manage your listening experience effortlessly.

* Add songs to queue
* Remove tracks
* Reorder tracks
* Auto-play next song

### 🔀 Advanced Playback Controls

* Shuffle Mode
* Repeat One
* Repeat All
* Volume Controls
* Progress Tracking

### 🎨 Premium User Interface

* Modern dark theme
* Glassmorphism effects
* Neon gradients
* Smooth micro-animations
* Fully responsive design

---

# 🛠 Tech Stack

## Frontend

* React 19
* Vite
* Tailwind CSS v4

## Backend

* Python Flask
* Flask-SocketIO
* yt-dlp

## Real-Time Communication

* WebSockets
* Socket.IO

## Media Platform

* YouTube Iframe Player API

---

# 📂 Project Structure

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

---

# 🚀 Quick Start

## 1. Clone the Repository

```bash
git clone https://github.com/prateek977/ListenUp.git
cd ListenUp
```

## 2. Start the Backend

```bash
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

python server.py
```

Backend runs at:

```text
http://localhost:5001
```

---

## 3. Start the Frontend

```bash
cd listenup-web

npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

API requests are automatically proxied to the backend during development.

---

# ⚙️ Environment Variables

Create a `.env` file using `.env.example` as a reference.

For production deployments:

```env
VITE_API_URL=https://your-backend-url.com
```

---

# 🌍 Deployment

## Backend Deployment

The Flask backend can be deployed to platforms such as:

* Render
* Railway
* Fly.io
* VPS Servers

The included `Procfile` is configured for easy deployment on Render.

---

## Frontend Deployment

The React frontend can be deployed to:

* Vercel
* Netlify
* Cloudflare Pages

Set the production API endpoint using:

```env
VITE_API_URL=https://your-backend-url.com
```

---

# 🔮 Future Roadmap

* User Authentication
* Cloud-Synced Playlists
* Listening History
* Collaborative Playlists
* Friend Activity Feed
* Recommendation Engine
* Mobile Application
* Enhanced Room Permissions

---

# 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

# 📜 License

This project is licensed under the **GNU General Public License v2.0 (GPL-2.0)**.

See the `LICENSE` file for more information.

---

# 👨‍💻 Author

**Prateek Jaiswal**

If you found this project useful, consider giving it a ⭐ on GitHub.

Built with ❤️ using React, Flask, and WebSockets.
