import urllib.request
import json

instances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.tokhmi.xyz",
    "https://pipedapi.moomoo.me",
    "https://api.piped.projectsegfau.lt",
    "https://piped-api.garudalinux.org",
    "https://pipedapi.smnz.de",
    "https://pipedapi.r4fo.com"
]

for inst in instances:
    url = f"{inst}/streams/JGwWNGJdvx8"
    try:
        req = urllib.request.urlopen(url, timeout=3)
        data = json.loads(req.read().decode('utf-8'))
        print(f"SUCCESS: {inst}")
        print("Formats:", len(data.get('audioStreams', [])))
        break
    except Exception as e:
        print(f"FAILED {inst}: {str(e)[:50]}")
