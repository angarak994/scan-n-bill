import urllib.request
import json
import os

url = "https://erikelecjijchgfibuhk.supabase.co/rest/v1/bookings?select=*"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWtlbGVjamlqY2hnZmlidWhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTczNzc0NCwiZXhwIjoyMDk3MzEzNzQ0fQ.Hz41XTdpLFqnMH5OiXOO28fT8x6XMWEUpNLPHeIAcKc",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWtlbGVjamlqY2hnZmlidWhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTczNzc0NCwiZXhwIjoyMDk3MzEzNzQ0fQ.Hz41XTdpLFqnMH5OiXOO28fT8x6XMWEUpNLPHeIAcKc",
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"Total bookings: {len(data)}")
        for b in data[-3:]: # Print last 3 bookings
            print(b)
except Exception as e:
    print("Error:", e)
