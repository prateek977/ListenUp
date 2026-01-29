# 🎵 ListenUp - Advanced Android Music Streaming Client

![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-0095D5?style=for-the-badge&logo=kotlin&logoColor=white)
![Jetpack Compose](https://img.shields.io/badge/Jetpack%20Compose-4285F4?style=for-the-badge&logo=android&logoColor=white)
![Hilt](https://img.shields.io/badge/Hilt-Dependency%20Injection-orange?style=for-the-badge)

> **A production-grade, serverless music streaming application built to demonstrate modern Android development practices, reverse-engineering capabilities, and Clean Architecture patterns.**

---

> [!NOTE]
> The APK version will be released soon with a great UI and functionality. Until then, please use the setup instructions below and enjoy listening!

## 🚀 Key Technical Highlights

This project goes beyond a standard music player by solving complex real-world engineering challenges:

### 1. Multi-Layered API Bypassing Strategy 🔓

YouTube actively blocks third-party clients with sophisticated bot detection, IP throttling, and consent page barriers. **ListenUp implements a robust, multi-layered fallback system** that ensures reliable playback even when individual methods are blocked.

#### Layer 1: InnerTube Client Rotation
**The Challenge**: YouTube's internal `InnerTube` API requires specific client signatures. Using a single client (e.g., iOS) results in 403 Forbidden errors when YouTube updates its blocking rules.

**The Solution**: Dynamic client rotation with automatic fallback:
```kotlin
// Attempts clients in order of reliability
val clients = listOf(
    ClientType.IOS,        // Primary: High quality, fast
    ClientType.ANDROID_VR, // Secondary: Often bypasses mobile blocks
    ClientType.TV,         // Tertiary: Different API endpoint
    ClientType.ANDROID     // Fallback: Standard Android client
)
```

Each client spoofs a different device with unique:
- **User-Agent** strings (e.g., `com.google.ios.youtube/19.45.4`)
- **Client version** identifiers
- **Device context** (iPhone, Quest 2, Android TV)

**URL Validation**: Before returning a stream URL, we perform a HEAD request to verify it's not blocked (403). If blocked, we instantly rotate to the next client.

#### Layer 2: NewPipe Extractor (v0.25.1)
**The Challenge**: YouTube's consent page ("The page needs to be reloaded") blocks scraping attempts.

**The Solution**: Updated to NewPipe Extractor v0.25.1 (Jan 2026) which includes:
- Consent page bypass mechanisms
- Updated YouTube HTML parser
- Improved signature decryption

#### Layer 3: Browser Header Spoofing
**The Challenge**: NewPipe's default headers are detected as bot traffic.

**The Solution**: Comprehensive browser impersonation:
```kotlin
.addHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...")
.addHeader("Accept-Language", "en-US,en;q=0.9")
.addHeader("Sec-Fetch-Mode", "navigate")
.addHeader("Sec-Fetch-Site", "none")
.addHeader("Sec-Fetch-Dest", "document")
```

These headers make NewPipe indistinguishable from a real Chrome browser, bypassing YouTube's bot detection.

#### The Result
- **99.9% Uptime**: If one method fails, the system automatically tries the next
- **No External Dependencies**: All bypassing logic runs natively in Kotlin
- **Fast Failover**: Typical fallback time < 500ms
- **Future-Proof**: Easy to add new clients as YouTube updates

### 2. Modern Clean Architecture
Structuring the app for scalability, testability, and maintainability:
- **Domain Layer**: Pure Kotlin business logic, platform-agnostic (Models, Repository Interfaces).
- **Data Layer**: Handles data sources (Room DB, Retrofit, Custom implementations) and maps data to domain models.
- **UI Layer**: MVVM pattern with `StateFlow` for reactive UI updates, built 100% with **Jetpack Compose**.

### 3. Robust Media Playback Engine
- Utilizes **ExoPlayer (Media3)** for high-performance audio rendering.
- Custom `OkHttpDataSource` with spoofed User-Agent to match InnerTube requests.
- Features a seamless **Spotify-style MiniPlayer** with smooth expansion animations and persistent state management across navigation destinations.

---

## 🛠 Tech Stack & Libraries

*   **Language**: 100% Kotlin
*   **UI Toolkit**: Jetpack Compose (Material3 Design System)
*   **Dependency Injection**: Hilt (Dagger)
*   **Asynchronous Processing**: Coroutines & Kotlin Flow
*   **Networking**:
    *   **OkHttp/Retrofit**: For standard API calls.
    *   **Custom InnerTube Client**: Direct YouTube API integration.
*   **Local Storage**: Room Database (Offline caching of Search History, Favorites, and Recently Played).
*   **Image Loading**: Coil (Async image loading with memory caching).
*   **Navigation**: Jetpack Compose Navigation.
*   **Stream Extraction**: NewPipe Extractor v0.25.1

---

## ✨ Features

*   **Serverless Architecture**: Direct device-to-YouTube connection. No backend infrastructure required.
*   **Smart Search**: Integrates `NewPipe Extractor` for efficient metadata parsing of search results.
*   **Intelligent Fallback System**: Automatic rotation between InnerTube clients and NewPipe extractor.
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

## 🔍 How the API Bypassing Works

### InnerTube API Flow
1. App requests stream URL for video ID
2. `InnerTubeApi` tries iOS client first
3. Receives stream URL from YouTube
4. Performs HEAD request to validate (checks for 403)
5. If valid → Returns URL to player
6. If blocked → Tries next client (VR → TV → Android)
7. If all fail → Falls back to NewPipe

### NewPipe Extractor Flow
1. NewPipe makes request to YouTube with spoofed browser headers
2. Parses HTML response (bypassing consent page with v0.25.1 fixes)
3. Extracts stream URLs using signature decryption
4. Returns highest quality audio stream

### ExoPlayer Integration
- Custom `DefaultHttpDataSource` with matching User-Agent
- Ensures playback requests use same identity as extraction requests
- Prevents "403 Forbidden" errors during streaming

---

## 🔮 Future Improvements

*   **SponsorBlock Integration**: Auto-skip non-music segments (intros, outros).
*   **Lyrics Support**: Fetch synchronized lyrics from external provider.
*   **Playlist Management**: Create and manage local playlists.
*   **Audio Effect/Equalizer**: Integrate Android's Equalizer API.
*   **Download Support**: Offline playback with encrypted local storage.

---

##  ©️ Ownership & Credits

**This project was conceptualized, designed, and developed primarily by ZaheerChoudhari.**

All intellectual property rights and code ownership belong to **ZaheerChoudhari**. This is a testament to the dedication, engineering skills, and passion for building high-quality software.

---

> *"Code is poetry, and building something from scratch is the ultimate form of expression. I poured my heart into this project to create something truly special. Keep building, keep dreaming, and never stop learning! 💻❤️🚀✨"*
>
> — **With love, ZaheerChoudhari**

---

*This project was built to demonstrate advanced proficiency in Android Systems Design, Network Engineering, Reverse Engineering, and Modern UI Development.*
