# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import yt_dlp
import logging
import os
import random
import string
from datetime import datetime

# Set up static folder pointing to the React production build if it exists
base_dir = os.path.dirname(os.path.abspath(__file__))
dist_folder = os.path.join(base_dir, '..', 'listenup-web', 'dist')
if not os.path.exists(dist_folder):
    dist_folder = os.path.join(base_dir, 'static')

app = Flask(__name__, static_folder=dist_folder, static_url_path='')
CORS(app)  # Enable CORS for clients
socketio = SocketIO(app, cors_allowed_origins='*')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/')
@app.route('/room/<path:room_code>')
def index(room_code=None):
    """Serve the React frontend in production (SPA deep-link support)"""
    try:
        return app.send_static_file('index.html')
    except Exception:
        return "ListenUp Web: Run 'npm run build' inside listenup-web to build the frontend.", 200

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "yt-dlp-server"})

@app.route('/api/search', methods=['GET'])
def search():
    """Search YouTube for videos/songs using yt-dlp flat extraction"""
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
        
    try:
        logger.info(f"Searching YouTube for: {query}")
        
        ydl_opts = {
            'extract_flat': 'in_playlist',
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Query up to 50 results to account for filtered items
            info = ydl.extract_info(f"ytsearch50:{query}", download=False)
            entries = info.get('entries', [])
            
            results = []
            for entry in entries:
                if not entry:
                    continue
                video_id = entry.get('id')
                if not video_id:
                    continue
                
                # Format duration and filter out shorts (<1m) and mashups/mixes (>10m)
                duration = entry.get('duration') or 0
                if duration < 60 or duration > 600:
                    continue
                
                # Fallback thumbnail if missing
                thumbnail = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
                thumbnails = entry.get('thumbnails', [])
                if thumbnails:
                    thumbnail = thumbnails[-1].get('url') or thumbnails[0].get('url') or thumbnail

                results.append({
                    "id": video_id,
                    "title": entry.get('title') or "Unknown Title",
                    "artist": entry.get('uploader') or "Unknown Artist",
                    "thumbnailUrl": thumbnail,
                    "duration": int(duration),
                    "viewCount": entry.get('view_count') or 0
                })
                
            # Return max 20 results
            results = results[:20]
            logger.info(f"Found {len(results)} search results for query: {query}")
            return jsonify(results)
    except Exception as e:
        logger.error(f"Search error for query '{query}': {str(e)}")
        return jsonify({"error": str(e)}), 500

# Simple in-memory cache for browse results (avoids hammering yt-dlp on page load)
import time as _time
_browse_cache = {}
_CACHE_TTL = 600  # 10 minutes

BROWSE_CATEGORIES = {
    "trending": "latest hit songs official music video",
    "bollywood": "latest bollywood songs official video",
    "hollywood": "popular english songs official video",
    "lofi": "lofi chill single track",
    "pop": "top pop songs official music video",
    "romantic": "romantic songs official video",
    "party": "party dance songs official video"
}

@app.route('/api/browse', methods=['GET'])
def browse():
    """Return curated songs for a category using predefined searches"""
    category = request.args.get('category', 'trending').lower()
    
    if category not in BROWSE_CATEGORIES:
        return jsonify({"error": f"Unknown category: {category}", "available": list(BROWSE_CATEGORIES.keys())}), 400
    
    # Check cache
    cache_key = category
    now = _time.time()
    if cache_key in _browse_cache:
        cached_data, cached_at = _browse_cache[cache_key]
        if now - cached_at < _CACHE_TTL:
            logger.info(f"Returning cached browse results for: {category}")
            return jsonify(cached_data)
    
    query = BROWSE_CATEGORIES[category]
    try:
        logger.info(f"Browsing category '{category}' with query: {query}")
        
        ydl_opts = {
            'extract_flat': 'in_playlist',
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Query 50 results to account for filtered mashups
            info = ydl.extract_info(f"ytsearch50:{query}", download=False)
            entries = info.get('entries', [])
            
            results = []
            for entry in entries:
                if not entry:
                    continue
                video_id = entry.get('id')
                if not video_id:
                    continue
                
                duration = entry.get('duration') or 0
                if duration < 60 or duration > 600:
                    continue
                    
                thumbnail = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
                thumbnails = entry.get('thumbnails', [])
                if thumbnails:
                    thumbnail = thumbnails[-1].get('url') or thumbnails[0].get('url') or thumbnail
                
                results.append({
                    "id": video_id,
                    "title": entry.get('title') or "Unknown Title",
                    "artist": entry.get('uploader') or "Unknown Artist",
                    "thumbnailUrl": thumbnail,
                    "duration": int(duration),
                    "viewCount": entry.get('view_count') or 0
                })
            
            # Limit to 20 results and cache
            results = results[:20]
            _browse_cache[cache_key] = (results, now)
            logger.info(f"Browse '{category}': found {len(results)} results")
            return jsonify(results)
    except Exception as e:
        logger.error(f"Browse error for category '{category}': {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/categories', methods=['GET'])
def categories():
    """Return the list of available browse categories"""
    return jsonify(list(BROWSE_CATEGORIES.keys()))

@app.route('/stream/<video_id>', methods=['GET'])
@app.route('/api/stream/<video_id>', methods=['GET'])
def get_stream(video_id):
    """
    Extract audio stream URL for a YouTube video
    Returns JSON with stream URL and metadata
    """
    try:
        logger.info(f"Extracting stream for video: {video_id}")
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Get the best audio format
            formats = info.get('formats', [])
            audio_formats = [f for f in formats if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
            
            if not audio_formats:
                # Fallback to any format with audio
                audio_formats = [f for f in formats if f.get('acodec') != 'none']
            
            if not audio_formats:
                logger.error(f"No audio formats found for {video_id}")
                return jsonify({"error": "No audio stream available"}), 404
            
            # Get best quality audio
            best_audio = max(audio_formats, key=lambda x: x.get('abr', 0) or x.get('tbr', 0))
            
            stream_url = best_audio.get('url')
            
            if not stream_url:
                logger.error(f"No stream URL found for {video_id}")
                return jsonify({"error": "Stream URL not available"}), 404
            
            response = {
                "video_id": video_id,
                "stream_url": stream_url,
                "title": info.get('title', 'Unknown'),
                "duration": info.get('duration', 0),
                "format": best_audio.get('ext', 'unknown'),
                "quality": f"{best_audio.get('abr', 0)}kbps"
            }
            
            logger.info(f"Successfully extracted stream for {video_id}")
            return jsonify(response)
            
    except Exception as e:
        logger.error(f"Error extracting stream for {video_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ─── Music Rooms: In-Memory Store ────────────────────────────────────

rooms = {}  # room_code -> room dict
user_rooms = {}  # sid -> room_code

def generate_room_code():
    """Generate a unique room code like MZK-4839"""
    while True:
        code = 'MZK-' + ''.join(random.choices(string.digits, k=4))
        if code not in rooms:
            return code

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connected', {'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    logger.info(f'Client disconnected: {sid}')
    # Auto-leave room on disconnect
    if sid in user_rooms:
        room_code = user_rooms[sid]
        if room_code in rooms:
            room = rooms[room_code]
            room['participants'] = [p for p in room['participants'] if p['sid'] != sid]
            emit('room_update', room, to=room_code)
            emit('activity', {
                'type': 'user_left',
                'message': f'A listener left the room',
                'timestamp': datetime.utcnow().isoformat()
            }, to=room_code)
            # Delete room if empty
            if len(room['participants']) == 0:
                del rooms[room_code]
                logger.info(f'Room {room_code} deleted (empty)')
        del user_rooms[sid]

@socketio.on('create_room')
def handle_create_room(data):
    sid = request.sid
    room_name = data.get('roomName', 'Untitled Room')
    visibility = data.get('visibility', 'public')
    display_name = data.get('displayName', f'User-{sid[:4]}')

    room_code = generate_room_code()
    room = {
        'code': room_code,
        'name': room_name,
        'visibility': visibility,
        'host_sid': sid,
        'created_at': datetime.utcnow().isoformat(),
        'participants': [{
            'sid': sid,
            'displayName': display_name,
            'isHost': True,
            'joinedAt': datetime.utcnow().isoformat()
        }],
        'currentSong': None,
        'isPlaying': False,
        'currentTime': 0,
        'lastSyncAt': datetime.utcnow().isoformat()
    }
    rooms[room_code] = room
    user_rooms[sid] = room_code
    join_room(room_code)

    logger.info(f'Room created: {room_code} by {display_name}')
    emit('room_created', room)
    emit('activity', {
        'type': 'room_created',
        'message': f'{display_name} created the room',
        'timestamp': datetime.utcnow().isoformat()
    }, to=room_code)

@socketio.on('join_room_request')
def handle_join_room(data):
    sid = request.sid
    room_code = data.get('roomCode', '').strip().upper()
    display_name = data.get('displayName', f'User-{sid[:4]}')

    if room_code not in rooms:
        emit('room_error', {'message': 'Room not found. Check the code and try again.'})
        return

    # Leave previous room if any
    if sid in user_rooms:
        old_code = user_rooms[sid]
        if old_code in rooms:
            rooms[old_code]['participants'] = [p for p in rooms[old_code]['participants'] if p['sid'] != sid]
            leave_room(old_code)
            emit('room_update', rooms[old_code], to=old_code)

    room = rooms[room_code]
    # Check if already in room
    if not any(p['sid'] == sid for p in room['participants']):
        room['participants'].append({
            'sid': sid,
            'displayName': display_name,
            'isHost': False,
            'joinedAt': datetime.utcnow().isoformat()
        })

    user_rooms[sid] = room_code
    join_room(room_code)

    logger.info(f'{display_name} joined room {room_code}')
    emit('room_joined', room)
    emit('room_update', room, to=room_code)
    emit('activity', {
        'type': 'user_joined',
        'message': f'{display_name} joined the room',
        'timestamp': datetime.utcnow().isoformat()
    }, to=room_code)

@socketio.on('leave_room_request')
def handle_leave_room(data):
    sid = request.sid
    room_code = data.get('roomCode', '')

    if room_code in rooms:
        room = rooms[room_code]
        room['participants'] = [p for p in room['participants'] if p['sid'] != sid]
        leave_room(room_code)
        emit('room_update', room, to=room_code)
        emit('activity', {
            'type': 'user_left',
            'message': 'A listener left the room',
            'timestamp': datetime.utcnow().isoformat()
        }, to=room_code)
        if len(room['participants']) == 0:
            del rooms[room_code]
    if sid in user_rooms:
        del user_rooms[sid]
    emit('room_left', {'message': 'You left the room.'})

@socketio.on('sync_playback')
def handle_sync_playback(data):
    """Host broadcasts playback state to all listeners"""
    sid = request.sid
    if sid not in user_rooms:
        return
    room_code = user_rooms[sid]
    if room_code not in rooms:
        return
    room = rooms[room_code]
    # Only the host can sync
    if room['host_sid'] != sid:
        return

    room['currentSong'] = data.get('currentSong')
    room['isPlaying'] = data.get('isPlaying', False)
    room['currentTime'] = data.get('currentTime', 0)
    room['lastSyncAt'] = datetime.utcnow().isoformat()

    emit('playback_update', {
        'currentSong': room['currentSong'],
        'isPlaying': room['isPlaying'],
        'currentTime': room['currentTime'],
        'lastSyncAt': room['lastSyncAt']
    }, to=room_code, include_self=False)

@socketio.on('request_song')
def handle_request_song(data):
    """Listener requests a song — forward it to the host"""
    sid = request.sid
    if sid not in user_rooms:
        return
    room_code = user_rooms[sid]
    if room_code not in rooms:
        return
    room = rooms[room_code]
    host_sid = room['host_sid']
    display_name = data.get('displayName', 'Someone')
    song = data.get('song')
    if song:
        # Send the song request directly to the host
        emit('song_requested', {'song': song, 'requestedBy': display_name}, to=host_sid)
        # Notify the room
        emit('activity', {
            'type': 'song_request',
            'message': f'{display_name} requested: {song.get("title", "a song")}',
            'timestamp': datetime.utcnow().isoformat()
        }, to=room_code)

@socketio.on('request_playback')
def handle_request_playback(data):
    """Listener requests play/pause — forward to host"""
    sid = request.sid
    if sid not in user_rooms:
        return
    room_code = user_rooms[sid]
    if room_code not in rooms:
        return
    room = rooms[room_code]
    host_sid = room['host_sid']
    # Forward the play/pause request to the host
    emit('playback_requested', {
        'isPlaying': data.get('isPlaying', False),
        'requestedBy': data.get('displayName', 'Someone')
    }, to=host_sid)

@socketio.on('chat_message')
def handle_chat(data):
    sid = request.sid
    if sid not in user_rooms:
        return
    room_code = user_rooms[sid]
    emit('activity', {
        'type': 'chat',
        'message': data.get('message', ''),
        'sender': data.get('displayName', 'Anonymous'),
        'timestamp': datetime.utcnow().isoformat()
    }, to=room_code)

# REST endpoint so the frontend can list public rooms
@app.route('/api/rooms', methods=['GET'])
def list_rooms():
    public_rooms = []
    for code, room in rooms.items():
        if room['visibility'] == 'public':
            public_rooms.append({
                'code': room['code'],
                'name': room['name'],
                'listenerCount': len(room['participants']),
                'currentSong': room['currentSong'],
                'host': next((p['displayName'] for p in room['participants'] if p['isHost']), 'Unknown')
            })
    return jsonify(public_rooms)

if __name__ == "__main__":
    print("=" * 50)
    print("🎵 ListenUp Server (with Music Rooms)")
    print("=" * 50)
    port = int(os.environ.get('PORT', 5001))
    print(f"Server running on port {port}")
    print("=" * 50)
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
