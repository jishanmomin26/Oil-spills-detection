import sys
import os
import json
import sqlite3
import math
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.db.database import SessionLocal
from app.db.models.vessel import Vessel, VesselTrack, AISPoint
from app.db.models.incident import Incident, OilSpill, OriginEstimate, WeatherObservation, OceanCurrent, DriftSimulation
from app.services.ais_reconstruction import AisReconstructionService
from app.services.behaviour_engine import VesselBehaviourEngine
from app.services.attribution_engine import VesselAttributionEngine
from app.core.behaviour_config import BehaviourConfig
from app.core.attribution_config import AttributionConfig

def audit_single_source_of_truth():
    print("\n============================================================")
    print("1. SINGLE SOURCE OF TRUTH AUDIT")
    print("============================================================")
    db = SessionLocal()
    try:
        incident = db.query(Incident).first()
        spill = db.query(OilSpill).first()
        origin = db.query(OriginEstimate).first()
        vessels = db.query(Vessel).all()
        tracks = db.query(VesselTrack).all()
        pts_count = db.query(AISPoint).count()

        print(f"File/DB: backend/oceantrace.db")
        print(f"Incident: id='{incident.id}', name='{incident.name}', status='{incident.status}', region='{incident.region}'")
        print(f"Spill: id='{spill.id}', area={spill.area_km2} km2, wkt_polygon_len={len(spill.geometry_wkt)} chars")
        print(f"Origin: lat={origin.center_lat}, lon={origin.center_lon}, uncertainty_radius={origin.uncertainty_radius_km} km")
        print(f"Release window: {origin.time_window_start} to {origin.time_window_end}")
        print(f"Vessels count: {len(vessels)} (Candidates: {len([v for v in vessels if v.is_candidate])})")
        print(f"AIS tracks count: {len(tracks)}")
        print(f"AIS points count: {pts_count}")
    finally:
        db.close()

def audit_ais_data():
    print("\n============================================================")
    print("2. CORRECTED AIS DATA VERIFICATION")
    print("============================================================")
    conn = sqlite3.connect('oceantrace.db')
    c = conn.cursor()

    # 1. Coordinate check
    bad_coords = c.execute("SELECT count(*) FROM ais_points WHERE lat < -90 OR lat > 90 OR lon < -180 OR lon > 180").fetchone()[0]
    # 2. Speed check
    bad_speeds = c.execute("SELECT count(*) FROM ais_points WHERE speed_knots < 0 OR speed_knots > 60").fetchone()[0]
    # 3. Heading check
    bad_headings = c.execute("SELECT count(*) FROM ais_points WHERE heading_deg < 0 OR heading_deg > 360").fetchone()[0]
    # 4. Duplicate checks (same vessel, same timestamp)
    dups = c.execute("SELECT vessel_id, timestamp, count(*) FROM ais_points GROUP BY vessel_id, timestamp HAVING count(*) > 1").fetchall()
    # 5. Timestamp chronologies & disconnected trajectories
    vessel_ids = [r[0] for r in c.execute("SELECT DISTINCT vessel_id FROM ais_points").fetchall()]
    chrono_errors = 0
    big_gaps = 0
    impossible_jumps = 0

    for v_id in vessel_ids:
        rows = c.execute("SELECT lat, lon, speed_knots, heading_deg, timestamp FROM ais_points WHERE vessel_id = ? ORDER BY timestamp", (v_id,)).fetchall()
        for i in range(len(rows) - 1):
            t1 = datetime.fromisoformat(rows[i][4])
            t2 = datetime.fromisoformat(rows[i+1][4])
            dt = (t2 - t1).total_seconds()
            if dt <= 0:
                chrono_errors += 1
            # Haversine distance
            lat1, lon1 = math.radians(rows[i][0]), math.radians(rows[i][1])
            lat2, lon2 = math.radians(rows[i+1][0]), math.radians(rows[i+1][1])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
            dist_km = 6371.0 * 2 * math.asin(math.sqrt(max(0.0, min(1.0, a))))
            
            if dt > 0:
                calc_speed_knots = (dist_km / (dt / 3600.0)) / 1.852
                if calc_speed_knots > 70.0:  # Physically impossible for commercial marine vessels
                    impossible_jumps += 1
            if dt > 3600 * 4: # gap > 4 hours
                big_gaps += 1

    print(f"Bad coordinates: {bad_coords}")
    print(f"Bad speeds (outside [0, 60]): {bad_speeds}")
    print(f"Bad headings (outside [0, 360]): {bad_headings}")
    print(f"Duplicate (vessel, timestamp) pairs: {len(dups)}")
    print(f"Chronological inversions: {chrono_errors}")
    print(f"Physically impossible jumps (>70 knots): {impossible_jumps}")
    print(f"Trajectory gaps > 4h: {big_gaps}")

    conn.close()

