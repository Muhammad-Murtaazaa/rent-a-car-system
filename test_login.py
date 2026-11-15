import urllib.request, urllib.error, json

base_url = 'https://azeem-rent-a-car.omnysync.com'
ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# 1. Login as tenant
login_payload = json.dumps({'tenant_id': 'azeem-rent-a-car', 'username': 'admin', 'password': 'OmnysyncPassword123'}).encode('utf-8')
headers = {'Content-Type': 'application/json', 'User-Agent': ua}
req = urllib.request.Request(f'{base_url}/api/auth/tenant-login', data=login_payload, headers=headers)

with urllib.request.urlopen(req) as resp:
    token = json.loads(resp.read().decode())['access_token']
    print("1. Login OK! Token:", token[:25] + "...")

auth_headers = {
    'Content-Type': 'application/json',
    'User-Agent': ua,
    'Authorization': f'Bearer {token}',
    'X-Tenant-ID': 'azeem-rent-a-car'
}

# 2. Test POST /api/receipts (Issue Official Receipt)
receipt_payload = json.dumps({
    'receipt_type': 'Booking Payment',
    'customer_name': 'Waris Ali',
    'customer_phone': '03034388136',
    'vehicle_info': 'Honda Civic 11 gen',
    'amount': 15000,
    'payment_method': 'Cash',
    'receipt_date': '2026-11-15',
    'notes': 'advance paid'
}).encode('utf-8')
req_rcpt = urllib.request.Request(f'{base_url}/api/receipts', data=receipt_payload, headers=auth_headers)
with urllib.request.urlopen(req_rcpt) as resp:
    rcpt = json.loads(resp.read().decode())
    print("2. Receipt Issued successfully! ID:", rcpt.get('id'), "Receipt#:", rcpt.get('receipt_number'), "Amount:", rcpt.get('amount'))

# 3. Test POST /api/bookings/quick-event (Quick Event & Booking Form)
event_payload = json.dumps({
    'client_name': 'Waris Ali',
    'phone': '03034388136',
    'cnic': '3520289272879',
    'event_date': '2026-11-21',
    'pickup_location': 'Packages Mall',
    'destination_venue': 'PC',
    'event_timing': 'Full Day (9:00 AM - 9:00 PM)',
    'road_plan': 'Ring Road -> Motorway M2 -> Murree Express',
    'fuel_option': 'Without Fuel',
    'car_ids': [],
    'car_quantities': 1,
    'total_rent': 25000,
    'advance_paid': 5000,
    'payment_method': 'Cash'
}).encode('utf-8')
req_evt = urllib.request.Request(f'{base_url}/api/bookings/quick-event', data=event_payload, headers=auth_headers)
with urllib.request.urlopen(req_evt) as resp:
    evt = json.loads(resp.read().decode())
    print("3. Quick Event Booking Created successfully! ID:", evt.get('booking', {}).get('id'), "Customer:", evt.get('booking', {}).get('customer_name'))

print("\nALL VERIFICATIONS PASSED 100%! No 401 Authentication errors!")
