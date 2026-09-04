import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"

endpoints = [
    ("/health", "Health Check"),
    ("/incidents", "List Incidents"),
    ("/incidents/OCEANTRACE-DEMO-001", "Incident Details"),
    ("/incidents/OCEANTRACE-DEMO-001/spills", "Oil Spills"),
    ("/incidents/OCEANTRACE-DEMO-001/origin", "Origin Estimate"),
    ("/incidents/OCEANTRACE-DEMO-001/drift", "Drift Simulation"),
    ("/incidents/OCEANTRACE-DEMO-001/vessels", "Vessels List"),
    ("/incidents/OCEANTRACE-DEMO-001/vessels/tracks", "Vessel Tracks"),
    ("/incidents/OCEANTRACE-DEMO-001/vessels/filtering", "Filtering Funnel"),
    ("/incidents/OCEANTRACE-DEMO-001/vessels/reconstruction", "AIS Reconstruction Stats"),
    ("/incidents/OCEANTRACE-DEMO-001/weather", "Weather Observations"),
    ("/incidents/OCEANTRACE-DEMO-001/currents", "Ocean Currents"),
    ("/incidents/OCEANTRACE-DEMO-001/forecast", "Drift Forecast"),
    ("/incidents/OCEANTRACE-DEMO-001/evidence", "Evidence Items"),
    ("/incidents/OCEANTRACE-DEMO-001/timeline", "Investigation Timeline (Phase 10)"),
    ("/incidents/OCEANTRACE-DEMO-001/timeline?category=BEHAVIOUR", "Timeline (Cat: BEHAVIOUR)"),
    ("/incidents/OCEANTRACE-DEMO-001/timeline?category=SPILL", "Timeline (Cat: SPILL)"),
    ("/incidents/OCEANTRACE-DEMO-001/vessels/filter?max_distance_km=40", "Dynamic Filter (40km)"),
    ("/incidents/OCEANTRACE-DEMO-001/vessels/attribution", "Ranked Attributions (Phase 9)"),
    ("/incidents/OCEANTRACE-DEMO-001/satellite", "Satellite Analysis (Phase 11)"),
]

print("=== LIVE API ENDPOINT TESTING ===")
all_passed = True

for path, label in endpoints:
    url = BASE_URL + path
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'OCEANTRACE-Test'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.status
            data = json.loads(resp.read().decode('utf-8'))
            
            summary = ""
            if isinstance(data, list):
                summary = f"[{len(data)} items]"
            elif isinstance(data, dict):
                summary = f"[{len(data.keys())} keys: {list(data.keys())[:4]}]"
                
            print(f"[OK] {status} | {label:<25} | {path:<45} | {summary}")
    except Exception as e:
        all_passed = False
        print(f"[FAIL] | {label:<25} | {path:<45} | Error: {e}")

print(f"\nFinal Standard API Status: {'ALL PASSED' if all_passed else 'SOME FAILED'}")

print("\n=== TESTING CANDIDATE VESSEL INTELLIGENCE ENDPOINT ===")
req = urllib.request.Request(BASE_URL + "/incidents/OCEANTRACE-DEMO-001/vessels")
with urllib.request.urlopen(req) as resp:
    vessels = json.loads(resp.read().decode('utf-8'))
    candidates = [v for v in vessels if v.get('is_candidate')]
    print(f"Verified {len(candidates)} candidates in live response:")
    for cand in candidates:
        v_id = cand['id']
        name = cand['name']
        intel_url = f"{BASE_URL}/incidents/OCEANTRACE-DEMO-001/vessels/{v_id}/intelligence"
        with urllib.request.urlopen(intel_url) as i_resp:
            intel = json.loads(i_resp.read().decode('utf-8'))
            prox = intel.get('proximity', {})
            enc = intel.get('encounter', {})
            events = intel.get('events', [])
            print(f"  [OK] {name:<18} (MMSI: {cand['mmsi']}) | Min Dist: {prox.get('min_distance_km'):.2f} km | Spill Encounter: {enc.get('entered_spill_zone')} | Events: {len(events)}")