def audit_phase7_to_phase8():
    print("\n============================================================")
    print("3 & 4. PHASE 7 -> PHASE 8 BEHAVIOUR VERIFICATION")
    print("============================================================")
    db = SessionLocal()
    try:
        incident_id = "OCEANTRACE-DEMO-001"
        origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
        spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()
        candidates = db.query(Vessel).filter(Vessel.is_candidate == True).all()

        detected_event_types = set()
        for v in candidates:
            track = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id, VesselTrack.vessel_id == v.id).first()
            out_tracks, stats = AisReconstructionService.simulate_and_reconstruct([track])
            pts = out_tracks[0]["points"]
            
            profile = VesselBehaviourEngine.analyze_vessel_behaviour(
                vessel=v,
                track_points=pts,
                incident_id=incident_id,
                origin_lat=origin.center_lat,
                origin_lon=origin.center_lon,
                origin_uncertainty_km=origin.uncertainty_radius_km,
                spill_geometry_wkt=spill.geometry_wkt,
            )

            print(f"\nVessel: {v.name} (MMSI: {v.mmsi})")
            print(f"  Track points: {len(pts)} (Reconstructed: {profile['data_quality']['reconstructed_points']})")
            print(f"  Speed profile: min={profile['speed_profile']['min_speed_knots']} kn, max={profile['speed_profile']['max_speed_knots']} kn, avg={profile['speed_profile']['average_speed_knots']} kn")
            print(f"  Spill interaction: entered_zone={profile['spill_interaction']['entered_spill_zone']}, closest_dist={profile['spill_interaction']['closest_approach_distance_km']} km, dwell={profile['spill_interaction']['dwell_time_minutes']} min")
            print(f"  Detected Events ({len(profile['behaviour_events'])}):")
            for ev in profile['behaviour_events']:
                detected_event_types.add(ev['event_type'])
                print(f"    - {ev['event_type']:<18} at {ev['timestamp']} | val={ev['measured_value']} ({ev['threshold']}) | ({ev['latitude']}, {ev['longitude']}) | {ev['explanation']}")

        print(f"\nAll Distinct Event Types Detected Across Candidates: {sorted(list(detected_event_types))}")
    finally:
        db.close()

def audit_metocean_and_incident_params():
    print("\n============================================================")
    print("7 & 8. METOCEAN / DRIFT & INCIDENT PARAMETERS CHECK")
    print("============================================================")
    db = SessionLocal()
    try:
        incident_id = "OCEANTRACE-DEMO-001"
        weather_obs = db.query(WeatherObservation).filter(WeatherObservation.incident_id == incident_id).all()
        currents = db.query(OceanCurrent).filter(OceanCurrent.incident_id == incident_id).all()
        sims = db.query(DriftSimulation).filter(DriftSimulation.incident_id == incident_id).all()
        origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
        spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()

        print(f"Weather observations: {len(weather_obs)} records")
        if weather_obs:
            print(f"  Sample weather: t={weather_obs[0].timestamp}, wind_speed={weather_obs[0].wind_speed_ms} m/s, wind_dir={weather_obs[0].wind_direction_deg} deg, source={weather_obs[0].source}")
        print(f"Ocean currents: {len(currents)} records")
        if currents:
            print(f"  Sample current: t={currents[0].timestamp}, speed={currents[0].speed_ms} m/s, dir={currents[0].direction_deg} deg, source={currents[0].source}")
        print(f"Drift simulations: {len(sims)} records")
        for s in sims:
            print(f"  Sim: type={s.simulation_type}, num_particles={s.num_particles}, wind_coeff={s.wind_drift_coefficient}, diffusion={s.diffusion_coefficient}")

        print(f"\nAuthoritative Incident Origin Verification:")
        print(f"  Origin Lat/Lon: ({origin.center_lat}, {origin.center_lon})")
        print(f"  Origin Uncertainty Radius: {origin.uncertainty_radius_km} km (loaded from OriginEstimate table)")
        print(f"  Release Window: {origin.time_window_start.isoformat()} to {origin.time_window_end.isoformat()}")
        print(f"  Spill Area: {spill.area_km2} km2, Estimated Age: {spill.estimated_age_hours} h, Oil Prob: {spill.oil_probability}")
    finally:
        db.close()

