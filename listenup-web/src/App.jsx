import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
import { Capacitor } from '@capacitor/core';

export default function App() {
  // Navigation & Search State
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Playback Queue State
  const [originalQueue, setOriginalQueue] = useState([]); // for restoring from shuffle
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
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
  const [contextMenu, setContextMenu] = useState({ isOpen: false, song: null });
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Playback State
  const [queue, setQueue] = useState([]);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('listenup_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  // Music Rooms State
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [roomActivity, setRoomActivity] = useState([]);
  const [roomCode, setRoomCode] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [roomVisibility, setRoomVisibility] = useState('public');
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem('listenup_display_name') || 'Listener-' + Math.floor(Math.random() * 9000 + 1000);
  });
  const [publicRooms, setPublicRooms] = useState([]);
  const [roomError, setRoomError] = useState('');
  const [roomCreated, setRoomCreated] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingSongRequests, setPendingSongRequests] = useState([]);
  const socketRef = useRef(null);

  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const createPlaylistDialogRef = useRef(null);
  const isLoadingSongRef = useRef(false);
  const silentAudioRef = useRef(null);
  const stateRef = useRef({ currentSong, queue, repeat, isPlaying, shuffle, activeRoom, isHost });

  // Sync state ref for YouTube event listeners
  useEffect(() => {
    stateRef.current = { currentSong, queue, repeat, isPlaying, shuffle, activeRoom, isHost };
  }, [currentSong, queue, repeat, isPlaying, shuffle, activeRoom, isHost]);

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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  // Persist playlists and queue to local
  useEffect(() => {
    localStorage.setItem('listenup_playlists', JSON.stringify(playlists));
    localStorage.setItem('listenup_queue', JSON.stringify(queue));
  }, [playlists, queue]);
  // Socket.IO connection for Music Rooms
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(backendUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connected', (data) => {
      console.log('Socket connected:', data.sid);
    });

    socket.on('room_created', (room) => {
      setActiveRoom(room);
      setRoomCode(room.code);
      setRoomParticipants(room.participants || []);
      setIsHost(true);
      setRoomCreated(true);
      setRoomError('');
    });

    socket.on('room_joined', (room) => {
      setActiveRoom(room);
      setRoomCode(room.code);
      setRoomParticipants(room.participants || []);
      setIsHost(false);
      setRoomCreated(false);
      setRoomError('');
      // If host is playing a song, sync to it
      if (room.currentSong) {
        setCurrentSong(room.currentSong);
        if (room.isPlaying && playerRef.current && playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById(room.currentSong.id, room.currentTime || 0);
          setIsPlaying(true);
        }
      }
    });

    socket.on('room_update', (room) => {
      setActiveRoom(room);
      setRoomParticipants(room.participants || []);
    });

    socket.on('room_left', () => {
      setActiveRoom(null);
      setRoomCode('');
      setRoomParticipants([]);
      setRoomActivity([]);
      setIsHost(false);
      setRoomCreated(false);
    });

    socket.on('room_error', (data) => {
      setRoomError(data.message);
    });

    socket.on('activity', (data) => {
      setRoomActivity(prev => [...prev.slice(-49), data]);
    });

    socket.on('playback_update', (data) => {
      // Listeners receive playback state from host
      if (data.currentSong) {
        const currentId = stateRef.current.currentSong?.id;
        if (currentId !== data.currentSong.id) {
          // New song — load it at the host's current time
          setCurrentSong(data.currentSong);
          if (playerRef.current) {
            isLoadingSongRef.current = true;
            if (data.isPlaying) {
              playerRef.current.loadVideoById?.(data.currentSong.id, data.currentTime || 0);
            } else {
              playerRef.current.cueVideoById?.(data.currentSong.id, data.currentTime || 0);
            }
          }
        } else if (Math.abs((playerRef.current?.getCurrentTime?.() || 0) - (data.currentTime || 0)) > 4) {
          // Same song but time drifted — seek to sync
          playerRef.current?.seekTo?.(data.currentTime, true);
        }
      }
      // Force play/pause state to match the host
      if (data.isPlaying) {
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
      } else {
        playerRef.current?.pauseVideo?.();
        setIsPlaying(false);
      }
    });

    socket.on('load_song', (data) => {
      if (data.song) {
        setCurrentSong(data.song);
        setIsBuffering(true);
        if (playerRef.current) {
          playerRef.current.cueVideoById?.(data.song.id);
        }
      }
    });

    socket.on('start_playback', (data) => {
      if (playerRef.current) {
        playerRef.current.playVideo?.();
        if (data.currentTime !== undefined) {
          playerRef.current.seekTo?.(data.currentTime, true);
        }
        setIsPlaying(true);
        setIsBuffering(false);
      }
    });

    // Host receives song requests from listeners — show as notification
    socket.on('song_requested', (data) => {
      if (data.song) {
        setPendingSongRequests(prev => [...prev, {
          id: Date.now() + Math.random(),
          song: data.song,
          requestedBy: data.requestedBy || 'Someone'
        }]);
      }
    });

    // Host receives play/pause requests from listeners
    socket.on('playback_requested', (data) => {
      setIsPlaying(data.isPlaying);
    });

    return () => socket.disconnect();
  }, []);

  // Sync playback to room when host changes song or play state
  useEffect(() => {
    if (isHost && activeRoom && socketRef.current) {
      socketRef.current.emit('sync_playback', {
        currentSong,
        isPlaying,
        currentTime: playerRef.current?.getCurrentTime?.() || 0
      });
    }
  }, [currentSong, isPlaying, isHost, activeRoom]);

  // Periodic time sync from host (every 3 seconds) to keep listeners in lockstep
  useEffect(() => {
    if (!isHost || !activeRoom || !socketRef.current) return;
    const interval = setInterval(() => {
      const state = stateRef.current;
      if (state.currentSong && state.isPlaying) {
        socketRef.current?.emit('sync_playback', {
          currentSong: state.currentSong,
          isPlaying: state.isPlaying,
          currentTime: playerRef.current?.getCurrentTime?.() || 0
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isHost, activeRoom]);

  // Fetch public rooms when entering the rooms tab
  useEffect(() => {
    if (activeTab === 'rooms' && !activeRoom) {
      fetch(import.meta.env.VITE_API_URL + '/api/rooms').then(r => r.json()).then(data => setPublicRooms(data)).catch(() => {});
    }
  }, [activeTab, activeRoom]);

  // Save display name
  useEffect(() => {
    localStorage.setItem('listenup_display_name', displayName);
  }, [displayName]);

  // Auto-join room from URL (e.g. /room/MZK-4839)
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/room\/([A-Z0-9-]+)$/i);
    if (match && socketRef.current) {
      const code = match[1].toUpperCase();
      setActiveTab('rooms');
      setJoinRoomCode(code);
      // Wait a moment for the socket to be fully connected
      const timer = setTimeout(() => {
        socketRef.current?.emit('join_room_request', { roomCode: code, displayName });
      }, 1000);
      // Clean up URL
      window.history.replaceState({}, '', '/');
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    socketRef.current?.emit('create_room', {
      roomName: newRoomName.trim(),
      visibility: roomVisibility,
      displayName
    });
  };

  const handleJoinRoom = () => {
    if (!joinRoomCode.trim()) return;
    socketRef.current?.emit('join_room_request', {
      roomCode: joinRoomCode.trim().toUpperCase(),
      displayName
    });
  };

  const handleLeaveRoom = () => {
    socketRef.current?.emit('leave_room_request', { roomCode });
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'code') { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }
    if (type === 'link') { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
  };

  const handleAcceptSongRequest = (request) => {
    setCurrentSong(request.song);
    setQueue(prev => {
      if (prev.some(s => s.id === request.song.id)) return prev;
      return [...prev, request.song];
    });
    setPendingSongRequests(prev => prev.filter(r => r.id !== request.id));
  };

  const handleDeclineSongRequest = (request) => {
    setPendingSongRequests(prev => prev.filter(r => r.id !== request.id));
  };


  async function fetchHomeData() {
    setHomeLoading(true);
    const categories = ['trending', 'bollywood', 'hollywood', 'lofi', 'pop', 'romantic', 'party'];
    try {
      const promises = categories.map(async (cat) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/browse?category=${cat}`);
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
    // For non-host listeners in a room, only update the time display
    // Play/pause state is controlled entirely by the host sync
    const inRoomAsListener = stateRef.current.activeRoom && !stateRef.current.isHost;

    if (state === 1) { // PLAYING
      isLoadingSongRef.current = false;
      setIsBuffering(false);
      if (!inRoomAsListener) {
        setIsPlaying(true);
      }
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
      // If listener in room, don't set pause — host controls playback
      if (inRoomAsListener) return;
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else if (state === 0) { // ENDED
      isLoadingSongRef.current = false;
      // If listener in room, let host handle next song
      if (inRoomAsListener) return;
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
    } else if (state === 3) { // BUFFERING
      setIsBuffering(true);
    } else if (state === 5) { // CUED
      if (stateRef.current.activeRoom && socketRef.current) {
        socketRef.current.emit('player_ready');
      }
    }
  };

  // Playback control effects
  useEffect(() => {
    const inRoomAsListener = activeRoom && !isHost;
    // If listener in room, do NOT auto-play here — playback_update socket event handles this
    if (inRoomAsListener) return;

    if (currentSong && isPlayerReady && playerRef.current && playerRef.current.loadVideoById) {
      isLoadingSongRef.current = true;
      setIsBuffering(true);
      setCurrentTime(0);
      setDuration(0);
      
      if (isHost && activeRoom) {
        // Host in a room: tell server to orchestrate playback sync
        if (socketRef.current) {
          socketRef.current.emit('prepare_song', { song: currentSong });
        }
      } else {
        // Normal solo playback
        playerRef.current.loadVideoById(currentSong.id);
        setIsPlaying(true);
      }
      addToQueueSilent(currentSong);
    }
  }, [currentSong, isPlayerReady, activeRoom, isHost]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.playVideo && playerRef.current.pauseVideo) {
      if (isPlaying) {
        playerRef.current.playVideo();
        silentAudioRef.current?.play().catch(e => console.log('Silent audio play failed', e));
      } else {
        playerRef.current.pauseVideo();
        silentAudioRef.current?.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(isMuted ? 0 : volume);
      localStorage.setItem('listenup_volume', volume.toString());
    }
  }, [volume, isMuted]);

  // --- Media Session API Integration ---
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist || 'Unknown Artist',
        artwork: [
          { src: currentSong.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          playPrevious();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          playNext();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (playerRef.current && playerRef.current.seekTo) {
            playerRef.current.seekTo(details.seekTime, true);
          }
        });
      } catch (error) {
        console.log("Media session actions not supported", error);
      }
    }
  }, [currentSong]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);
  // --- Android Background Fixes ---
  useEffect(() => {
    // 1. Audio Priming (Unlocking)
    const unlockAudio = () => {
      if (silentAudioRef.current) {
        silentAudioRef.current.play().then(() => {
          silentAudioRef.current.pause();
          document.removeEventListener('click', unlockAudio);
          document.removeEventListener('touchstart', unlockAudio);
        }).catch(() => {});
      }
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    // 2. Visibility Change Override
    const handleVisibilityChange = () => {
      if (document.hidden && stateRef.current.isPlaying) {
        // Force YouTube to keep playing or play again immediately if Android paused it
        if (playerRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  // --------------------------------

  // Queue Operations
  const playSong = (song) => {
    // If in a room and NOT the host, send request to host instead of playing locally
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost && socketRef.current) {
      socketRef.current.emit('request_song', { song, displayName });
      return;
    }
    setCurrentSong(song);
    setIsBuffering(true);
    
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

  // Play a song from a list/section and queue all remaining songs as "Up Next"
  const playSongFromList = (song, allSongs) => {
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost && socketRef.current) {
      socketRef.current.emit('request_song', { song, displayName });
      return;
    }
    const songIdx = allSongs.findIndex(s => s.id === song.id);
    // Build queue: all songs starting from the tapped one
    const newQueue = songIdx !== -1 ? allSongs.slice(songIdx) : [song, ...allSongs.filter(s => s.id !== song.id)];
    setQueue(newQueue);
    setCurrentSong(song);
    setIsBuffering(true);
  };

  function addToQueueSilent(song) {
    setQueue(prev => {
      // Only add to queue if it's not already in there (e.g. from a direct search play)
      // We don't want to keep appending the current song to the end every time it plays!
      if (prev.some(s => s.id === song.id)) return prev;
      return [...prev, song];
    });
  };

  const appendToQueue = (song) => {
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost) return;

    setQueue(prev => [...prev, song]);
  };

  const removeFromQueue = (songId) => {
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost) return;

    setQueue(prev => prev.filter(s => s.id !== songId));
    if (currentSong?.id === songId) {
      playNext();
    }
  };

  const clearQueue = () => {
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost) return;
    
    setQueue([]);
    setCurrentSong(null);
    setIsPlaying(false);
    if (playerRef.current && playerRef.current.stopVideo) {
      playerRef.current.stopVideo();
    }
  };

  const playNext = () => {
    const { queue: currentQueue, currentSong: activeSong, repeat: currentRepeat, activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentQueue.length === 0) return;
    
    // Listeners should request to play next
    if (currentRoom && !currentIsHost) {
      // Find the next song they want to request
      const currentIdx = currentQueue.findIndex(s => s.id === activeSong?.id);
      if (currentIdx !== -1 && currentIdx < currentQueue.length - 1) {
        playSong(currentQueue[currentIdx + 1]);
      }
      return;
    }

    const currentIdx = currentQueue.findIndex(s => s.id === activeSong?.id);
    if (currentIdx === -1) {
      playSong(currentQueue[0]);
    } else if (currentIdx < currentQueue.length - 1) {
      playSong(currentQueue[currentIdx + 1]);
    } else {
      if (currentRepeat === 'all') {
        playSong(currentQueue[0]);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const playPrevious = () => {
    const { queue: currentQueue, currentSong: activeSong, activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentQueue.length === 0) return;

    if (currentRoom && !currentIsHost) {
      const currentIdx = currentQueue.findIndex(s => s.id === activeSong?.id);
      if (currentIdx > 0) {
        playSong(currentQueue[currentIdx - 1]);
      }
      return;
    }

    if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getCurrentTime() > 3) {
      playerRef.current.seekTo(0);
      setCurrentTime(0);
      return;
    }

    const currentIdx = currentQueue.findIndex(s => s.id === activeSong?.id);
    if (currentIdx > 0) {
      playSong(currentQueue[currentIdx - 1]);
    } else if (currentIdx === 0 && repeat === 'all') {
      playSong(currentQueue[currentQueue.length - 1]);
    }
  };

  const handleShuffleToggle = () => {
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost) return;

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
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost) return;

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
  };

  const removeSongFromPlaylist = (playlistId, songId) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      return { ...pl, songs: pl.songs.filter(s => s.id !== songId) };
    }));
  };

  const playPlaylist = (playlist) => {
    if (!playlist || playlist.songs.length === 0) return;
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    
    // If listener in room, just request the first song (or we could block it)
    if (currentRoom && !currentIsHost && socketRef.current) {
      socketRef.current.emit('request_song', { song: playlist.songs[0], displayName });
      return;
    }

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


  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/search?q=${encodeURIComponent(searchQuery)}`);
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
    const { activeRoom: currentRoom, isHost: currentIsHost } = stateRef.current;
    if (currentRoom && !currentIsHost) return; // Listeners cannot seek
    
    const newTime = parseFloat(e.target.value);
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(newTime, true);
    }
  };

  // Format MM:SS helper
  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex h-[100dvh] w-screen bg-black text-slate-200 overflow-hidden relative font-sans">
      
      
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-900 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-64 h-full glass-panel md:bg-transparent bg-[#0a0a0a] border-r border-slate-800 flex flex-col z-50 pb-20 md:pb-24 transition-transform duration-300`}>
        {/* App Branding */}
        <div className="p-6 flex items-center gap-3">
          <img src="/logo.png" alt="ListenUp Logo" className="h-10 w-auto object-contain drop-shadow-md" />
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-wider bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              ListenUp
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Web Player</p>
          </div>
        </div>
        {/* Navigation Tabs */}
        <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => { setActiveTab('home'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'home'
                ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800 shadow-md shadow-cyan-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a1a]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            <span className="font-semibold text-sm">Home</span>
          </button>

          <button
            onClick={() => { setActiveTab('search'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'search'
                ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800 shadow-md shadow-cyan-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a1a]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="font-semibold text-sm">Search Songs</span>
          </button>

          <button
            onClick={() => { setActiveTab('favorites'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'favorites'
                ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800 shadow-md shadow-cyan-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a1a]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span className="font-semibold text-sm">Favorites</span>
            {favorites.length > 0 && (
              <span className="ml-auto bg-[#0a2e36] text-cyan-400 text-xs px-2 py-0.5 rounded-full font-bold border border-[#0d3f4a]">
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
                ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800 shadow-md shadow-cyan-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a1a]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v11.25m0-11.25a9 9 0 1118 0v11.25m-18 0a9 9 0 0018 0M3.75 13.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <span className="font-semibold text-sm">Playlists</span>
            {playlists.length > 0 && (
              <span className="ml-auto bg-[#0a2e36] text-cyan-400 text-xs px-2 py-0.5 rounded-full font-bold border border-[#0d3f4a]">
                {playlists.length}
              </span>
            )}
          </button>


          <button
            onClick={() => setActiveTab('rooms')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'rooms'
                ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800 shadow-md shadow-cyan-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a1a]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <span className="font-semibold text-sm">Music Rooms</span>
            {activeRoom && (
              <span className="ml-auto bg-green-950 text-green-400 text-xs px-2 py-0.5 rounded-full font-bold border border-green-900">
                Live
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('queue'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === 'queue'
                ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-400 border border-cyan-800 shadow-md shadow-cyan-900/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a1a1a]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <span className="font-semibold text-sm">Queue</span>
            {queue.length > 0 && (
              <span className="ml-auto bg-[#0a2e36] text-cyan-400 text-xs px-2 py-0.5 rounded-full font-bold border border-[#0d3f4a]">
                {queue.length}
              </span>
            )}
          </button>
        </nav>

        {/* Sidebar Bottom Footer (YouTube + Credits) */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-5 mt-auto">
          {/* Hidden YouTube Video Container (Required by API to be in DOM) */}
          <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none w-[1px] h-[1px] overflow-hidden">
            <div id="yt-player-iframe"></div>
            <audio ref={silentAudioRef} loop src="data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"></audio>
          </div>
          
          {/* Creator Credits */}
          <div>
            <div className="text-xs text-slate-400 font-medium">Made by Prateek</div>
            <div className="flex items-center gap-3 mt-1.5">
              <a href="https://www.linkedin.com/in/prateek-jaiswal-44b580377/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-[#0077b5] transition-colors" title="LinkedIn" aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
              <a href="https://github.com/prateek977" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors" title="GitHub" aria-label="GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Dashboard Panels */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-32 md:pb-28 px-4 md:px-8 py-4 md:py-6 z-10">

        {/* SEO Visually Hidden Content */}
        <section className="sr-only">
          <h2>What is ListenUp?</h2>
          <p>ListenUp is a premium, real-time collaborative music streaming platform. Search and stream an unlimited library of music directly from YouTube.</p>
          <h3>Main Features</h3>
          <ul>
            <li>Real-Time Music Rooms: Create a room, invite friends, and listen together in perfect sync using WebSockets.</li>
            <li>Unlimited Search: Find any song, artist, or album using our powerful yt-dlp integrated search.</li>
            <li>Play Queue & Favorites: Curate your perfect playlist and save your favorite tracks locally.</li>
          </ul>
          <h3>Technology Stack</h3>
          <p>Built with React, Vite, Tailwind CSS, Python, Flask, Flask-SocketIO, and the YouTube Iframe Player API.</p>
        </section>

        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-300 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <img src="/logo.png" alt="ListenUp Logo" className="h-6 w-auto object-contain drop-shadow-md" />
            <h1 className="text-lg font-extrabold text-white tracking-wider bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              ListenUp
            </h1>
          </div>
        </div>

        {/* Active View: HOME */}
        {activeTab === 'home' && (
          <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full">
            {/* Header / Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-cyan-950 p-5 md:p-8 border border-cyan-900/10 shadow-2xl">
              <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-cyan-500/5 to-transparent blur-3xl pointer-events-none"></div>
              <span className="text-[10px] bg-[#0a2e36] text-purple-300 border border-[#0d3f4a] px-3 py-1 rounded-full font-bold uppercase tracking-wider">
                Welcome
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-white mt-4 tracking-tight leading-none bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Your Sound, Reimagined
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-md">
                Stream unlimited music, build custom libraries, and enjoy visual playback directly in your web player.
              </p>
            </div>

            {/* Curated Music Sections */}
            {homeLoading ? (
              <div className="space-y-8">
                {['🔥 Top Trending', '🇮🇳 Bollywood Hits', '🇬🇧 Hollywood Pop'].map((title, si) => (
                  <div key={title} className="space-y-4">
                    <div className="skeleton-shimmer h-6 w-44" style={{animationDelay: `${si * 0.15}s`}}></div>
                    <div className="flex gap-4 overflow-x-hidden">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="w-40 flex-shrink-0 space-y-2" style={{animationDelay: `${(si * 5 + i) * 0.08}s`}}>
                          <div className="skeleton-shimmer w-40 h-40 rounded-2xl"></div>
                          <div className="skeleton-shimmer h-3 w-32 rounded-md"></div>
                          <div className="skeleton-shimmer h-3 w-20 rounded-md"></div>
                        </div>
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
                      
                      <div className="relative group/scroll">
                        <div 
                          id={`scroll-${key}`}
                          className="flex overflow-x-auto gap-4 pb-4 scroll-smooth scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20 hide-scrollbar"
                        >
                          {songs.map((song, songIdx) => (
                          <div 
                            key={song.id} 
                            className="w-40 flex-shrink-0 relative group p-3 rounded-2xl glass-card border border-[#222222] bg-[#141414] hover:bg-[#222222] transition-all flex flex-col animate-card-in"
                            style={{animationDelay: `${songIdx * 0.06}s`}}
                          >
                            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                              <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-transparent md:bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
                                <button
                                  onClick={(e) => { e.stopPropagation(); playSongFromList(song, songs); }}
                                  className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-cyan-600/90 md:bg-cyan-600 text-white flex items-center justify-center shadow-lg transform md:scale-90 md:group-hover:scale-100 hover:bg-cyan-500 active:scale-95 transition-all pointer-events-auto absolute bottom-2 right-2 md:static"
                                  title="Play"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 translate-x-0.5">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-3 flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors" title={song.title}>
                                {song.title}
                              </h4>
                              <p className="text-[10px] text-slate-400 truncate mt-0.5" title={song.artist}>
                                {song.artist}
                              </p>
                            </div>

                            <div className="flex items-center justify-end gap-1 mt-2.5 pt-2 border-t border-[#222222]">
                              <button
                                onClick={() => toggleFavorite(song)}
                                className={`p-1 rounded hover:bg-[#222222] transition-colors ${
                                  favorites.some(s => s.id === song.id) ? 'text-pink-500' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill={favorites.some(s => s.id === song.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                </svg>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setContextMenu({ isOpen: true, song });
                                }}
                                className="p-1 rounded hover:bg-[#222222] transition-colors text-slate-500 hover:text-slate-300"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                  <path d="M12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                        
                        {/* Right scroll button */}
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(`scroll-${key}`);
                            if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
                          }}
                          className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-slate-900/80 border border-slate-700 text-white shadow-xl opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-slate-800"
                          title="Scroll Right"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
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
              <h2 className="text-3xl font-extrabold text-white text-glow-cyan">Discover Music</h2>
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
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-8 rounded-2xl shadow-lg shadow-cyan-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {searchResults.length > 0 ? 'Search Results' : 'Search Database'}
              </h3>
              
              {searchLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-5">
                  <svg className="music-spinner-ring" width="48" height="48" viewBox="0 0 50 50">
                    <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" strokeDasharray="1, 200" strokeDashoffset="0" />
                  </svg>
                  <div className="flex items-center gap-2">
                    <span className="bounce-dot"></span>
                    <span className="bounce-dot"></span>
                    <span className="bounce-dot"></span>
                  </div>
                  <p className="text-slate-400 text-sm">Searching millions of songs...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-20 bg-[#141414] rounded-2xl border border-slate-800">
                  <p className="text-slate-400 text-sm">Enter a search query to search millions of songs instantly.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {searchResults.map((song, idx) => (
                    <div 
                      key={song.id} 
                      className={`glass-card p-3 rounded-2xl flex items-center gap-4 group animate-card-in ${
                        currentSong?.id === song.id ? 'border-[#0d3f4a] bg-cyan-950' : ''
                      }`}
                      style={{animationDelay: `${idx * 0.05}s`}}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0 bg-slate-900 border border-slate-800">
                        <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-transparent md:bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
                          <button 
                            onClick={(e) => { e.stopPropagation(); playSongFromList(song, searchResults); }}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-cyan-600/90 md:bg-transparent md:bg-none md:hover:bg-cyan-600/50 text-white flex items-center justify-center shadow-lg md:shadow-none pointer-events-auto absolute bottom-2 right-2 md:static transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6 text-white translate-x-0.5">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                          {song.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{formatTime(song.duration)}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleFavorite(song)}
                          className={`p-2 rounded-lg hover:bg-[#222222] transition-colors ${
                            favorites.some(s => s.id === song.id) ? 'text-pink-500' : 'text-slate-400 hover:text-slate-200'
                          }`}
                          title={favorites.some(s => s.id === song.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill={favorites.some(s => s.id === song.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                          </svg>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ isOpen: true, song });
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#222222] transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                          </svg>
                        </button>
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
              <h2 className="text-3xl font-extrabold text-white text-glow-cyan">Your Favorites</h2>
              <p className="text-slate-400 text-sm mt-1">Tracks saved in your local browser library.</p>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-20 bg-[#141414] rounded-2xl border border-slate-800">
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
                      currentSong?.id === song.id ? 'border-[#0d3f4a] bg-cyan-950' : ''
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden relative flex-shrink-0 bg-slate-900 border border-slate-800">
                      <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-transparent md:bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
                        <button 
                          onClick={(e) => { e.stopPropagation(); playSongFromList(song, favorites); }}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-cyan-600/90 md:bg-transparent md:bg-none md:hover:bg-cyan-600/50 text-white flex items-center justify-center shadow-lg md:shadow-none pointer-events-auto absolute bottom-2 right-2 md:static transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6 text-white translate-x-0.5">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                        {song.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{formatTime(song.duration)}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleFavorite(song)}
                        className="p-2 rounded-lg text-pink-500 hover:bg-[#222222] transition-colors"
                        title="Remove from Favorites"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu({ isOpen: true, song });
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#222222] transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                        </svg>
                      </button>
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
                    <h2 className="text-3xl font-extrabold text-white text-glow-cyan">Playlists</h2>
                    <p className="text-slate-400 text-sm mt-1">Create and manage your custom music collections.</p>
                  </div>
                  <button
                    onClick={openCreatePlaylistModal}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-600/20 active:scale-[0.98] transition-all text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Create Playlist
                  </button>
                </div>

                {playlists.length === 0 ? (
                  <div className="text-center py-20 bg-[#141414] rounded-2xl border border-slate-800">
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
                        className="glass-card p-4 rounded-3xl cursor-pointer group hover:border-cyan-500/20 relative"
                      >
                        <div className="aspect-square rounded-2xl bg-cyan-950 hover:bg-cyan-900 border border-slate-800 flex flex-col items-center justify-center relative mb-4 shadow-inner overflow-hidden">
                          {pl.songs.length > 0 ? (
                            <div className="w-full h-full relative">
                              <img src={pl.songs[0].thumbnailUrl} alt={pl.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            </div>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-cyan-400/50">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.884 2.223v6c0 1.243 1.007 2.25 2.25 2.25h16.5a2.25 2.25 0 002.25-2.25v-6a2.25 2.25 0 00-1.884-2.223m-16.5 0V6.002a2.25 2.25 0 012.25-2.25h5.378a2.25 2.25 0 011.59.659l2.122 2.121c.14.14.33.22.53.22h5.13a2.25 2.25 0 012.25 2.25v1.774" />
                            </svg>
                          )}
                          
                          {pl.songs.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playPlaylist(pl);
                              }}
                              className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-lg active:scale-95 transform translate-y-2 group-hover:translate-y-0 transition-all"
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
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all"
                      >
                        Delete Playlist
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-end bg-cyan-950 border border-cyan-900/20 p-6 rounded-3xl">
                      <div className="w-32 h-32 rounded-2xl bg-cyan-950 hover:bg-cyan-900 border border-slate-800 flex items-center justify-center shadow-md overflow-hidden relative">
                        {currentPl.songs.length > 0 ? (
                          <img src={currentPl.songs[0].thumbnailUrl} alt={currentPl.name} className="w-full h-full object-cover" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-cyan-400/50">
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
                                className="text-cyan-400 hover:text-purple-300 font-bold flex items-center gap-1"
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
                        <div className="text-center py-20 bg-[#141414] rounded-2xl border border-slate-800">
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
                                  isPlayingCurrent ? 'border-cyan-500/20 bg-cyan-950' : ''
                                }`}
                              >
                                <span className="text-xs text-slate-500 font-bold w-4 text-center">
                                  {index + 1}
                                </span>

                                <div className="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0 bg-slate-900">
                                  <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-transparent md:bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); playSongFromList(song, currentPl.songs); }}
                                      className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-600/90 md:bg-transparent md:bg-none md:hover:bg-cyan-600/50 text-white flex items-center justify-center shadow-lg md:shadow-none pointer-events-auto absolute bottom-2 right-2 md:static transition-all"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white translate-x-0.5">
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-sm font-semibold truncate ${isPlayingCurrent ? 'text-cyan-400' : 'text-white'}`}>
                                    {song.title}
                                  </h4>
                                  <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                                </div>

                                <span className="text-xs text-slate-500 font-medium mr-2">
                                  {formatTime(song.duration)}
                                </span>

                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setContextMenu({ isOpen: true, song })}
                                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#222222] transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                      <path d="M12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM12 20a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
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

        {/* Active View: MUSIC ROOMS */}
        {activeTab === 'rooms' && (
          <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
            {!activeRoom ? (
              <>
                {/* Header */}
                <div>
                  <h2 className="text-3xl font-extrabold text-white text-glow-cyan">Music Rooms</h2>
                  <p className="text-slate-400 text-sm mt-1">Create or join a room to listen together with friends in real-time.</p>
                </div>

                {/* Display Name */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Your Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="glass-input px-4 py-2 rounded-xl text-sm text-slate-100 placeholder-slate-500 w-48"
                    placeholder="Your display name"
                  />
                </div>

                {roomError && (
                  <div className="bg-red-950 border border-red-900 text-red-300 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in">
                    {roomError}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Create Room Card */}
                  <div className="bg-[#141121] border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">Create Music Room</h3>
                      <p className="text-slate-400 text-xs mt-1">Start a synchronized listening session with friends.</p>
                    </div>

                    {!roomCreated ? (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Room Name</label>
                          <input
                            type="text"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            placeholder="Friday Night Vibes"
                            className="glass-input px-4 py-3 rounded-xl text-sm text-slate-100 placeholder-slate-500"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Room Visibility</label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setRoomVisibility('public')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${roomVisibility === 'public' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >Public</button>
                            <button
                              onClick={() => setRoomVisibility('private')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${roomVisibility === 'private' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            >Private</button>
                          </div>
                        </div>

                        <button
                          onClick={handleCreateRoom}
                          disabled={!newRoomName.trim()}
                          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-sm mt-2"
                        >
                          Create Room
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col gap-4 animate-fade-in">
                        <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                          Room Created!
                        </div>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Room Code</p>
                          <p className="text-2xl font-black text-cyan-400 tracking-wider">{roomCode}</p>
                        </div>

                        <button
                          onClick={() => copyToClipboard(roomCode, 'code')}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
                        >
                          {copiedCode ? '✓ Copied!' : 'Copy Room Code'}
                        </button>

                        <button
                          onClick={() => copyToClipboard(window.location.origin + '/room/' + roomCode, 'link')}
                          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
                        >
                          {copiedLink ? '✓ Link Copied!' : 'Copy Invitation Link'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Join Room Card */}
                  <div className="bg-[#141121] border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">Join Music Room</h3>
                      <p className="text-slate-400 text-xs mt-1">Enter a room code to listen together.</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Room Code</label>
                      <input
                        type="text"
                        value={joinRoomCode}
                        onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                        placeholder="MZK-4839"
                        className="glass-input px-4 py-3 rounded-xl text-sm text-slate-100 placeholder-slate-500 uppercase tracking-widest text-center font-bold"
                      />
                    </div>

                    <button
                      onClick={handleJoinRoom}
                      disabled={!joinRoomCode.trim()}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-sm mt-2"
                    >
                      Join Room
                    </button>
                  </div>

                  {/* Active Public Rooms */}
                  <div className="bg-[#141121] border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">Active Rooms</h3>
                      <p className="text-slate-400 text-xs mt-1">Public rooms you can join now.</p>
                    </div>

                    {publicRooms.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10 text-slate-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                        <h4 className="text-white font-bold text-sm">No active rooms</h4>
                        <p className="text-slate-500 text-xs">Create a room to start listening with friends!</p>
                      </div>
                    ) : (
                      <div className="space-y-2 overflow-y-auto max-h-64 custom-scrollbar">
                        {publicRooms.map((room) => (
                          <div key={room.code} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{room.name}</p>
                              <p className="text-xs text-slate-400">{room.listenerCount} listening · Host: {room.host}</p>
                            </div>
                            <button
                              onClick={() => {
                                setJoinRoomCode(room.code);
                                socketRef.current?.emit('join_room_request', { roomCode: room.code, displayName });
                              }}
                              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-all"
                            >
                              Join
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Active Room Experience */
              <div className="flex flex-col gap-6 animate-fade-in">
                {/* Room Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-extrabold text-white">{activeRoom.name}</h2>
                      <span className="bg-green-950 text-green-400 text-xs px-2.5 py-1 rounded-full font-bold border border-green-900 animate-pulse">
                        Live
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-xs text-slate-400 font-mono">{roomCode}</span>
                      <span className="text-xs text-slate-400">{roomParticipants.length} Listening</span>
                      {isHost && <span className="text-xs text-cyan-400 font-semibold">You are the Host</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(roomCode, 'code')}
                      className="px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all active:scale-[0.98]"
                    >
                      {copiedCode ? '✓ Copied!' : 'Copy Code'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(window.location.origin + '/room/' + roomCode, 'link')}
                      className="px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all active:scale-[0.98]"
                    >
                      {copiedLink ? '✓ Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={handleLeaveRoom}
                      className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all active:scale-[0.98]"
                    >
                      Leave Room
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Current Song Card */}
                  <div className="lg:col-span-2 bg-[#141121] border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Now Playing</h3>
                    {currentSong ? (
                      <div className="flex items-center gap-5">
                        <img src={currentSong.thumbnailUrl} alt={currentSong.title} className="w-24 h-24 rounded-2xl object-cover border border-slate-800 shadow-md" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xl font-bold text-white truncate">{currentSong.title}</h4>
                          <p className="text-sm text-slate-400 truncate">{currentSong.artist}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <div className="flex gap-1 items-end h-6">
                              {[12, 18, 10, 22, 14].map((h, i) => (
                                <div key={i} className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${isPlaying ? 'waveform-bar' : ''}`} style={{ height: isPlaying ? `${h}px` : '4px', animationDelay: `${i * 0.15}s` }}></div>
                              ))}
                            </div>
                            <span className="text-xs text-cyan-400 font-semibold ml-2">
                              {isPlaying ? 'Playing' : 'Paused'}
                            </span>
                          </div>
                          {isHost && <p className="text-[10px] text-slate-500 mt-2">Your playback is synced to all listeners.</p>}
                          {!isHost && <p className="text-[10px] text-slate-500 mt-2">Synced with the host&apos;s playback.</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 text-slate-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                        </svg>
                        <p className="text-slate-400 text-sm font-medium">No song playing yet</p>
                        {isHost && <p className="text-slate-500 text-xs">Search for a song and play it to start the session!</p>}
                        {!isHost && <p className="text-slate-500 text-xs">Waiting for the host to play a song...</p>}
                      </div>
                    )}
                  </div>

                  {/* Participants */}
                  <div className="bg-[#141121] border border-slate-800 rounded-3xl p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Listeners ({roomParticipants.length})
                    </h3>
                    <div className="space-y-2.5 overflow-y-auto max-h-48 custom-scrollbar">
                      {roomParticipants.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-900 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-900 flex items-center justify-center text-cyan-400 text-xs font-bold">
                            {p.displayName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-semibold truncate">{p.displayName}</p>
                          </div>
                          {p.isHost && (
                            <span className="text-[10px] bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded-full font-bold border border-cyan-900">Host</span>
                          )}
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-[#141121] border border-slate-800 rounded-3xl p-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Room Activity</h3>
                  {roomActivity.length === 0 ? (
                    <p className="text-slate-500 text-xs">Activity will appear here as things happen in the room.</p>
                  ) : (
                    <div className="space-y-1.5 overflow-y-auto max-h-32 custom-scrollbar">
                      {roomActivity.slice().reverse().map((act, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-400 py-1">
                          <span className="text-slate-600">{new Date(act.timestamp).toLocaleTimeString()}</span>
                          <span>{act.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active View: QUEUE */}
        {activeTab === 'queue' && (() => {
          const currentIdx = queue.findIndex(s => s.id === currentSong?.id);
          const upcomingSongs = currentIdx !== -1 ? queue.slice(currentIdx + 1) : (queue.length > 0 && !currentSong ? queue : []);
          const historySongs = currentIdx > 0 ? queue.slice(0, currentIdx).reverse() : [];

          const onDragEnd = (result) => {
            if (!result.destination) return;
            const srcIndex = result.source.index;
            const destIndex = result.destination.index;
            if (srcIndex === destIndex) return;

            // Map from "upcomingSongs" indices back to real queue indices
            const upcomingStartIdx = currentIdx + 1;
            const newQueue = [...queue];
            const [removed] = newQueue.splice(upcomingStartIdx + srcIndex, 1);
            newQueue.splice(upcomingStartIdx + destIndex, 0, removed);
            setQueue(newQueue);
          };

          return (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-extrabold text-white text-glow-cyan">Queue</h2>
                <p className="text-slate-400 text-sm mt-1">Manage your upcoming tracks and view history.</p>
              </div>
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all active:scale-[0.98]"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Currently Playing Card */}
            {currentSong && (
              <div className="bg-gradient-to-r from-cyan-950 to-cyan-950 border border-cyan-900/30 p-5 rounded-3xl flex items-center gap-5 relative">
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
                  <span className="text-[10px] bg-[#0a2e36] text-cyan-400 border border-[#0d3f4a] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Now Playing
                  </span>
                  <h3 className="text-lg font-bold text-white truncate mt-2">{currentSong.title}</h3>
                  <p className="text-sm text-slate-400 truncate mt-0.5">{currentSong.artist}</p>
                </div>
              </div>
            )}

            {/* Up Next (Draggable) */}
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide mb-3">Up Next</h3>
              {upcomingSongs.length === 0 ? (
                <div className="text-center py-12 bg-[#141414] rounded-2xl border border-slate-800">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10 text-slate-500 mx-auto mb-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                  </svg>
                  <h4 className="text-white font-bold mb-1">No upcoming tracks</h4>
                  <p className="text-slate-400 text-sm">Songs queued after the current track will appear here.</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="queue-upcoming">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                        {upcomingSongs.map((song, index) => (
                          <Draggable key={song.id} draggableId={`queue-${song.id}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 p-3 rounded-2xl glass-card relative group transition-shadow ${
                                  snapshot.isDragging ? 'shadow-2xl shadow-cyan-500/20 ring-1 ring-cyan-500/30 bg-[#1a1a1a]' : ''
                                }`}
                              >
                                {/* Drag Handle */}
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 touch-manipulation px-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                  </svg>
                                </div>

                                <span className="text-xs text-slate-500 font-bold w-4 text-center">
                                  {index + 1}
                                </span>

                                <div className="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0 bg-slate-900">
                                  <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold truncate text-white">{song.title}</h4>
                                  <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                                </div>

                                <span className="text-xs text-slate-500 font-medium hidden md:inline">
                                  {formatTime(song.duration)}
                                </span>

                                <button
                                  onClick={() => removeFromQueue(song.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-[#2a0e10] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                  title="Remove from Queue"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>

            {/* Recently Played (History) */}
            {historySongs.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-slate-400 tracking-wide mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Recently Played
                </h3>
                <div className="space-y-2 opacity-60">
                  {historySongs.map((song, index) => (
                    <div
                      key={`history-${song.id}-${index}`}
                      className="flex items-center gap-3 p-3 rounded-2xl glass-card relative group"
                    >
                      <div className="w-11 h-11 rounded-lg overflow-hidden relative flex-shrink-0 bg-slate-900">
                        <img src={song.thumbnailUrl} alt={song.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-transparent md:bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none md:pointer-events-auto">
                          <button
                            onClick={(e) => { e.stopPropagation(); playSong(song); }}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-cyan-600/90 md:bg-transparent md:bg-none md:hover:bg-cyan-600/50 text-white flex items-center justify-center shadow-lg md:shadow-none pointer-events-auto absolute bottom-1 right-1 md:static transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white translate-x-0.5">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate text-slate-300">{song.title}</h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{song.artist}</p>
                      </div>

                      <span className="text-xs text-slate-600 font-medium hidden md:inline">
                        {formatTime(song.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}
      </main>

      {/* Sticky Bottom Media Control Bar */}
      <footer className="h-[72px] md:h-24 w-full bg-[#1e1e1e]/95 md:glass-panel border-t md:border-t-slate-800 fixed md:bottom-0 left-0 right-0 z-40 flex items-center justify-between px-2 md:px-6 md:pb-[env(safe-area-inset-bottom)] bottom-[calc(4rem+env(safe-area-inset-bottom))] border-[#2a2a2a] md:border-transparent rounded-xl md:rounded-none m-2 md:m-0 w-[calc(100%-16px)] md:w-full drop-shadow-2xl md:drop-shadow-none">
        
        {/* Left: Active Song details */}
        <div className="w-[35%] md:w-1/4 flex items-center gap-2 md:gap-3">
          {currentSong ? (
            <>
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow flex-shrink-0">
                <img src={currentSong.thumbnailUrl} alt={currentSong.title} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs md:text-sm font-bold text-white truncate max-w-[100px] md:max-w-[200px]">
                  {currentSong.title}
                </h4>
                <p className="text-[10px] md:text-xs text-slate-400 truncate max-w-[100px] md:max-w-[200px] mt-0.5">
                  {currentSong.artist}
                </p>
              </div>
              <button
                onClick={() => toggleFavorite(currentSong)}
                aria-label={favorites.some(s => s.id === currentSong.id) ? "Remove from favorites" : "Add to favorites"}
                className={`p-1 md:p-1.5 rounded-lg hover:bg-[#222222] transition-colors ml-1 md:ml-2 ${
                  favorites.some(s => s.id === currentSong.id) ? 'text-pink-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill={favorites.some(s => s.id === currentSong.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 md:gap-3">
              <div className="hidden md:flex w-14 h-14 rounded-xl bg-[#141414] border border-dashed border-slate-800 items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 0v13.5m0-13.5L9 12.5m0 0v6.75m0-6.75L3 15.75M9 19.5a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm10.5-3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-semibold text-slate-500">No Song Loaded</h4>
                <p className="text-[10px] md:text-xs text-slate-600 hidden md:block">Play a track to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Center: Playback Controls & Progress Bar */}
        <div className="flex-1 md:w-2/5 flex flex-col items-center gap-1 md:gap-1.5 px-2 md:px-0">
          {/* Controls buttons */}
          <div className="flex items-center gap-3 md:gap-5">
            {/* Shuffle button */}
            <button
              onClick={handleShuffleToggle}
              className={`hidden sm:block transition-colors p-1.5 rounded ${
                shuffle ? 'text-cyan-400 text-glow-cyan' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Shuffle" aria-label="Shuffle"
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
              title="Previous" aria-label="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
              </svg>
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={() => {
                if (activeRoom && !isHost && socketRef.current) {
                  socketRef.current.emit('request_playback', { isPlaying: !isPlaying, displayName });
                  return;
                }
                setIsPlaying(!isPlaying);
              }}
              disabled={!currentSong || !isPlayerReady}
              className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:pointer-events-none hover:bg-slate-100 flex-shrink-0"
              title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isBuffering ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              ) : isPlaying ? (
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
              title="Next" aria-label="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            {/* Repeat button */}
            <button
              onClick={toggleRepeat}
              className={`hidden sm:block transition-colors p-1.5 rounded relative ${
                repeat !== 'off' ? 'text-cyan-400 text-glow-cyan' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={`Repeat: ${repeat}`} aria-label={`Repeat: ${repeat}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {repeat === 'one' && (
                <span className="absolute bottom-[1px] right-[1px] text-[7px] font-extrabold bg-cyan-500 text-white rounded-full w-2.5 h-2.5 flex items-center justify-center border border-[#0b0813]">
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
              className="flex-1 accent-cyan-500 h-1 rounded-lg bg-slate-800 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            />
            <span className="text-[10px] text-slate-500 font-bold tracking-wider w-8 select-none">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume & Extra Controls */}
        <div className="hidden md:flex w-1/4 items-center justify-end gap-3.5">
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
              className="w-20 accent-cyan-500 h-1 rounded bg-slate-800 cursor-pointer"
            />
          </div>


        </div>

      </footer>

      {/* Mobile Bottom Navigation Bar (Spotify Style) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0a0a0a] border-t border-[#1a1a1a] flex justify-around items-center px-2 pb-[env(safe-area-inset-bottom)] z-50">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center gap-1 w-full h-full ${activeTab === 'home' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {activeTab === 'home' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M11.47 3.84a.75.75 0 011.06 0l8.99 9a.75.75 0 11-1.06 1.06l-4.62-4.62V21a.75.75 0 01-.75.75H8.91a.75.75 0 01-.75-.75V9.28L3.53 13.9a.75.75 0 01-1.06-1.06l9-9zM12 5.64l-6.26 6.26v8.35h12.52v-8.35L12 5.64z" />
              <path d="M12 4.25L3 13h2v7h5v-5h4v5h5v-7h2L12 4.25z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          )}
          <span className="text-[10px] font-medium">Home</span>
        </button>
        
        <button
          onClick={() => setActiveTab('search')}
          className={`flex flex-col items-center justify-center gap-1 w-full h-full ${activeTab === 'search' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {activeTab === 'search' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          )}
          <span className="text-[10px] font-medium">Search</span>
        </button>

        <button
          onClick={() => { setActiveTab('playlists'); setIsMobileMenuOpen(false); }}
          className={`flex flex-col items-center justify-center gap-1 w-full h-full ${activeTab === 'playlists' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {activeTab === 'playlists' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h13.5A2.25 2.25 0 0121 4.25v15.5A2.25 2.25 0 0118.75 22H5.25A2.25 2.25 0 013 19.75V4.25zM5.25 3.5a.75.75 0 00-.75.75v15.5c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75V4.25a.75.75 0 00-.75-.75H5.25z" clipRule="evenodd" />
              <path d="M7 8h10v1.5H7V8zm0 3h10v1.5H7V11zm0 3h10v1.5H7V14z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v11.25m0-11.25a9 9 0 1118 0v11.25m-18 0a9 9 0 0018 0M3.75 13.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          )}
          <span className="text-[10px] font-medium">Your Library</span>
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`flex flex-col items-center justify-center gap-1 w-full h-full ${activeTab === 'queue' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          {activeTab === 'queue' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M4.5 6a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H5.25A.75.75 0 014.5 6zM4.5 12a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H5.25A.75.75 0 014.5 12zM4.5 18a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H5.25A.75.75 0 014.5 18z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          )}
          <span className="text-[10px] font-medium">Queue</span>
        </button>
      </nav>

      {/* Native Playlist Creation Modal Dialog */}
      <dialog
        ref={createPlaylistDialogRef}
        className="dialog-reset rounded-3xl p-6 bg-black/40 border border-cyan-950 text-slate-200 w-80 shadow-2xl relative select-text"
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
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
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
              className="px-4 py-2 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg shadow transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </dialog>

      {/* Global Context Menu (Spotify Style Bottom Sheet) */}
      {contextMenu.isOpen && contextMenu.song && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center pointer-events-auto">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
            onClick={() => setContextMenu({ isOpen: false, song: null })}
          ></div>
          
          {/* Modal Content - Bottom Sheet on mobile, centered modal on desktop */}
          <div className="relative w-full md:max-w-sm bg-[#181818] rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-slide-up pb-[env(safe-area-inset-bottom)]">
            
            {/* Header: Song Info */}
            <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-4 bg-[#222]">
              <img src={contextMenu.song.thumbnailUrl} alt={contextMenu.song.title} className="w-14 h-14 rounded-lg object-cover shadow-md" />
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold truncate text-base">{contextMenu.song.title}</h3>
                <p className="text-slate-400 text-sm truncate">{contextMenu.song.artist}</p>
              </div>
            </div>

            {/* Actions List */}
            <div className="py-2 flex flex-col">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`https://listenup-web.vercel.app/search?q=${encodeURIComponent(contextMenu.song.title)}`);
                  setContextMenu({ isOpen: false, song: null });
                }}
                className="w-full text-left px-5 py-4 text-slate-300 hover:text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                <span className="font-medium text-base">Share</span>
              </button>
              
              <button 
                onClick={() => {
                  toggleFavorite(contextMenu.song);
                  setContextMenu({ isOpen: false, song: null });
                }}
                className="w-full text-left px-5 py-4 text-slate-300 hover:text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-4"
              >
                {favorites.some(s => s.id === contextMenu.song.id) ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-pink-500">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-slate-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                )}
                <span className="font-medium text-base">Add to Favorites</span>
              </button>

              <button 
                onClick={() => {
                  appendToQueue(contextMenu.song);
                  setContextMenu({ isOpen: false, song: null });
                }}
                className="w-full text-left px-5 py-4 text-slate-300 hover:text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-4"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
                <span className="font-medium text-base">Add to Queue</span>
              </button>
              
              <div className="mt-2 pt-2 border-t border-[#2a2a2a]">
                <div className="px-5 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest">Add to Playlist</div>
                {playlists.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-slate-500 italic">No playlists created. Go to Library to create one!</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {playlists.map((pl) => (
                      <button 
                        key={pl.id}
                        onClick={() => {
                          addSongToPlaylist(pl.id, contextMenu.song);
                          setContextMenu({ isOpen: false, song: null });
                        }}
                        className="w-full text-left px-5 py-3 text-slate-300 hover:text-white hover:bg-[#2a2a2a] transition-colors flex items-center gap-4"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 text-slate-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19.5h12m-12-3h12m-12-3h12m-12-3h12M5.625 19.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm0-7.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm0-7.5a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z" />
                        </svg>
                        <span className="font-medium text-base truncate">{pl.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setContextMenu({ isOpen: false, song: null })}
                className="w-full mt-2 py-4 text-center font-bold text-slate-400 hover:text-white border-t border-[#2a2a2a]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Song Request Notifications (Host Only) */}
      {pendingSongRequests.length > 0 && isHost && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
          {pendingSongRequests.map((req) => (
            <div key={req.id} className="bg-[#141121] border border-slate-700 rounded-2xl p-4 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-cyan-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                </svg>
                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Song Request</span>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={req.song.thumbnailUrl}
                  alt={req.song.title}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-800"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{req.song.title}</p>
                  <p className="text-xs text-slate-400 truncate">Requested by <span className="text-cyan-400 font-semibold">{req.requestedBy}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAcceptSongRequest(req)}
                  className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all active:scale-[0.98]"
                >
                  ✓ Accept
                </button>
                <button
                  onClick={() => handleDeclineSongRequest(req)}
                  className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all active:scale-[0.98]"
                >
                  ✕ Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
