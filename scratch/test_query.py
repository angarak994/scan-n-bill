import urllib.request
import json
import urllib.parse

# Test query for dashboard-data bookings fetch logic
# We saw business_id: 09bbe759-9c42-4142-9080-8381b003478c
businessId = '09bbe759-9c42-4142-9080-8381b003478c'
startDate = '2026-09-01'
endDate = '2026-09-02'

query = urllib.parse.urlencode({
    'select': '*',
    'business_id': f'eq.{businessId}',
    'booking_date': f'gte.{startDate}',
    'booking_date ': f'lte.{endDate}' # wait, requests usually do &booking_date=gte...&booking_date=lte...
})
# Let's just query everything for that business and filter locally to see
url = f"https://erikelecjijchgfibuhk.supabase.co/rest/v1/bookings?business_id=eq.{businessId}"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWtlbGVjamlqY2hnZmlidWhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTczNzc0NCwiZXhwIjoyMDk3MzEzNzQ0fQ.Hz41XTdpLFqnMH5OiXOO28fT8x6XMWEUpNLPHeIAcKc",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyaWtlbGVjamlqY2hnZmlidWhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTczNzc0NCwiZXhwIjoyMDk3MzEzNzQ0fQ.Hz41XTdpLFqnMH5OiXOO28fT8x6XMWEUpNLPHeIAcKc",
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    print("All bookings for this business:")
    for b in data:
        print(f"Date: {b['booking_date']}, Name: {b['customer_name']}, ID: {b['id']}")
