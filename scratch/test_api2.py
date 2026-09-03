import urllib.request
import json

url = "https://billiards-qr-sessions.vercel.app/api/dashboard-data?b=09bbe759-9c42-4142-9080-8381b003478c&startDate=2026-09-02&endDate=2026-09-02"
req = urllib.request.Request(url)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(data)
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode())
except Exception as e:
    print("Error:", e)
