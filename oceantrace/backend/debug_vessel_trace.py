import httpx
from datetime import datetime

vessels = {v['id']: v for v in httpx.get('http://localhost:8000/api/incidents/OCEANTRACE-DEMO-001/vessels').json()}
tracks = httpx.get('http://localhost:8000/api/incidents/OCEANTRACE-DEMO-001/vessels/tracks').json()
t0 = datetime(2026, 9, 17, 12, 30)

print(f"Auditing vessels at timestamp: {t0}")
for t in tracks:
    v = vessels[t['vessel_id']]
    if v['is_candidate']:
        best = None
        best_d = 999999
        for p in t['points']:
            dt = abs((datetime.fromisoformat(p['timestamp']) - t0).total_seconds())
            if dt < best_d:
                best_d = dt
                best = p
        print(f"Candidate: {v['name']} (ID: {v['id']})")
        print(f"  Nearest point: {best['timestamp']} (delta: {best_d/3600:.1f} hrs)")
        print(f"  Coordinates: lon={best['lon']:.4f}, lat={best['lat']:.4f}")
        print(f"  Within 2hr window? {best_d <= 7200}")
