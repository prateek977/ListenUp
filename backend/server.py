from flask import Flask, jsonify, request
from flask_cors import CORS
import yt_dlp
import logging

app = Flask(__name__)
CORS(app)  # Enable CORS for Android app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "yt-dlp-server"})

@app.route('/stream/<video_id>', methods=['GET'])
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

    print("=" * 50)
    print("🎵 yt-dlp Stream Server")
    print("=" * 50)
    print("Server running on http://localhost:5001")
    print("For Android Emulator, use: http://10.0.2.2:5001")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5001, debug=True)
