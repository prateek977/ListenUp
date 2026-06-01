import re

with open('src/App.jsx', 'r') as f:
    content = f.read()

# ── 1. Add socket.io-client import ──
content = content.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { io } from 'socket.io-client';"
)

# ── 2. Add Music Rooms state variables (after shuffle state) ──
rooms_states = """
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
  const socketRef = useRef(null);"""

content = content.replace(
    "  const [shuffle, setShuffle] = useState(false);",
    "  const [shuffle, setShuffle] = useState(false);" + rooms_states
)

# ── 3. Add socket connection useEffect (after the persist effect) ──
socket_effect = """
  // Socket.IO connection for Music Rooms
  useEffect(() => {
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
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
        setCurrentSong(data.currentSong);
        if (playerRef.current && playerRef.current.loadVideoById) {
          const currentId = currentSong?.id;
          if (currentId !== data.currentSong.id) {
            playerRef.current.loadVideoById(data.currentSong.id, data.currentTime || 0);
          } else if (Math.abs((playerRef.current.getCurrentTime?.() || 0) - (data.currentTime || 0)) > 3) {
            playerRef.current.seekTo(data.currentTime, true);
          }
        }
      }
      if (data.isPlaying) {
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
      } else {
        playerRef.current?.pauseVideo?.();
        setIsPlaying(false);
      }
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

  // Fetch public rooms when entering the rooms tab
  useEffect(() => {
    if (activeTab === 'rooms' && !activeRoom) {
      fetch('/api/rooms').then(r => r.json()).then(data => setPublicRooms(data)).catch(() => {});
    }
  }, [activeTab, activeRoom]);

  // Save display name
  useEffect(() => {
    localStorage.setItem('listenup_display_name', displayName);
  }, [displayName]);

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
"""

# Find the persist effect end to inject after it
persist_target = "  }, [playlists, queue]);"
content = content.replace(
    persist_target,
    persist_target + socket_effect,
    1  # only first occurrence
)

# ── 4. Add Music Rooms sidebar button between Playlists and Play Queue ──
rooms_sidebar = """
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

"""

# Insert before the Play Queue button
play_queue_button = """          <button
            onClick={() => setActiveTab('queue')}"""
content = content.replace(play_queue_button, rooms_sidebar + "          <button\n            onClick={() => setActiveTab('queue')}", 1)

# ── 5. Add Music Rooms view (before the closing of main) ──
# Find the queue view end to add after it
rooms_view = """
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
              /* ── Active Room Experience ── */
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
                  <button
                    onClick={handleLeaveRoom}
                    className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all active:scale-[0.98]"
                  >
                    Leave Room
                  </button>
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
                            <div className="flex gap-1 items-center">
                              {[1,2,3,4,5].map(i => (
                                <div key={i} className={`w-1 rounded-full bg-cyan-400 ${isPlaying ? 'animate-pulse' : ''}`} style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 0.1}s` }}></div>
                              ))}
                            </div>
                            <span className="text-xs text-cyan-400 font-semibold ml-2">
                              {isPlaying ? 'Playing' : 'Paused'}
                            </span>
                          </div>
                          {isHost && (
                            <p className="text-[10px] text-slate-500 mt-2">Your playback is synced to all listeners.</p>
                          )}
                          {!isHost && (
                            <p className="text-[10px] text-slate-500 mt-2">Synced with the host's playback.</p>
                          )}
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
"""

# Find the queue view's closing tags to insert after
queue_end_marker = "        {/* Active View: PLAY QUEUE */}"
content = content.replace(queue_end_marker, rooms_view + "\n        {/* Active View: PLAY QUEUE */}")

with open('src/App.jsx', 'w') as f:
    f.write(content)

print("Done! Music Rooms feature injected into App.jsx")
