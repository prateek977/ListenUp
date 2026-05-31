# pyrefly: ignore [missing-import]
from flask import Flask, jsonify, request
from flask_cors import CORS
import yt_dlp
import logging
import os

# Set up static folder pointing to the React production build if it exists
base_dir = os.path.dirname(os.path.abspath(__file__))
dist_folder = os.path.join(base_dir, '..', 'listenup-web', 'dist')
if not os.path.exists(dist_folder):
    dist_folder = os.path.join(base_dir, 'static')

app = Flask(__name__, static_folder=dist_folder, static_url_path='')
CORS(app)  # Enable CORS for clients

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/')
def index():
    """Serve the React frontend in production"""
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
            # Query up to 15 results
            info = ydl.extract_info(f"ytsearch15:{query}", download=False)
            entries = info.get('entries', [])
            
            results = []
            for entry in entries:
                if not entry:
                    continue
                video_id = entry.get('id')
                if not video_id:
                    continue
                
                # Format duration
                duration = entry.get('duration') or 0
                
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
    "trending": "top trending songs 2025",
    "bollywood": "latest bollywood hit songs 2025",
    "hollywood": "top hollywood pop songs 2025",
    "lofi": "lofi hip hop chill beats",
    "pop": "top pop songs 2025 playlist",
    "romantic": "best romantic songs hindi 2025",
    "party": "party songs bollywood 2025 dance"
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
            info = ydl.extract_info(f"ytsearch10:{query}", download=False)
            entries = info.get('entries', [])
            
            results = []
            for entry in entries:
                if not entry:
                    continue
                video_id = entry.get('id')
                if not video_id:
                    continue
                
                duration = entry.get('duration') or 0
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
            
            # Cache the results
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

if __name__ == "__main__":
    print("=" * 50)
    print("🎵 yt-dlp Stream Server")
    print("=" * 50)
    print("Server running on http://localhost:5001")
    print("For Android Emulator, use: http://10.0.2.2:5001")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5001, debug=True)