def audit_phase9_and_api():
    print("\n============================================================")
    print("5, 6, 9, 11 & 12. PHASE 9 ATTRIBUTION, API & SENSITIVITY AUDIT")
    print("============================================================")
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    incident_id = "OCEANTRACE-DEMO-001"

    # Test GET attribution
    resp1 = client.get(f"/api/incidents/{incident_id}/vessels/attribution")
    assert resp1.status_code == 200, f"Attribution endpoint failed: {resp1.text}"
    data1 = resp1.json()

    # Reproducibility: Call 3 times
    resp2 = client.get(f"/api/incidents/{incident_id}/vessels/attribution")
    resp3 = client.get(f"/api/incidents/{incident_id}/vessels/attribution")
    data2 = resp2.json()
    data3 = resp3.json()

    scores1 = [(d['vessel_name'], d['overall_score'], d['rank']) for d in data1]
    scores2 = [(d['vessel_name'], d['overall_score'], d['rank']) for d in data2]
    scores3 = [(d['vessel_name'], d['overall_score'], d['rank']) for d in data3]

    print(f"Attribution Reproducibility (3 identical API runs): {scores1 == scores2 == scores3}")
    print("\nCandidate Rankings & Dynamic Evidence Scores (Default Weights):")
    for r in data1:
        print(f"  Rank {r['rank']}: {r['vessel_name']:<18} | Overall: {r['overall_score']:<5} | Relevance: {r['relevance_level']:<8} | Closest: {r['closest_approach_km']} km")
        print(f"    Category Scores: {r['category_scores']}")
        print(f"    Supporting ({len(r['supporting_evidence'])}): {r['supporting_evidence'][0] if r['supporting_evidence'] else 'None'}")
        print(f"    Contradictory ({len(r['contradictory_evidence'])}): {r['contradictory_evidence'][0] if r['contradictory_evidence'] else 'None'}")

    # Tie breaking check
    # Check that sorting order matches: (-overall_score, closest_approach_km, vessel_id)
    print("\nTie Breaking Rule Check:")
    for i in range(len(data1) - 1):
        item_a = data1[i]
        item_b = data1[i+1]
        score_a = item_a['overall_score']
        score_b = item_b['overall_score']
        dist_a = item_a['closest_approach_km'] or 999999
        dist_b = item_b['closest_approach_km'] or 999999
        id_a = str(item_a['vessel_id'])
        id_b = str(item_b['vessel_id'])
        
        valid_sort = (score_a > score_b) or (score_a == score_b and dist_a < dist_b) or (score_a == score_b and dist_a == dist_b and id_a <= id_b)
        print(f"  Comparison Rank {item_a['rank']} ({item_a['vessel_name']}) vs Rank {item_b['rank']} ({item_b['vessel_name']}): Valid={valid_sort}")

    # Weight Adjustment Test
    # Increase Behaviour to 60%, decrease others to 10%
    custom_params = {
        "w_spatial": 0.10,
        "w_temporal": 0.10,
        "w_trajectory": 0.10,
        "w_behaviour": 0.60,
        "w_quality": 0.10,
    }
    resp_mod = client.get(f"/api/incidents/{incident_id}/vessels/attribution", params=custom_params)
    assert resp_mod.status_code == 200
    mod_data = resp_mod.json()
    print("\nModified Weights Attribution (Behaviour 60%, Others 10%):")
    for r in mod_data:
        print(f"  Rank {r['rank']}: {r['vessel_name']:<18} | Overall: {r['overall_score']:<5} | Normalized Weights: {r['weights']}")

    # Individual Vessel Attribution and Behaviour endpoint tests
    cand_id = data1[0]['vessel_id']
    beh_resp = client.get(f"/api/incidents/{incident_id}/vessels/{cand_id}/behaviour")
    assert beh_resp.status_code == 200, f"Behaviour endpoint failed: {beh_resp.text}"
    single_attr = client.get(f"/api/incidents/{incident_id}/vessels/{cand_id}/attribution")
    assert single_attr.status_code == 200, f"Single attribution endpoint failed: {single_attr.text}"
    print(f"\nEndpoint Verification Status:")
    print(f"  GET /api/incidents/{incident_id}/vessels/{cand_id}/behaviour : HTTP {beh_resp.status_code} [OK]")
    print(f"  GET /api/incidents/{incident_id}/vessels/{cand_id}/attribution : HTTP {single_attr.status_code} [OK]")
    print(f"  GET /api/incidents/{incident_id}/vessels/attribution : HTTP {resp1.status_code} [OK]")

if __name__ == "__main__":
    audit_single_source_of_truth()
    audit_ais_data()
    audit_phase7_to_phase8()
    audit_metocean_and_incident_params()
    audit_phase9_and_api()
