import urllib.request, json
try:
    resp = urllib.request.urlopen("https://api.invidious.io/instances.json")
    instances = json.loads(resp.read())
    urls = [i[1]['uri'] for i in instances if i[1]['type'] == 'https' and i[1]['api'] == True]
    for url in urls:
        print(f"Testing {url}...")
        try:
            req = urllib.request.urlopen(f"{url}/api/v1/videos/JGwWNGJdvx8", timeout=3)
            data = json.loads(req.read())
            formats = data.get('adaptiveFormats', [])
            audio = [f for f in formats if f.get('type', '').startswith('audio')]
            if audio:
                print(f"SUCCESS: {url}")
                print(f"Found URL: {audio[0]['url'][:50]}")
                break
        except Exception as e:
            print(f"Failed: {e}")
except Exception as e:
    print(f"Fatal error: {e}")
