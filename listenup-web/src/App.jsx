import React, { useState, useEffect, useRef } from 'react';
import { CLIENT_ID, signInWithGoogleToken, fetchUserData, saveUserData } from './firebase-rest';

export default function App() {
  // Navigation & Search State
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Playback Queue State
  const [originalQueue, setOriginalQueue] = useState([]); // for restoring from shuffle
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [firebaseToken, setFirebaseToken] = useState(null);
  
  // Curated Categories State
  const [homeData, setHomeData] = useState({
    trending: [],
    bollywood: [],
    hollywood: [],
    lofi: [],
    pop: [],
    romantic: [],
    party: []
  });
  const [homeLoading, setHomeLoading] = useState(true);

  // Custom Playlists State
  const [playlists, setPlaylists] = useState(() => {
    const saved = localStorage.getItem('listenup_playlists');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activeDropdownSong, setActiveDropdownSong] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Playback State
  const [queue, setQueue] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('listenup_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [playlists, setPlaylists] = useState([]);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('listenup_volume');
    return saved ? parseInt(saved, 10) : 100;
  });

  // Player Stats
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [repeat, setRepeat] = useState('off'); // 'off' | 'all' | 'one'
  const [shuffle, setShuffle] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);

  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const createPlaylistDialogRef = useRef(null);
  const isLoadingSongRef = useRef(false);
  const stateRef = useRef({ currentSong, queue, repeat, isPlaying, shuffle });

  // Sync state ref for YouTube event listeners
  useEffect(() => {
    stateRef.current = { currentSong, queue, repeat, isPlaying, shuffle };
  }, [currentSong, queue, repeat, isPlaying, shuffle]);

  // Load favorites, volume, playlists and fetch home categories on mount
  useEffect(() => {
    // Initial fetch for playlists/queue happens via Google Login or localStorage
    const savedPlaylists = localStorage.getItem('listenup_playlists');
    if (savedPlaylists) {
      try { setPlaylists(JSON.parse(savedPlaylists)); } catch (e) { console.error(e); }
    }
    const savedQueue = localStorage.getItem('listenup_queue');
    if (savedQueue) {
      try { setQueue(JSON.parse(savedQueue)); } catch (e) { console.error(e); }
    }
    
    // Fetch home screen browse data
    fetchHomeData();

    // Load YouTube Iframe API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    // Initialize Google Identity Services
    const initGoogleSignIn = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleGoogleCredential
        });
        window.google.accounts.id.renderButton(
          document.getElementById("googleSignInBtn"),
          { theme: "filled_black", size: "large", width: "100%", shape: "pill" }
        );
      }
    };

    if (window.google) {
      initGoogleSignIn();
    } else {
      // If the script hasn't loaded yet, wait for it
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.addEventListener('load', initGoogleSignIn);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleGoogleCredential(response) {
    try {
      const fbData = await signInWithGoogleToken(response.credential);
      if (fbData) {
        setCurrentUser(fbData);
        setFirebaseToken(fbData.idToken);
        
        // Fetch their playlists and favorites
        const userData = await fetchUserData(fbData.localId, fbData.idToken);
        if (userData) {
          setPlaylists(userData.playlists || []);
          setQueue(userData.queue || []);
        }
      }
    } catch (e) {
      console.error("Google login failed", e);
      alert("Login failed: " + e.message);
    }
  }

  const handleSignOut = () => {
    setCurrentUser(null);
    setFirebaseToken(null);
    setPlaylists([]);
    setQueue([]);
    // Re-render the button since we cleared it
    setTimeout(() => {
      if (window.google) {
        window.google.accounts.id.renderButton(
          document.getElementById("googleSignInBtn"),
          { theme: "filled_black", size: "large", width: "100%", shape: "pill" }
        );
      }
    }, 100);
  };

  // Listen to document clicks to close playlist dropdowns on click-away
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeDropdownSong) {
        if (!e.target.closest('.playlist-dropdown-trigger') && !e.target.closest('.playlist-dropdown-menu')) {
          setActiveDropdownSong(null);
        }
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [activeDropdownSong]);

  // Handle Safari closedby backdrop fallback for `<dialog>`
  useEffect(() => {
    const dialog = createPlaylistDialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        dialog.close();
        setNewPlaylistName('');
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, []);

  // Persist playlists and queue to cloud if logged in, otherwise local
  useEffect(() => {
    if (currentUser && firebaseToken) {
      saveUserData(currentUser.localId, firebaseToken, playlists, queue);
    } else {
      localStorage.setItem('listenup_playlists', JSON.stringify(playlists));
      localStorage.setItem('listenup_queue', JSON.stringify(queue));
    }
  }, [playlists, queue, currentUser, firebaseToken]);

  async function fetchHomeData() {
    setHomeLoading(true);
    const categories = ['trending', 'bollywood', 'hollywood', 'lofi', 'pop', 'romantic', 'party'];
    try {
      const promises = categories.map(async (cat) => {
        const res = await fetch(`/api/browse?category=${cat}`);
        if (!res.ok) throw new Error(`Failed to fetch ${cat}`);
        const data = await res.json();
        return { cat, data };
      });
      const results = await Promise.allSettled(promises);
      const newData = {
        trending: [],
        bollywood: [],
        hollywood: [],
        lofi: [],
        pop: [],
        romantic: [],
        party: []
      };
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          newData[res.value.cat] = Array.isArray(res.value.data) ? res.value.data : [];
        }
      });
      setHomeData(newData);
    } catch (err) {
      console.error("Error loading home categories:", err);
    } finally {
      setHomeLoading(false);
    }
  };

  function initPlayer() {
    playerRef.current = new window.YT.Player('yt-player-iframe', {
      height: '100%',
      width: '100%',
      videoId: '',
      playerVars: {
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3
      },
      events: {
        onReady: (event) => {
          event.target.setVolume(volume);
          setIsPlayerReady(true);
        },
        onStateChange: (event) => {
          handlePlayerStateChange(event.data);
        }
      }
    });
  };

  const handlePlayerStateChange = (state) => {
    if (state === 1) { // PLAYING
      isLoadingSongRef.current = false;
      setIsPlaying(true);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime());
          setDuration(playerRef.current.getDuration() || 0);
        }
      }, 500);
    } else if (state === 2) { // PAUSED
      // Ignore transient PAUSED events fired by YouTube while loading a new video
      if (isLoadingSongRef.current) return;
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else if (state === 0) { // ENDED
      isLoadingSongRef.current = false;
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      
      const { repeat: currentRepeat } = stateRef.current;
      if (currentRepeat === 'one') {
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
        setIsPlaying(true);
      } else {
        playNext();
      }
    }
  };

  // Playback control effects
  useEffect(() => {
    if (currentSong && isPlayerReady && playerRef.current && playerRef.current.loadVideoById) {
      isLoadingSongRef.current = true;
      setCurrentTime(0);
      setDuration(0);
      playerRef.current.loadVideoById(currentSong.id);
      setIsPlaying(true);
      addToQueueSilent(currentSong);
    }
  }, [currentSong, isPlayerReady]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.playVideo && playerRef.current.pauseVideo) {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(isMuted ? 0 : volume);
      localStorage.setItem('listenup_volume', volume.toString());
    }
  }, [volume, isMuted]);

  // Queue Operations
  const playSong = (song) => {
    setCurrentSong(song);
    const index = queue.findIndex(s => s.id === song.id);
    if (index === -1) {
      const currentIdx = queue.findIndex(s => s.id === currentSong?.id);
      const newQueue = [...queue];
      if (currentIdx === -1) {
        newQueue.push(song);
      } else {
        newQueue.splice(currentIdx + 1, 0, song);
      }
      setQueue(newQueue);
    }
  };

  function addToQueueSilent(song) {
    setQueue(prev => {
      if (prev.some(s => s.id === song.id)) return prev;
      return [...prev, song];
    });
  };

  const appendToQueue = (song) => {
    setQueue(prev => {
      if (prev.some(s => s.id === song.id)) return prev;
      return [...prev, song];
    });
  };

  const removeFromQueue = (songId) => {
    setQueue(prev => prev.filter(s => s.id !== songId));
    if (currentSong?.id === songId) {
      playNext();
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentSong(null);
    setIsPlaying(false);
    if (playerRef.current && playerRef.current.stopVideo) {
      playerRef.current.stopVideo();
    }
  };

  const playNext = () => {
    const { queue: currentQueue, currentSong: activeSong, repeat: currentRepeat } = stateRef.current;
    if (currentQueue.length === 0) return;
    
    const currentIdx = currentQueue.findIndex(s => s.id === activeSong?.id);
    if (currentIdx === -1) {
      setCurrentSong(currentQueue[0]);
    } else if (currentIdx < currentQueue.length - 1) {
      setCurrentSong(currentQueue[currentIdx + 1]);
    } else {
      if (currentRepeat === 'all') {
        setCurrentSong(currentQueue[0]);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const playPrevious = () => {
    const { queue: currentQueue, currentSong: activeSong, repeat: currentRepeat } = stateRef.current;
    if (currentQueue.length === 0) return;

    const currentIdx = currentQueue.findIndex(s => s.id === activeSong?.id);
    if (currentIdx > 0) {
      setCurrentSong(currentQueue[currentIdx - 1]);
    } else if (currentIdx === 0 && currentRepeat === 'all') {
      setCurrentSong(currentQueue[currentQueue.length - 1]);
    } else {
      if (playerRef.current && playerRef.current.seekTo) {
        playerRef.current.seekTo(0);
        setCurrentTime(0);
      }
    }
  };

  const handleShuffleToggle = () => {
    if (!shuffle) {
      setOriginalQueue([...queue]);
      if (queue.length > 1) {
        const currentIdx = queue.findIndex(s => s.id === currentSong?.id);
        const remaining = queue.filter((_, i) => i !== currentIdx);
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        const newQueue = currentSong ? [currentSong, ...remaining] : remaining;
        setQueue(newQueue);
      }
      setShuffle(true);
    } else {
      if (originalQueue.length > 0) {
        setQueue(originalQueue);
      }
      setShuffle(false);
    }
  };

  const toggleRepeat = () => {
    setRepeat(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  // Favorites Operation
  const toggleFavorite = (song) => {
    let newFavs;
    if (favorites.some(s => s.id === song.id)) {
      newFavs = favorites.filter(s => s.id !== song.id);
    } else {
      newFavs = [...favorites, song];
    }
    setFavorites(newFavs);
    localStorage.setItem('listenup_favorites', JSON.stringify(newFavs));
  };

  // Playlists Operations
  const createPlaylist = (name) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const newPlaylist = {
      id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: cleanName,
      songs: []
    };
    setPlaylists(prev => [...prev, newPlaylist]);
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists(prev => prev.filter(pl => pl.id !== playlistId));
    if (activePlaylistId === playlistId) {
      setActivePlaylistId(null);
    }
  };

  const addSongToPlaylist = (playlistId, song) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      if (pl.songs.some(s => s.id === song.id)) return pl;
      return { ...pl, songs: [...pl.songs, song] };
    }));
    setActiveDropdownSong(null);
  };

  const removeSongFromPlaylist = (playlistId, songId) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      return { ...pl, songs: pl.songs.filter(s => s.id !== songId) };
    }));
  };

  const playPlaylist = (playlist) => {
    if (!playlist || playlist.songs.length === 0) return;
    setQueue(playlist.songs);
    if (shuffle) {
      setOriginalQueue(playlist.songs);
    }
    setCurrentSong(playlist.songs[0]);
    setIsPlaying(true);
  };

  const openCreatePlaylistModal = () => {
    if (createPlaylistDialogRef.current) {
      createPlaylistDialogRef.current.showModal();
    }
  };

  const closeCreatePlaylistModal = () => {
    if (createPlaylistDialogRef.current) {
      createPlaylistDialogRef.current.close();
      setNewPlaylistName('');
    }
  };

  const handleCreatePlaylistSubmit = (e) => {
    e.preventDefault();
    createPlaylist(newPlaylistName);
    closeCreatePlaylistModal();
  };

  // Search Action
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Seek bar action
  const handleSeekChange = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(seekTime);
    }
  };

  // Format MM:SS helper
  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Dropdown helper function for playlists
  const renderPlaylistDropdown = (song, direction = 'down') => {
    const isOpen = activeDropdownSong?.id === song.id;
    const isFav = favorites.some(s => s.id === song.id);
    return (
      <div className="flex items-center gap-2 relative">
        {currentUser && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(song);
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-pink-500 hover:bg-white/5 transition-colors"
            title={isFav ? "Remove from Favorites" : "Add to Favorites"}
          >
            {isFav ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-pink-500 animate-fade-in">
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            )}
          </button>
        )}
        
        {currentUser && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdownSong(isOpen ? null : song);
              }}
              className="playlist-dropdown-trigger p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors animate-fade-in"
              title="Add to Playlist"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            
            {isOpen && (
              <div className={`playlist-dropdown-menu absolute right-0 w-48 bg-[#141121] border border-slate-800/80 rounded-xl shadow-2xl z-50 py-1.5 text-left ${
                direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
              }`}>
                <div className="px-3 py-1 text-[10px] text-slate-500 uppercase tracking-widest font-bold border-b border-slate-800/50 mb-1">
                  Add to Playlist
                </div>
                {playlists.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">No playlists created</div>
                ) : (
                  <div className="max-h-40 overflow-y-auto">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          addSongToPlaylist(pl.id, song);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-purple-600/20 transition-colors truncate"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdownSong(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors border-t border-slate-800/50 mt-1"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-[#0b0813] text-slate-200 overflow-hidden relative font-sans">
      
      {/* Background Neon Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Left Sidebar */}
      <aside className="w-64 glass-panel border-r border-slate-800/40 flex flex-col z-20">
        {/* App Branding */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v13.5m0-13.5L9 12.5m0 0v6.75m0-6.75L3 15.75M9 19.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm10.5-3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              ListenUp
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Web Player</p>
          </div>
        </div>

        {/* User Account Section */}
        <div className="px-4 mb-4">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white uppercase">
                {currentUser.email ? currentUser.email[0] : 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{currentUser.email}</p>
                <button onClick={handleSignOut} className="text-[10px] text-slate-400 hover:text-white transition-colors">Sign Out</button>
              </div>
            </div>
          ) : (
            <div id="googleSignInBtn" className="w-full"></div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('home')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'home'
                ? 'bg-gradient-to-r from-purple-900/30 to-indigo-950/20 text-purple-400 border border-purple-800/30 shadow-md shadow-purple-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/3'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="font-semibold text-sm">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'search'
                ? 'bg-gradient-to-r from-purple-900/30 to-indigo-950/20 text-purple-400 border border-purple-800/30 shadow-md shadow-purple-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/3'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="font-semibold text-sm">Search Songs</span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'favorites'
                ? 'bg-gradient-to-r from-purple-900/30 to-indigo-950/20 text-purple-400 border border-purple-800/30 shadow-md shadow-purple-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/3'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span className="font-semibold text-sm">Favorites</span>
            {favorites.length > 0 && (
              <span className="ml-auto bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full font-bold border border-purple-500/30">
                {favorites.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('playlists');
              setActivePlaylistId(null);
            }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'playlists'
                ? 'bg-gradient-to-r from-purple-900/30 to-indigo-950/20 text-purple-400 border border-purple-800/30 shadow-md shadow-purple-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/3'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v11.25m0-11.25a9 9 0 1118 0v11.25m-18 0a9 9 0 0018 0M3.75 13.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <span className="font-semibold text-sm">Playlists</span>
            {playlists.length > 0 && (
              <span className="ml-auto bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full font-bold border border-purple-500/30">
                {playlists.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'queue'
                ? 'bg-gradient-to-r from-purple-900/30 to-indigo-950/20 text-purple-400 border border-purple-800/30 shadow-md shadow-purple-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/3'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <span className="font-semibold text-sm">Play Queue</span>
            {queue.length > 0 && (
              <span className="ml-auto bg-indigo-500/20 text-indigo-400 text-xs px-2 py-0.5 rounded-full font-bold border border-indigo-500/30">
                {queue.length}
              </span>
            )}
          </button>
        </nav>

        {/* Small Compliant YouTube Video Container in Sidebar Bottom */}
        <div className="p-4 border-t border-slate-800/30">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">
            YT Stream Feed
          </div>
          <div 
            className={`relative rounded-xl overflow-hidden bg-black/60 border border-slate-800/40 transition-all duration-300 ${
              isVideoExpanded ? 'aspect-video w-full' : 'w-24 h-[54px]'
            }`}
          >
            <div id="yt-player-iframe" className="w-full h-full"></div>
            {/* Overlay if not expanded to let users expand it */}
            {!isVideoExpanded && (
              <button 
                onClick={() => setIsVideoExpanded(true)}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                title="Expand video feed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
                </svg>
              </button>
            )}
            {/* Collapse toggle if expanded */}
            {isVideoExpanded && (
              <button 
                onClick={() => setIsVideoExpanded(false)}
                className="absolute top-2 right-2 p-1 rounded bg-black/80 hover:bg-black text-white transition-colors"
                title="Collapse video feed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3 3m12 6V4.5m0 4.5h4.5M15 9l6-6M9 15v4.5M9 15H4.5M9 15l-6 6m12-6v4.5m0-4.5h4.5m-4.5 0l6 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Dashboard Panels */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-28 px-8 py-6 z-10">
        
        {/* Active View: HOME */}
        {activeTab === 'home' && (
          <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full">
            {/* Header / Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-950/40 via-indigo-950/20 to-transparent p-8 border border-purple-900/10 shadow-2xl">
              <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-purple-500/5 to-transparent blur-3xl pointer-events-none"></div>
              <span className="text-[10px] bg-purple-500/25 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Welcome
              </span>
              <h2 className="text-4xl font-black text-white mt-4 tracking-tight leading-none bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Your Sound, Reimagined
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-md">
                Stream unlimited music, build custom libraries, and enjoy visual playback directly in your web player.
              </p>
            </div>

            {/* Curated Music Sections */}
            {homeLoading ? (
              <div className="space-y-8">
                {['🔥 Top Trending', '🇮🇳 Bollywood Hits', '🇬🇧 Hollywood Pop'].map((title) => (
                  <div key={title} className="space-y-4">
                    <div className="h-6 w-40 bg-slate-800/40 animate-pulse rounded-md"></div>
                    <div className="flex gap-4 overflow-x-hidden">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="w-40 h-56 bg-slate-900/30 border border-slate-800/20 animate-pulse rounded-2xl flex-shrink-0"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(homeData).map(([key, songs]) => {
                  if (songs.length === 0) return null;
                  
                  const friendlyNames = {
                    trending: "🔥 Top Trending",
                    bollywood: "🇮🇳 Bollywood Hits",
                    hollywood: "🇬🇧 Hollywood Pop",
                    lofi: "☕ Lofi & Chill",
                    pop: "🎵 Global Pop Hits",
                    romantic: "💖 Romantic Melodies",
                    party: "🕺 Party Dance Mix"
                  };
                  
                  return (
                    <div key={key} className="space-y-3.5">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-extrabold text-white tracking-tight">{friendlyNames[key] || key}</h3>
                      </div>
                      
                      <div className="flex overflow-x-auto gap-4 pb-4 scroll-smooth scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        {songs.map((song) => (
                          <div 
                            key={song.id} 
                            className="w-40 flex-shrink-0 relative group p-3 rounded-2xl glass-card border border-white/5 bg-white/2 hover:bg-white/5 transition-all flex flex-col"
                          >
                            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800/50">
                              <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => playSong(song)}
                                  className="w-11 h-11 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 hover:bg-purple-500 active:scale-95 transition-all"
                                  title="Play"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 translate-x-0.5">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-3 flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-400 transition-colors" title={song.title}>
                                {song.title}
                              </h4>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5" title={song.artist}>
                                {song.artist}
                              </p>
                            </div>

                            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/5">
                              <button
                                onClick={() => toggleFavorite(song)}
                                className={`p-1 rounded hover:bg-white/5 transition-colors ${
                                  favorites.some(s => s.id === song.id) ? 'text-pink-500' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill={favorites.some(s => s.id === song.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                </svg>
                              </button>

                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => appendToQueue(song)}
                                  className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                                  title="Add to Queue"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                  </svg>
                                </button>
                                
                                {renderPlaylistDropdown(song, 'up')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Active View: SEARCH */}
        {activeTab === 'search' && (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <div>
              <h2 className="text-3xl font-extrabold text-white text-glow-purple">Discover Music</h2>
              <p className="text-slate-400 text-sm mt-1">Search, play, and cache songs directly from the cloud.</p>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search songs, artists, Lofi mixes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full glass-input px-5 py-4 pl-12 rounded-2xl text-slate-100 placeholder-slate-500 shadow-inner"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <button
                type="submit"
                disabled={searchLoading}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-8 rounded-2xl shadow-lg shadow-purple-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {searchResults.length > 0 ? 'Search Results' : 'Search Database'}
              </h3>
              
              {searchLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-sm">Parsing YouTube stream feeds...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-20 bg-white/2 rounded-2xl border border-slate-800/20">
                  <p className="text-slate-400 text-sm">Enter a search query to search millions of songs instantly.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {searchResults.map((song) => (
                    <div 
                      key={song.id} 
                      className={`glass-card p-3 rounded-2xl flex items-center gap-4 group ${
                        currentSong?.id === song.id ? 'border-purple-500/30 bg-purple-950/10' : ''
                      }`}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0 bg-slate-900 border border-slate-800/50">
                        <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => playSong(song)}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6 text-white">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{formatTime(song.duration)}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleFavorite(song)}
                          className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                            favorites.some(s => s.id === song.id) ? 'text-pink-500' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title={favorites.some(s => s.id === song.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill={favorites.some(s => s.id === song.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => appendToQueue(song)}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                          title="Add to Queue"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </button>
                        
                        {renderPlaylistDropdown(song, 'down')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active View: FAVORITES */}
        {activeTab === 'favorites' && (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <div>
              <h2 className="text-3xl font-extrabold text-white text-glow-purple">Your Favorites</h2>
              <p className="text-slate-400 text-sm mt-1">Tracks saved in your local browser library.</p>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-20 bg-white/2 rounded-2xl border border-slate-800/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-slate-500 mx-auto mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <h4 className="text-white font-bold mb-1">No favorited tracks</h4>
                <p className="text-slate-400 text-sm">Browse songs in the Search menu and hit the heart icon to save songs.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {favorites.map((song) => (
                  <div 
                    key={song.id} 
                    className={`glass-card p-3 rounded-2xl flex items-center gap-4 group ${
                      currentSong?.id === song.id ? 'border-purple-500/30 bg-purple-950/10' : ''
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0 bg-slate-900 border border-slate-800/50">
                      <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => playSong(song)}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6 text-white">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{formatTime(song.duration)}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleFavorite(song)}
                        className="p-2 rounded-lg text-pink-500 hover:bg-white/5 transition-colors"
                        title="Remove from Favorites"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => appendToQueue(song)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                        title="Add to Queue"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </button>
                      
                      {renderPlaylistDropdown(song, 'down')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active View: PLAYLISTS */}
        {activeTab === 'playlists' && (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            {activePlaylistId === null ? (
              <>
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-extrabold text-white text-glow-purple">Playlists</h2>
                    <p className="text-slate-400 text-sm mt-1">Create and manage your custom music collections.</p>
                  </div>
                  {currentUser && (
                    <button
                      onClick={openCreatePlaylistModal}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-600/20 active:scale-[0.98] transition-all text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Create Playlist
                    </button>
                  )}
                </div>

                {!currentUser ? (
                  <div className="text-center py-20 bg-white/2 rounded-2xl border border-slate-800/20">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 text-purple-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <h4 className="text-white font-bold mb-1">Sign in required</h4>
                    <p className="text-slate-400 text-sm max-w-sm mx-auto">Please sign in with your Google account from the sidebar to create playlists and save your favorite songs.</p>
                  </div>
                ) : playlists.length === 0 ? (
                  <div className="text-center py-20 bg-white/2 rounded-2xl border border-slate-800/20">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-slate-500 mx-auto mb-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v11.25m0-11.25a9 9 0 1118 0v11.25m-18 0a9 9 0 0018 0M3.75 13.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    <h4 className="text-white font-bold mb-1">No playlists yet</h4>
                    <p className="text-slate-400 text-sm">Create your first playlist and start adding songs from Search or Home.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
                    {playlists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => setActivePlaylistId(pl.id)}
                        className="glass-card p-4 rounded-3xl cursor-pointer group hover:border-purple-500/20 relative"
                      >
                        <div className="aspect-square rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-950/40 border border-slate-800/40 flex flex-col items-center justify-center relative mb-4 shadow-inner overflow-hidden">
                          {pl.songs.length > 0 ? (
                            <div className="w-full h-full relative">
                              <img src={pl.songs[0].thumbnailUrl} alt={pl.name} className="w-full h-full object-cover opacity-80" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            </div>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-purple-400/50">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.884 2.223v6c0 1.243 1.007 2.25 2.25 2.25h16.5a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-1.884-2.223m-16.5 0V6.002a2.25 2.25 0 012.25-2.25h5.378a2.25 2.25 0 011.59.659l2.122 2.121c.14.14.33.22.53.22h5.13a2.25 2.25 0 012.25 2.25v1.774" />
                            </svg>
                          )}
                          
                          {pl.songs.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playPlaylist(pl);
                              }}
                              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-lg active:scale-95 transform translate-y-2 group-hover:translate-y-0 transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5 translate-x-0.5">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-white truncate">{pl.name}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">{pl.songs.length} {pl.songs.length === 1 ? 'song' : 'songs'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              (() => {
                const currentPl = playlists.find(pl => pl.id === activePlaylistId);
                if (!currentPl) {
                  setActivePlaylistId(null);
                  return null;
                }
                return (
                  <div className="flex flex-col gap-6 animate-fade-in">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setActivePlaylistId(null)}
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Back to Playlists
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete the playlist "${currentPl.name}"?`)) {
                            deletePlaylist(currentPl.id);
                          }
                        }}
                        className="px-3.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all"
                      >
                        Delete Playlist
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-end bg-gradient-to-b from-purple-950/20 to-indigo-950/10 border border-purple-900/20 p-6 rounded-3xl">
                      <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-900/30 to-indigo-950/30 border border-slate-800 flex items-center justify-center shadow-md overflow-hidden relative">
                        {currentPl.songs.length > 0 ? (
                          <img src={currentPl.songs[0].thumbnailUrl} alt={currentPl.name} className="w-full h-full object-cover" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-purple-400/50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.884 2.223v6c0 1.243 1.007 2.25 2.25 2.25h16.5a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-1.884-2.223m-16.5 0V6.002a2.25 2.25 0 012.25-2.25h5.378a2.25 2.25 0 011.59.659l2.122 2.121c.14.14.33.22.53.22h5.13a2.25 2.25 0 012.25 2.25v1.774" />
                          </svg>
                        )}
                      </div>
                      <div className="text-center sm:text-left flex-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Playlist</span>
                        <h2 className="text-3xl font-black text-white mt-1 leading-none">{currentPl.name}</h2>
                        <div className="flex items-center gap-3 justify-center sm:justify-start text-xs text-slate-400 mt-3 font-medium">
                          <span>{currentPl.songs.length} {currentPl.songs.length === 1 ? 'song' : 'songs'}</span>
                          {currentPl.songs.length > 0 && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                              <button
                                onClick={() => playPlaylist(currentPl)}
                                className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                                Play All
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      {currentPl.songs.length === 0 ? (
                        <div className="text-center py-20 bg-white/2 rounded-2xl border border-slate-800/20">
                          <p className="text-slate-400 text-sm">This playlist is empty. Find songs in Search or Home and add them!</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {currentPl.songs.map((song, index) => {
                            const isPlayingCurrent = currentSong?.id === song.id;
                            return (
                              <div
                                key={`${song.id}-${index}`}
                                className={`flex items-center gap-4 p-3 rounded-2xl glass-card relative group ${
                                  isPlayingCurrent ? 'border-purple-500/20 bg-purple-950/5' : ''
                                }`}
                              >
                                <span className="text-xs text-slate-500 font-bold w-4 text-center">
                                  {index + 1}
                                </span>

                                <div className="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0 bg-slate-900">
                                  <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => playSong(song)}
                                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </button>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-sm font-semibold truncate ${isPlayingCurrent ? 'text-purple-400' : 'text-white'}`}>
                                    {song.title}
                                  </h4>
                                  <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                                </div>

                                <span className="text-xs text-slate-500 font-medium mr-2">
                                  {formatTime(song.duration)}
                                </span>

                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => appendToQueue(song)}
                                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                                    title="Add to Queue"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => removeSongFromPlaylist(currentPl.id, song.id)}
                                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Remove from Playlist"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4.5 h-4.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Active View: QUEUE */}
        {activeTab === 'queue' && (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold text-white text-glow-purple">Play Queue</h2>
                <p className="text-slate-400 text-sm mt-1">Manage tracks queued up for sequential playback.</p>
              </div>
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="px-4 py-2 text-xs font-semibold bg-red-950/20 text-red-400 hover:bg-red-900/20 border border-red-950/50 rounded-xl transition-all active:scale-[0.98]"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {/* Currently Playing Card inside Queue */}
            {currentSong && (
              <div className="bg-gradient-to-r from-purple-950/25 to-indigo-950/15 border border-purple-900/30 p-5 rounded-3xl flex items-center gap-5 relative">
                <div className="absolute top-4 right-5 flex items-center gap-0.5">
                  {isPlaying ? (
                    <>
                      <div className="eq-bar"></div>
                      <div className="eq-bar"></div>
                      <div className="eq-bar"></div>
                      <div className="eq-bar"></div>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Paused</span>
                  )}
                </div>

                <div className="w-20 h-20 rounded-2xl overflow-hidden relative flex-shrink-0 bg-slate-900 shadow-md">
                  <img src={currentSong.thumbnailUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                </div>
                
                <div className="min-w-0">
                  <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Now Playing
                  </span>
                  <h3 className="text-lg font-bold text-white truncate mt-2">{currentSong.title}</h3>
                  <p className="text-sm text-slate-400 truncate mt-0.5">{currentSong.artist}</p>
                </div>
              </div>
            )}

            {/* Queue List */}
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide mb-3">Up Next</h3>
              {queue.length === 0 ? (
                <div className="text-center py-20 bg-white/2 rounded-2xl border border-slate-800/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-slate-500 mx-auto mb-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                  <h4 className="text-white font-bold mb-1">Queue is empty</h4>
                  <p className="text-slate-400 text-sm">Songs you play or add will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((song, index) => {
                    const isPlayingCurrent = currentSong?.id === song.id;
                    return (
                      <div 
                        key={`${song.id}-${index}`}
                        className={`flex items-center gap-4 p-3 rounded-2xl glass-card relative group ${
                          isPlayingCurrent ? 'border-purple-500/20 bg-purple-950/5' : ''
                        }`}
                      >
                        <span className="text-xs text-slate-500 font-bold w-4 text-center">
                          {index + 1}
                        </span>

                        <div className="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0 bg-slate-900">
                          <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setCurrentSong(song)}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-semibold truncate ${isPlayingCurrent ? 'text-purple-400' : 'text-white'}`}>
                            {song.title}
                          </h4>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                        </div>

                        <span className="text-xs text-slate-500 font-medium">
                          {formatTime(song.duration)}
                        </span>

                        <button
                          onClick={() => removeFromQueue(song.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove from Queue"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Media Control Bar */}
      <footer className="h-24 w-full glass-panel border-t border-slate-800/40 absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between px-6">
        
        {/* Left: Active Song details */}
        <div className="w-1/4 flex items-center gap-3">
          {currentSong ? (
            <>
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-800/50 shadow flex-shrink-0">
                <img src={currentSong.thumbnailUrl} alt={currentSong.title} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate max-w-[200px]">
                  {currentSong.title}
                </h4>
                <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">
                  {currentSong.artist}
                </p>
              </div>
              <button
                onClick={() => toggleFavorite(currentSong)}
                className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ml-2 ${
                  favorites.some(s => s.id === currentSong.id) ? 'text-pink-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill={favorites.some(s => s.id === currentSong.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-white/2 border border-dashed border-slate-800 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v13.5m0-13.5L9 12.5m0 0v6.75m0-6.75L3 15.75M9 19.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm10.5-3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-500">No Song Loaded</h4>
                <p className="text-xs text-slate-600">Play a track to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Playback Controls & Progress Bar */}
        <div className="w-2/5 flex flex-col items-center gap-1.5">
          {/* Controls buttons */}
          <div className="flex items-center gap-5">
            {/* Shuffle button */}
            <button
              onClick={handleShuffleToggle}
              className={`transition-colors p-1.5 rounded ${
                shuffle ? 'text-purple-400 text-glow-purple' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Shuffle"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
              </svg>
            </button>

            {/* Previous button */}
            <button
              onClick={playPrevious}
              disabled={queue.length === 0}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!currentSong || !isPlayerReady}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none hover:bg-slate-100"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Next button */}
            <button
              onClick={playNext}
              disabled={queue.length === 0}
              className="text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            {/* Repeat button */}
            <button
              onClick={toggleRepeat}
              className={`transition-colors p-1.5 rounded relative ${
                repeat !== 'off' ? 'text-purple-400 text-glow-purple' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={`Repeat: ${repeat}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {repeat === 'one' && (
                <span className="absolute bottom-[1px] right-[1px] text-[7px] font-extrabold bg-purple-500 text-white rounded-full w-2.5 h-2.5 flex items-center justify-center border border-[#0b0813]">
                  1
                </span>
              )}
            </button>
          </div>

          {/* Seek Slider bar */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-bold tracking-wider w-8 text-right select-none">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeekChange}
              disabled={!currentSong || !isPlayerReady}
              className="flex-1 accent-purple-500 h-1 rounded-lg bg-slate-800/80 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <span className="text-[10px] text-slate-500 font-bold tracking-wider w-8 select-none">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume & Extra Controls */}
        <div className="w-1/4 flex items-center justify-end gap-3.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6L4.5 9H1.5v6h3l4.5 3.75V5.25z" />
                </svg>
              ) : volume < 40 ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              )}
            </button>

            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseInt(e.target.value, 10));
                setIsMuted(false);
              }}
              className="w-20 accent-purple-500 h-1 rounded bg-slate-800 cursor-pointer"
            />
          </div>

          {/* Toggle expands video size button */}
          <button
            onClick={() => setIsVideoExpanded(!isVideoExpanded)}
            className={`p-2 rounded-lg hover:bg-white/5 transition-colors border ${
              isVideoExpanded ? 'text-purple-400 border-purple-800/30' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
            title={isVideoExpanded ? 'Collapse Video Feed' : 'Expand Video Feed'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
          </button>
        </div>

      </footer>

      {/* Native Playlist Creation Modal Dialog */}
      <dialog
        ref={createPlaylistDialogRef}
        className="dialog-reset rounded-3xl p-6 bg-[#161224] border border-purple-950/40 text-slate-200 w-80 shadow-2xl relative select-text"
        closedby="any"
      >
        <form onSubmit={handleCreatePlaylistSubmit} className="flex flex-col gap-4">
          <h3 className="text-lg font-bold text-white">Create Playlist</h3>
          <p className="text-xs text-slate-400">Enter a name for your custom music collection.</p>
          <input
            type="text"
            required
            placeholder="e.g. Chill Beats, Gym Hits"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 text-sm"
          />
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button"
              onClick={closeCreatePlaylistModal}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
