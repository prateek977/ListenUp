import urllib.request
import json

YT_API_URL = "https://www.youtube.com/youtubei/v1/player"

def get_stream_url(video_id, client_name, client_version, user_agent):
    print(f"Testing {client_name} {client_version}...")
    
    data = {
        "context": {
            "client": {
                "clientName": client_name,
                "clientVersion": client_version,
                "clientScreen": "WATCH",
                "androidSdkVersion": 30,
                "hl": "en",
                "gl": "US"
            }
        },
        "videoId": video_id,
        "playbackContext": {
            "contentPlaybackContext": {
                "html5Preference": "HTML5_PREF_WANTS"
            }
        }
    }
    
    headers = {
        "User-Agent": user_agent,
        "Content-Type": "application/json"
    }
    
    try:
        json_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(YT_API_URL, data=json_data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            print(f"Status Code: {status_code}")
            
            response_body = response.read().decode("utf-8")
            json_resp = json.loads(response_body)
            
            playability = json_resp.get("playabilityStatus", {})
            status = playability.get("status")
            print(f"Playability Status: {status}")
            
            if status != "OK":
                print(f"Reason: {playability.get('reason')}")
                return

            streaming_data = json_resp.get("streamingData", {})
            if not streaming_data:
                print("No streaming data found.")
                return
                
            formats = streaming_data.get("adaptiveFormats", [])
            print(f"Found {len(formats)} adaptive formats.")
            
            found_url = False
            for fmt in formats:
                mime = fmt.get("mimeType", "")
                if mime.startswith("audio/"):
                    url = fmt.get("url")
                    if url:
                        print(f"Found audio stream! URL length: {len(url)}")
                        found_url = True
                        return url
                        break
            
            if not found_url:
                print("No audio stream with direct URL found (might be using signatureCipher).")
                return None
                
    except urllib.error.HTTPError as e:
         print(f"HTTPError: {e.code} - {e.reason}")
    except Exception as e:
        print(f"Exception: {e}")


# Constants
ANDROID_CLIENT = ("ANDROID", "19.05.36", "com.google.android.youtube/19.05.36 (Linux; U; Android 11; en_US; pixel 5 Build/RQ3A.211001.001)")
IOS_CLIENT_OLD = ("IOS", "19.29.1", "com.google.ios.youtube/19.29.1 (iPhone14,5; U; CPU iOS 17_5_1 like Mac OS X)")
IOS_CLIENT_NEW = ("IOS", "19.45.4", "com.google.ios.youtube/19.45.4 (iPhone14,5; U; CPU iOS 17_5_1 like Mac OS X)")
WEB_REMIX_CLIENT = ("WEB_REMIX", "1.20240730.01.00", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36")


def check_url_access(url, label, user_agent):
    print(f"Checking stream access with {label} UA...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': user_agent}, method="HEAD")
        with urllib.request.urlopen(req) as response:
            print(f"[{response.getcode()}] Success")
            return True
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] Failed: {e.reason}")
        return False
    except Exception as e:
        print(f"[ERR] {e}")
        return False

# Constants
ANDROID_UA = "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36" # Used in PlayerModule
IOS_UA = IOS_CLIENT_NEW[2]

# Test with videos
VIDEOS = [
    ("jfKfPfyJRdk", "Lofi Girl (Live)")
]


for video_id, name in VIDEOS:
    print(f"\n====== Testing Video: {name} ({video_id}) ======")
    
    print("\n--- Testing ANDROID Client ---")
    url = get_stream_url(video_id, *ANDROID_CLIENT)
    
    if url:
        check_url_access(url, "GENERIC_ANDROID (Current App)", ANDROID_UA)


