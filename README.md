# 🎵 ListenUp - Advanced Android Music Streaming Client

![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-0095D5?style=for-the-badge&logo=kotlin&logoColor=white)
![Jetpack Compose](https://img.shields.io/badge/Jetpack%20Compose-4285F4?style=for-the-badge&logo=android&logoColor=white)
![Hilt](https://img.shields.io/badge/Hilt-Dependency%20Injection-orange?style=for-the-badge)

> **A production-grade, serverless music streaming application built to demonstrate modern Android development practices, reverse-engineering capabilities, and Clean Architecture patterns.**

---

## 🚀 Key Technical Highlights

This project goes beyond a standard music player by solving complex real-world engineering challenges:

### 1. Custom Reverse-Engineered YouTube Client (The "403 Bypass")
Most third-party YouTube clients rely on unstable public APIs (like Piped) or heavy external libraries that frequently break due to YouTube's "PoToken" and bot detection updates. 
**ListenUp implements a custom, native Kotlin client for the internal YouTube `InnerTube` API.**
- **Challenge**: YouTube actively blocks non-official clients with HTTP 403 errors and "Content Unavailable" exceptions.
- **Solution**: I reverse-engineered the official YouTube Android App's network traffic to replicate the exact client context, headers, and signature generation required to authenticate as a legitimate device.
- **Result**: Reliable, fast, and high-quality audio streaming **without any external proxy servers** or Python dependencies. Accesses the raw `audio/mp4` and `audio/webm` streams directly from Google's servers.

### 2. Modern Clean Architecture
Structuring the app for scalability, testability, and maintainability:
- **Domain Layer**: Pure Kotlin business logic, platform-agnostic (Models, Repository Interfaces).
- **Data Layer**: Handles data sources (Room DB, Retrofit, Custom TCP implementations) and maps data to domain models.
- **UI Layer**: MVVM pattern with `StateFlow` for reactive UI updates, built 100% with **Jetpack Compose**.

### 3. Robust Media Playback Engine
- Utilizes **ExoPlayer (Media3)** for high-performance audio rendering.
- Implements a **Foreground Service** with `MediaSession` integration to support background playback, lock-screen controls, and headset button events.
- Features a seamless **Spotify-style MiniPlayer** with smooth expansion animations and persistent state management across navigation destinations.

---

## 🛠 Tech Stack & Libraries

*   **Language**: 100% Kotlin
*   **UI Toolkit**: Jetpack Compose (Material3 Design System)
*   **Dependency Injection**: Hilt (Dagger)
*   **Asynchronous Processing**: Coroutines & Kotlin Flow
*   **Networking**:
    *   **OkHttp/Retrofit**: For standard API calls.
    *   **Custom Network Layer**: For specific YouTube internal API interactions.
*   **Local Storage**: Room Database (Offline caching of Search History, Favorites, and Recently Played).
*   **Image Loading**: Coil (Async image loading with memory caching).
*   **Navigation**: Jetpack Compose Navigation.

---

## ✨ Features

*   **Serverless Architecture**: Direct device-to-YouTube connection. No backend infrastructure required.
*   **Smart Search**: Integrates `NewPipe Extractor` for efficient metadata parsing of search results.
*   **Gapless Playback**: Pre-caching and efficient buffer management.
*   **Offline-First Experience**: 
    *   Automatically caches played songs.
    *   "Favorites" and "Recents" available without internet.
*   **Dynamic UI**: 
    *   MiniPlayer overlay.
    *   Adaptive layouts (Column/Row flow based on content).
    *   Dark/Light mode support (System default).

---

## 📂 Project Structure

```
com.example.listenup
├── data             # Data Layer (Repositories, remote/local data sources)
│   ├── local        # Room DB, DAOs, Entities
│   ├── remote       # InnerTubeApi, Retrofit Clients
│   └── repository   # Implementation of Domain Repositories
├── domain           # Domain Layer (Business Rules)
│   ├── model        # Pure Data Classes
│   └── repository   # Interfaces
├── di               # Hilt Dependency Injection Modules
├── ui               # Presentation Layer
│   ├── components   # Reusable Compose Widgets (MiniPlayer, SongItem)
│   ├── home         # Home Screen & ViewModel
│   ├── player       # Player UI & Service Logic
│   └── theme        # Material3 Theme Definitions
└── ListenUpApp.kt   # Application Entry Point
```

---

## 🔧 Setup & Installation

This project is designed to be **plug-and-play**. No API keys or external accounts are needed to run the app.

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/ListenUp.git
    ```
2.  **Open in Android Studio**
    *   Required: Android Studio Koala Feature Drop or newer.
    *   JDK: Version 17+.
3.  **Build & Run**
    *   Select `app` configuration.
    *   Run on Emulator or Physical Device (Min SDK 24).

---

## � Future Improvements

*   **SponsorBlock Integration**: Auto-skip non-music segments (intros, outros).
*   **Lyrics Support**: Fetch synchronized lyrics from external provider.
*   **Playlist Management**: Create and manage local playlists.
*   **Audio Effect/Equalizer**: Integrate Android's Equalizer API.

---

##  ©️ Ownership & Credits

**This project was conceptualized, designed, and developed primarily by ZaheerChoudhari.**

All intellectual property rights and code ownership belong to **ZaheerChoudhari**. This is a testament to the dedication, engineering skills, and passion for building high-quality software.

---

> *"Code is poetry, and building something from scratch is the ultimate form of expression. I poured my heart into this project to create something truly special. Keep building, keep dreaming, and never stop learning! 💻❤️🚀✨"*
>
> — **With love, ZaheerChoudhari**

---

*This project was built to demonstrate advanced proficiency in Android Systems Design, Network Engineering, and Modern UI Development.*
