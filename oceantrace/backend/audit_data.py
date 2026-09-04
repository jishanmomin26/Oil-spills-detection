import sqlite3
from datetime import datetime

conn = sqlite3.connect('oceantrace.db')
c = conn.cursor()

tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("=== TABLES IN OCEATRACE.DB ===")
for t in tables:
    count = c.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {count}")

print("\n=== VESSELS CHECK ===")
vessels = c.execute("SELECT id, mmsi, name, vessel_type, flag_state, is_candidate FROM vessels").fetchall()
names = {}
mmsis = {}
for v in vessels:
    v_id, mmsi, name, v_type, flag, is_cand = v
    names[name] = names.get(name, 0) + 1
    mmsis[mmsi] = mmsis.get(mmsi, 0) + 1

dup_names = {k: v for k, v in names.items() if v > 1}
dup_mmsis = {k: v for k, v in mmsis.items() if v > 1}

print(f"Total vessels: {len(vessels)}")
print(f"Candidate vessels: {len([v for v in vessels if v[5]])}")
print(f"Duplicate names: {dup_names}")
print(f"Duplicate MMSIs: {dup_mmsis}")

print("\n=== CANDIDATE DETAILS ===")
for v in vessels:
    if v[5]: # is_candidate
        print(f"Candidate: {v}")
        pts = c.execute("SELECT count(*), min(lat), max(lat), min(lon), max(lon), min(timestamp), max(timestamp), min(speed_knots), max(speed_knots) FROM ais_points WHERE vessel_id = ?", (v[0],)).fetchone()
        print(f"  Points summary: count={pts[0]}, lat=[{pts[1]}, {pts[2]}], lon=[{pts[3]}, {pts[4]}], time=[{pts[5]} to {pts[6]}], spd=[{pts[7]}, {pts[8]}]")

print("\n=== ALL AIS POINTS SANITY CHECK ===")
bad_coords = c.execute("SELECT count(*) FROM ais_points WHERE lat < -90 OR lat > 90 OR lon < -180 OR lon > 180").fetchone()[0]
bad_speeds = c.execute("SELECT count(*) FROM ais_points WHERE speed_knots < 0 OR speed_knots > 100").fetchone()[0]
bad_headings = c.execute("SELECT count(*) FROM ais_points WHERE heading_deg < 0 OR heading_deg > 360").fetchone()[0]
orphan_pts = c.execute("SELECT count(*) FROM ais_points WHERE vessel_id NOT IN (SELECT id FROM vessels)").fetchone()[0]
print(f"Bad coordinates: {bad_coords}")
print(f"Bad speeds: {bad_speeds}")
print(f"Bad headings: {bad_headings}")
print(f"Orphan points: {orphan_pts}")

print("\n=== BEHAVIOUR ANOMALIES ===")
anoms = c.execute("SELECT vessel_id, anomaly_type, severity, baseline_value, observed_value, deviation, timestamp, lat, lon FROM behaviour_anomalies").fetchall()
for a in anoms:
    v_name = c.execute("SELECT name FROM vessels WHERE id = ?", (a[0],)).fetchone()
    print(f"Anomaly: vessel={v_name[0] if v_name else a[0]} | type={a[1]} | sev={a[2]} | base={a[3]} | obs={a[4]} | dev={a[5]} | time={a[6]} | ({a[7]}, {a[8]})")

print("\n=== ATTRIBUTION SCORES ===")
attrs = c.execute("SELECT rank, vessel_id, overall_score, spatial_score, temporal_score, trajectory_score, behaviour_score, drift_score, confidence FROM attribution_scores ORDER BY rank").fetchall()
for a in attrs:
    v_name = c.execute("SELECT name FROM vessels WHERE id = ?", (a[1],)).fetchone()
    print(f"Rank {a[0]}: {v_name[0] if v_name else a[1]} | overall={a[2]} | spat={a[3]} | temp={a[4]} | traj={a[5]} | beh={a[6]} | drft={a[7]} | conf={a[8]}")

print("\n=== SEED DATA NAMES IN SEED_DEMO.PY ===")
with open("app/demo/seed_demo.py", "r", encoding="utf-8") as f:
    text = f.read()

for cand in ["MT GULF VOYAGER", "MV ARABIAN PEARL", "MT PERSIAN WAVE"]:
    print(f"Occurrences of '{cand}' in seed_demo.py: {text.count(cand)}")
