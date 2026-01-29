import urllib.request
import time

PIPED_URLS = [
    "https://pipedapi.kavin.rocks/",
    "https://pipedapi.tokhmi.xyz/",
    "https://pipedapi.moomoo.me/",
    "https://pipedapi.syncpundit.io/",
    "https://api-piped.mha.fi/",
    "https://piped-api.lunar.icu/",
    "https://ytapi.dc09.ru/",
    "https://pipedapi.smnz.de/",
    "https://pipedapi.adminforge.de/",
    "https://api.piped.privacy.com.de/",
    "https://pipedapi.drgns.space/"
]

def check_instance(url):
    try:
        # Piped API usually has a /streams/{videoId} endpoint or similar
        # But we can just check root or a known endpoint like /trends or just root connectivity
        # Actually, let's try a simple health check or root
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        start = time.time()
        with urllib.request.urlopen(req, timeout=5) as response:
            code = response.getcode()
            elapsed = (time.time() - start) * 1000
            print(f"[{code}] {url} - {elapsed:.0f}ms")
            return code == 200
    except Exception as e:
        print(f"[FAIL] {url} - {e}")
        return False

print("Checking Piped Instances...")
valid_count = 0
for url in PIPED_URLS:
    if check_instance(url):
        valid_count += 1

print(f"\nTotal valid instances: {valid_count}/{len(PIPED_URLS)}")
