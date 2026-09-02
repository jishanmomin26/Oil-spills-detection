"""
OCEANTRACE AI — Deterministic Demo Data Seeder

Generates the complete OCEANTRACE-DEMO-001 investigation scenario in the Arabian Sea.
Uses fixed random seed so data is reproducible across runs.

ALL DATA IS FICTIONAL / SIMULATED.
"""
import os
import sys
import uuid
import math
import random
from datetime import datetime, timedelta, timezone

# Ensure app package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.db.database import engine, SessionLocal, Base
from app.db.models import (
    DataProvenance, Incident, SatelliteObservation, OilSpill,
    WeatherObservation, OceanCurrent, DriftSimulation, DriftParticle,
    OriginEstimate, Evidence, InvestigationTimelineEvent,
    Vessel, VesselTrack, AISPoint, BehaviourAnomaly,
    AttributionScore, TrajectoryAnalysis, FilteringResult,
)

SEED = 42
random.seed(SEED)

# ── Constants ───────────────────────────────────────────────
INCIDENT_ID = "OCEANTRACE-DEMO-001"
NOW = datetime(2026, 9, 17, 6, 0, 0, tzinfo=timezone.utc)  # T0 — satellite observation time
SPILL_CENTER_LAT = 15.525
SPILL_CENTER_LON = 65.525
ORIGIN_LAT = 15.58  # ~6 km north of spill center
ORIGIN_LON = 65.48  # ~5 km west of spill center

VESSEL_TYPES = ["tanker", "cargo", "container", "fishing", "passenger", "tug", "service", "other"]
FLAG_STATES = ["PA", "LR", "MH", "SG", "IN", "AE", "MT", "BS", "HK", "GR"]

# Fictional vessel names
VESSEL_NAMES = [
    "MV OCEAN STAR", "MV ARABIAN PEARL", "MT GULF VOYAGER",
    "MV CORAL BREEZE", "MT DESERT WIND", "MV SAPPHIRE TIDE",
    "MV HORIZON GLORY", "MT PERSIAN WAVE", "MV JADE NAVIGATOR",
    "MV CRIMSON HORIZON", "MV SILVER ANCHOR", "MT OCEAN THUNDER",
    "MV MONSOON DRIFT", "MV COAST GUARDIAN", "MT INDIGO FLAME",
    "MV BLUE MARINER", "MV TROPICAL DAWN", "MT KARACHI EXPRESS",
    "MV MUMBAI MERCHANT", "MV COLOMBO CARRIER", "MT ARABIAN NIGHT",
    "MV FUJAIRAH STAR", "MV SHARJAH SPIRIT", "MT MALABAR COAST",
    "MV DHOW MASTER", "MV SPICE TRADER", "MT KONKAN PASSAGE",
    "MV LACCADIVE SEA", "MV OMAN PRIDE", "MT SALALAH SUNRISE",
    "MV DJIBOUTI EXPRESS", "MV ADEN PILOT", "MT SOCOTRA WIND",
    "MV MALDIVE PEARL", "MV COCHIN CARRIER", "MT GOA GUARDIAN",
    "MV MANGALORE MIST", "MV KANDLA KING", "MT MUNDRA MONARCH",
    "MV PORBANDAR PRINCE", "MV VERAVAL VENTURE", "MT DIU DIAMOND",
    "MV MARMAGOA MARVEL", "MV VIZAG VOYAGER", "MT KAKINADA KEEL",
    "MV PARADIP PIONEER", "MV HALDIA HARBOUR",
]


def uid() -> str:
    return str(uuid.uuid4())


def wkt_point(lon: float, lat: float) -> str:
    return f"POINT({lon} {lat})"


def wkt_polygon_circle(lon: float, lat: float, radius_deg: float, n: int = 32) -> str:
    coords = []
    for i in range(n + 1):
        angle = 2.0 * math.pi * i / n
        px = lon + radius_deg * math.cos(angle)
        py = lat + radius_deg * 0.7 * math.sin(angle)  # slight ellipse
        coords.append(f"{px:.6f} {py:.6f}")
    return f"POLYGON(({', '.join(coords)}))"


def wkt_polygon_irregular(lon: float, lat: float, radius_deg: float) -> str:
    """Generate an irregular polygon (realistic spill shape)."""
    coords = []
    n = 24
    for i in range(n + 1):
        angle = 2.0 * math.pi * (i % n) / n
        r = radius_deg * (0.6 + 0.4 * random.random())
        px = lon + r * math.cos(angle) * 1.4  # elongated
        py = lat + r * math.sin(angle)
        coords.append(f"{px:.6f} {py:.6f}")
    return f"POLYGON(({', '.join(coords)}))"


def generate_vessel_route(
    start_lat: float, start_lon: float,
    end_lat: float, end_lon: float,
    start_time: datetime,
    num_points: int = 48,
    speed_knots: float = 12.0,
    course_noise_deg: float = 5.0,
    speed_noise_knots: float = 2.0,
) -> list[dict]:
    """Generate a realistic AIS track between two points with noise."""
    points = []
    dt = timedelta(hours=48) / num_points  # 48 hours of track, uniform spacing
    lat, lon = start_lat, start_lon
    dlat = (end_lat - start_lat) / num_points
    dlon = (end_lon - start_lon) / num_points
    base_course = math.degrees(math.atan2(end_lon - start_lon, end_lat - start_lat)) % 360

    for i in range(num_points):
        t = start_time + dt * i
        noise_lat = random.gauss(0, 0.002)
        noise_lon = random.gauss(0, 0.002)
        lat_i = start_lat + dlat * i + noise_lat
        lon_i = start_lon + dlon * i + noise_lon
        spd = max(0.5, speed_knots + random.gauss(0, speed_noise_knots))
        crs = (base_course + random.gauss(0, course_noise_deg)) % 360
        points.append(dict(
            timestamp=t,
            lat=round(lat_i, 6),
            lon=round(lon_i, 6),
            speed_knots=round(spd, 1),
            course_deg=round(crs, 1),
            heading_deg=round(crs + random.gauss(0, 2), 1) % 360,
        ))
    return points


# ════════════════════════════════════════════════════════════
# SEED FUNCTION
# ════════════════════════════════════════════════════════════

def seed():
    random.seed(SEED)

    print("==================================================")
    print("   OCEANTRACE AI -- Demo Data Seeder")
    print("==================================================")

    # Reset DB
    print("  -> Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("  -> Creating all tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        _seed_incident(db); db.flush()
        _seed_satellite(db); db.flush()
        _seed_spill(db); db.flush()
        _seed_weather(db); db.flush()
        _seed_ocean_currents(db); db.flush()
        _seed_drift_hindcast(db); db.flush()
        _seed_origin(db); db.flush()
        _seed_drift_forecast(db); db.flush()
        _seed_vessels(db); db.flush()
        _seed_anomalies(db); db.flush()
        _seed_filtering(db); db.flush()
        _seed_trajectory_analysis(db); db.flush()
        _seed_attribution(db); db.flush()
        _seed_evidence(db); db.flush()
        _seed_timeline(db); db.flush()
        db.commit()
        print("\n  [OK] Seeding completed successfully.")
        _print_summary(db)
    except Exception as e:
        db.rollback()
        print(f"\n  [FAIL] Seeding failed: {e}")
        raise
    finally:
        db.close()


# ── Individual seeders ──────────────────────────────────────

def _seed_incident(db):
    print("  -> Seeding incident...")
    db.add(Incident(
        id=INCIDENT_ID,
        name="Arabian Sea Oil Spill — DEMO",
        description=(
            "Demonstration investigation scenario: A satellite-detected dark anomaly "
            "in the Arabian Sea is analysed through the full OCEANTRACE AI pipeline. "
            "ALL DATA IS FICTIONAL / SIMULATED."
        ),
        status="UNDER_INVESTIGATION",
        region="Arabian Sea",
        created_at=NOW,
        updated_at=NOW,
    ))


def _seed_satellite(db):
    print("  -> Seeding satellite observation...")
    prov_id = uid()
    db.add(DataProvenance(
        id=prov_id,
        source_type="satellite",
        source_name="DemoSatelliteProvider",
        source_timestamp=NOW,
        algorithm_name="prototype_sar_processor",
        algorithm_version="1.0.0-prototype",
        result_type="satellite_observation",
        confidence=0.95,
        is_simulated=True,
        classification="SIMULATED",
        notes="Simulated Sentinel-1 SAR observation for demonstration.",
    ))
    db.add(SatelliteObservation(
        id=uid(),
        incident_id=INCIDENT_ID,
        platform="Sentinel-1A",
        sensor="SAR-C / IW",
        acquisition_time=NOW,
        resolution_m=10.0,
        bounds_wkt="POLYGON((64.5 14.5, 66.5 14.5, 66.5 16.5, 64.5 16.5, 64.5 14.5))",
        processing_status="COMPLETED",
        provenance_id=prov_id,
    ))


def _seed_spill(db):
    print("  -> Seeding oil spill...")
    random.seed(SEED + 1)
    spill_geom = wkt_polygon_irregular(SPILL_CENTER_LON, SPILL_CENTER_LAT, 0.04)
    prov_id = uid()
    db.add(DataProvenance(
        id=prov_id,
        source_type="algorithm",
        source_name="prototype_spill_detector",
        algorithm_name="threshold_segmentation",
        algorithm_version="1.0.0-prototype",
        result_type="spill_detection",
        confidence=0.91,
        is_simulated=True,
        classification="DERIVED",
        notes="Spill polygon derived from simulated SAR observation using prototype segmentation.",
    ))
    obs = db.query(SatelliteObservation).first()
    db.add(OilSpill(
        id=uid(),
        incident_id=INCIDENT_ID,
        observation_id=obs.id if obs else None,
        geometry_wkt=spill_geom,
        centroid_wkt=wkt_point(SPILL_CENTER_LON, SPILL_CENTER_LAT),
        area_km2=18.6,
        perimeter_km=22.4,
        length_km=7.8,
        width_km=2.4,
        aspect_ratio=3.25,
        orientation_deg=61.0,
        compactness=0.47,
        estimated_age_hours=18.0,
        confidence=0.91,
        detection_method="prototype_segmentation",
        oil_probability=0.91,
        low_wind_probability=0.04,
        ship_wake_probability=0.02,
        rain_artifact_probability=0.02,
        biological_film_probability=0.01,
        provenance_id=prov_id,
    ))


def _seed_weather(db):
    print("  -> Seeding weather observations...")
    # Generate weather for 48h window around T0 at 3h intervals
    for h in range(-24, 25, 3):
        t = NOW + timedelta(hours=h)
        wind_speed = 5.0 + 2.0 * math.sin(h / 12.0 * math.pi) + random.gauss(0, 0.3)
        wind_dir = 225.0 + 15.0 * math.sin(h / 24.0 * math.pi) + random.gauss(0, 3)
        db.add(WeatherObservation(
            id=uid(),
            incident_id=INCIDENT_ID,
            timestamp=t,
            location_wkt=wkt_point(SPILL_CENTER_LON, SPILL_CENTER_LAT),
            wind_speed_ms=round(max(0.5, wind_speed), 2),
            wind_direction_deg=round(wind_dir % 360, 1),
            temperature_c=round(29.0 + random.gauss(0, 0.5), 1),
            wave_height_m=round(1.2 + random.gauss(0, 0.2), 2),
            source="DemoWeatherProvider",
        ))


def _seed_ocean_currents(db):
    print("  -> Seeding ocean currents...")
    for h in range(-24, 25, 3):
        t = NOW + timedelta(hours=h)
        speed = 0.3 + 0.15 * math.sin(h / 12.0 * math.pi) + random.gauss(0, 0.02)
        direction = 195.0 + 10.0 * math.sin(h / 24.0 * math.pi) + random.gauss(0, 2)
        db.add(OceanCurrent(
            id=uid(),
            incident_id=INCIDENT_ID,
            timestamp=t,
            location_wkt=wkt_point(SPILL_CENTER_LON, SPILL_CENTER_LAT),
            speed_ms=round(max(0.05, speed), 3),
            direction_deg=round(direction % 360, 1),
            depth_m=0.0,
            source="DemoOceanProvider",
        ))


def _seed_drift_hindcast(db):
    print("  -> Seeding hindcast drift simulation...")
    sim_id = uid()
    prov_id = uid()
    db.add(DataProvenance(
        id=prov_id,
        source_type="model",
        source_name="prototype_drift_engine",
        algorithm_name="lagrangian_particle_drift",
        algorithm_version="1.0.0-prototype",
        result_type="hindcast_simulation",
        confidence=0.72,
        is_simulated=True,
        classification="MODELLED",
    ))
    db.add(DriftSimulation(
        id=sim_id,
        incident_id=INCIDENT_ID,
        simulation_type="HINDCAST",
        start_time=NOW,
        end_time=NOW - timedelta(hours=24),
        start_location_wkt=wkt_point(SPILL_CENTER_LON, SPILL_CENTER_LAT),
        wind_drift_coefficient=0.03,
        diffusion_coefficient=100.0,
        num_particles=50,
        parameters={"wind_factor": 0.03, "diffusion": 100.0, "dt_hours": 1},
        provenance_id=prov_id,
    ))
    # Generate backward particles
    random.seed(SEED + 10)
    for p_idx in range(50):
        lat, lon = SPILL_CENTER_LAT, SPILL_CENTER_LON
        for h in range(0, 25):
            t = NOW - timedelta(hours=h)
            # Reverse of wind+current effect -> particles move roughly NW (backward)
            dlat = 0.002 + random.gauss(0, 0.001)
            dlon = -0.002 + random.gauss(0, 0.001)
            lat += dlat
            lon += dlon
            db.add(DriftParticle(
                id=uid(),
                simulation_id=sim_id,
                particle_index=p_idx,
                timestamp=t,
                lat=round(lat, 6),
                lon=round(lon, 6),
                location_wkt=wkt_point(round(lon, 6), round(lat, 6)),
            ))


def _seed_origin(db):
    print("  -> Seeding origin estimate...")
    prov_id = uid()
    db.add(DataProvenance(
        id=prov_id,
        source_type="model",
        source_name="prototype_drift_engine",
        algorithm_name="particle_density_estimation",
        result_type="origin_estimate",
        confidence=0.72,
        is_simulated=True,
        classification="MODELLED",
    ))
    ellipse = wkt_polygon_circle(ORIGIN_LON, ORIGIN_LAT, 0.08)
    sim = db.query(DriftSimulation).filter_by(simulation_type="HINDCAST").first()
    db.add(OriginEstimate(
        id=uid(),
        incident_id=INCIDENT_ID,
        simulation_id=sim.id if sim else None,
        center_lat=ORIGIN_LAT,
        center_lon=ORIGIN_LON,
        center_wkt=wkt_point(ORIGIN_LON, ORIGIN_LAT),
        uncertainty_radius_km=8.4,
        ellipse_wkt=ellipse,
        probability=0.72,
        time_window_start=NOW - timedelta(hours=21),
        time_window_end=NOW - timedelta(hours=15),
        provenance_id=prov_id,
    ))


def _seed_drift_forecast(db):
    print("  -> Seeding forecast drift simulation...")
    sim_id = uid()
    db.add(DriftSimulation(
        id=sim_id,
        incident_id=INCIDENT_ID,
        simulation_type="FORECAST",
        start_time=NOW,
        end_time=NOW + timedelta(hours=48),
        start_location_wkt=wkt_point(SPILL_CENTER_LON, SPILL_CENTER_LAT),
        wind_drift_coefficient=0.03,
        num_particles=30,
        parameters={"wind_factor": 0.03, "diffusion": 100.0},
    ))
    random.seed(SEED + 20)
    for p_idx in range(30):
        lat, lon = SPILL_CENTER_LAT, SPILL_CENTER_LAT
        lat, lon = SPILL_CENTER_LAT, SPILL_CENTER_LON
        for h in range(0, 49, 1):
            t = NOW + timedelta(hours=h)
            dlat = -0.003 + random.gauss(0, 0.0015)
            dlon = 0.002 + random.gauss(0, 0.0015)
            lat += dlat
            lon += dlon
            db.add(DriftParticle(
                id=uid(),
                simulation_id=sim_id,
                particle_index=p_idx,
                timestamp=t,
                lat=round(lat, 6),
                lon=round(lon, 6),
                location_wkt=wkt_point(round(lon, 6), round(lat, 6)),
            ))


def _seed_vessels(db):
    print("  -> Seeding vessels & AIS tracks...")
    random.seed(SEED + 100)
    num_vessels = 47

    # 3 candidate vessels that will pass all filters
    candidates_config = [
        {   # Candidate A — strongest match: passed through origin zone at right time
            "name": "MT GULF VOYAGER",
            "type": "tanker",
            "start": (16.0, 64.8),
            "end": (14.8, 66.5),
            "speed": 11.0,
            "flag": "PA",
            "is_candidate": True,
        },
        {   # Candidate B — moderate match
            "name": "MV ARABIAN PEARL",
            "type": "cargo",
            "start": (15.9, 64.5),
            "end": (15.0, 66.8),
            "speed": 13.0,
            "flag": "LR",
            "is_candidate": True,
        },
        {   # Candidate C — weaker match
            "name": "MT PERSIAN WAVE",
            "type": "tanker",
            "start": (16.2, 65.0),
            "end": (14.5, 66.0),
            "speed": 10.0,
            "flag": "MH",
            "is_candidate": True,
        },
    ]

    all_vessel_ids = []

    # ── Generate candidate vessels ──
    for i, cfg in enumerate(candidates_config):
        v_id = uid()
        mmsi = f"3{i+1:02d}{random.randint(100000, 999999)}"
        all_vessel_ids.append(v_id)

        db.add(Vessel(
            id=v_id,
            mmsi=mmsi,
            name=cfg["name"],
            vessel_type=cfg["type"],
            flag_state=cfg["flag"],
            length_m=round(180 + random.random() * 100, 1),
            width_m=round(28 + random.random() * 12, 1),
            destination="Mundra" if i % 2 == 0 else "Fujairah",
            is_candidate=True,
        ))

        # Track for 48h centred around T0 — candidates pass near origin zone
        track_start = NOW - timedelta(hours=24)
        points = generate_vessel_route(
            cfg["start"][0], cfg["start"][1],
            cfg["end"][0], cfg["end"][1],
            track_start,
            num_points=48,
            speed_knots=cfg["speed"],
        )

        track_id = uid()
        linestring_coords = ", ".join(f"{p['lon']} {p['lat']}" for p in points)
        db.add(VesselTrack(
            id=track_id,
            vessel_id=v_id,
            incident_id=INCIDENT_ID,
            start_time=points[0]["timestamp"],
            end_time=points[-1]["timestamp"],
            trajectory_wkt=f"LINESTRING({linestring_coords})",
        ))

        for p in points:
            db.add(AISPoint(
                id=uid(),
                track_id=track_id,
                vessel_id=v_id,
                timestamp=p["timestamp"],
                lat=p["lat"],
                lon=p["lon"],
                location_wkt=wkt_point(p["lon"], p["lat"]),
                speed_knots=p["speed_knots"],
                course_deg=p["course_deg"],
                heading_deg=p["heading_deg"],
            ))

    # ── Generate remaining vessels (not candidates) ──
    for i in range(3, num_vessels):
        v_id = uid()
        mmsi = f"2{i:03d}{random.randint(10000, 99999)}"
        name = VESSEL_NAMES[i] if i < len(VESSEL_NAMES) else f"MV DEMO-{i:03d}"
        vtype = random.choice(VESSEL_TYPES)

        # Place routes at varying distances from the spill area
        dist_factor = random.uniform(0.3, 3.0)
        angle = random.uniform(0, 2 * math.pi)
        center_lat = SPILL_CENTER_LAT + dist_factor * math.sin(angle)
        center_lon = SPILL_CENTER_LON + dist_factor * math.cos(angle)

        start_lat = center_lat + random.uniform(-0.5, 0.5)
        start_lon = center_lon + random.uniform(-0.5, 0.5)
        end_lat = center_lat + random.uniform(-0.5, 0.5)
        end_lon = center_lon + random.uniform(-0.5, 0.5)

        db.add(Vessel(
            id=v_id,
            mmsi=mmsi,
            name=name,
            vessel_type=vtype,
            flag_state=random.choice(FLAG_STATES),
            length_m=round(50 + random.random() * 250, 1),
            width_m=round(8 + random.random() * 30, 1),
            destination=random.choice(["Mumbai", "Karachi", "Fujairah", "Salalah", "Djibouti", "Cochin"]),
            is_candidate=False,
        ))
        all_vessel_ids.append(v_id)

        track_start = NOW - timedelta(hours=24)
        points = generate_vessel_route(
            start_lat, start_lon, end_lat, end_lon,
            track_start,
            num_points=random.randint(20, 48),
            speed_knots=random.uniform(6, 18),
        )

        track_id = uid()
        linestring_coords = ", ".join(f"{p['lon']} {p['lat']}" for p in points)
        db.add(VesselTrack(
            id=track_id,
            vessel_id=v_id,
            incident_id=INCIDENT_ID,
            start_time=points[0]["timestamp"],
            end_time=points[-1]["timestamp"],
            trajectory_wkt=f"LINESTRING({linestring_coords})",
        ))
        for p in points:
            db.add(AISPoint(
                id=uid(),
                track_id=track_id,
                vessel_id=v_id,
                timestamp=p["timestamp"],
                lat=p["lat"],
                lon=p["lon"],
                location_wkt=wkt_point(p["lon"], p["lat"]),
                speed_knots=p["speed_knots"],
                course_deg=p["course_deg"],
                heading_deg=p["heading_deg"],
            ))


def _seed_anomalies(db):
    print("  -> Seeding behavioural anomalies...")
    candidates = db.query(Vessel).filter(Vessel.is_candidate == True).all()

    anomaly_templates = [
        ("speed_reduction", "HIGH", 12.0, 3.5, "Vessel reduced speed from {baseline} to {observed} knots near probable origin zone."),
        ("course_deviation", "HIGH", 220.0, 185.0, "Vessel deviated course by {dev}° near probable origin zone."),
        ("loitering", "MEDIUM", 11.0, 2.0, "Vessel showed loitering behaviour (speed {observed} knots) for approximately 45 minutes."),
    ]

    for i, vessel in enumerate(candidates):
        tmpl = anomaly_templates[i % len(anomaly_templates)]
        atype, severity, baseline, observed, expl_tmpl = tmpl
        dev = abs(baseline - observed)
        explanation = expl_tmpl.format(baseline=baseline, observed=observed, dev=round(dev, 1))
        
        # Place anomaly timestamp in the estimated spill time window
        anom_time = NOW - timedelta(hours=random.uniform(15, 21))
        anom_lat = ORIGIN_LAT + random.gauss(0, 0.02)
        anom_lon = ORIGIN_LON + random.gauss(0, 0.02)

        db.add(BehaviourAnomaly(
            id=uid(),
            vessel_id=vessel.id,
            incident_id=INCIDENT_ID,
            timestamp=anom_time,
            anomaly_type=atype,
            severity=severity,
            baseline_value=baseline,
            observed_value=observed,
            deviation=round(dev, 2),
            explanation=explanation,
            lat=round(anom_lat, 6),
            lon=round(anom_lon, 6),
            location_wkt=wkt_point(round(anom_lon, 6), round(anom_lat, 6)),
        ))

    # Add a second anomaly for candidate A (strongest)
    cand_a = candidates[0]
    db.add(BehaviourAnomaly(
        id=uid(),
        vessel_id=cand_a.id,
        incident_id=INCIDENT_ID,
        timestamp=NOW - timedelta(hours=17),
        anomaly_type="unexpected_stop",
        severity="HIGH",
        baseline_value=11.0,
        observed_value=0.2,
        deviation=10.8,
        explanation="Vessel came to near-complete stop for approximately 20 minutes within probable origin zone.",
        lat=round(ORIGIN_LAT + 0.005, 6),
        lon=round(ORIGIN_LON - 0.003, 6),
        location_wkt=wkt_point(round(ORIGIN_LON - 0.003, 6), round(ORIGIN_LAT + 0.005, 6)),
    ))


def _seed_filtering(db):
    print("  -> Seeding filtering results...")
    vessels = db.query(Vessel).all()
    candidates = [v for v in vessels if v.is_candidate]
    non_candidates = [v for v in vessels if not v.is_candidate]

    random.seed(SEED + 200)

    # Spatial filter — ~12 pass
    spatially_relevant = list(candidates)  # all 3 candidates pass
    spatial_passers = random.sample(non_candidates, min(9, len(non_candidates)))
    spatially_relevant.extend(spatial_passers)
    spatial_failers = [v for v in non_candidates if v not in spatial_passers]

    for v in spatial_failers:
        dist = round(random.uniform(50, 200), 1)
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="spatial", passed=False,
            reason=f"Distance from probable origin zone ({dist} km) exceeds threshold (40 km).",
            metric_name="distance_to_origin_km", metric_value=dist, threshold=40.0,
        ))
    for v in spatially_relevant:
        dist = round(random.uniform(2, 35), 1)
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="spatial", passed=True,
            reason=f"Within spatial threshold ({dist} km ≤ 40 km).",
            metric_name="distance_to_origin_km", metric_value=dist, threshold=40.0,
        ))

    # Temporal filter — 6 pass
    temporally_relevant = list(candidates)
    temp_passers = random.sample(spatial_passers, min(3, len(spatial_passers)))
    temporally_relevant.extend(temp_passers)
    temp_failers = [v for v in spatial_passers if v not in temp_passers]

    for v in temp_failers:
        gap = round(random.uniform(8, 20), 1)
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="temporal", passed=False,
            reason=f"Temporal gap ({gap} hours) from estimated spill-time window exceeds threshold (6 hours).",
            metric_name="temporal_gap_hours", metric_value=gap, threshold=6.0,
        ))
    for v in temporally_relevant:
        gap = round(random.uniform(0, 5), 1)
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="temporal", passed=True,
            reason=f"Within temporal window ({gap} hours ≤ 6 hours).",
            metric_name="temporal_gap_hours", metric_value=gap, threshold=6.0,
        ))

    # Trajectory filter — 4 pass
    traj_relevant = list(candidates)
    traj_passers = random.sample(temp_passers, min(1, len(temp_passers)))
    traj_relevant.extend(traj_passers)
    traj_failers = [v for v in temp_passers if v not in traj_passers]

    for v in traj_failers:
        score = round(random.uniform(10, 39), 1)
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="trajectory", passed=False,
            reason=f"Trajectory correlation score ({score}) below threshold (40).",
            metric_name="trajectory_score", metric_value=score, threshold=40.0,
        ))
    for v in traj_relevant:
        score = round(random.uniform(55, 95), 1)
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="trajectory", passed=True,
            reason=f"Trajectory correlation score ({score}) above threshold (40).",
            metric_name="trajectory_score", metric_value=score, threshold=40.0,
        ))

    # Behaviour filter — 3 pass (all 3 candidates)
    for v in traj_passers:  # the non-candidate that passed trajectory
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="behaviour", passed=False,
            reason="No significant behavioural anomalies detected.",
            metric_name="anomaly_count", metric_value=0, threshold=1.0,
        ))
    for v in candidates:
        db.add(FilteringResult(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=v.id,
            stage="behaviour", passed=True,
            reason="Behavioural anomaly detected near probable origin zone.",
            metric_name="anomaly_count", metric_value=1, threshold=1.0,
        ))


def _seed_trajectory_analysis(db):
    print("  -> Seeding trajectory analysis...")
    candidates = db.query(Vessel).filter(Vessel.is_candidate == True).all()

    configs = [
        dict(min_d=1.8, d_spill=3.2, head=92, spd=88, route=91, traj=90, time=95, intersect=True),
        dict(min_d=5.2, d_spill=8.1, head=78, spd=82, route=74, traj=76, time=80, intersect=True),
        dict(min_d=8.7, d_spill=12.4, head=68, spd=71, route=62, traj=65, time=70, intersect=False),
    ]

    for vessel, cfg in zip(candidates, configs):
        db.add(TrajectoryAnalysis(
            id=uid(),
            incident_id=INCIDENT_ID,
            vessel_id=vessel.id,
            min_distance_to_origin_km=cfg["min_d"],
            distance_at_spill_time_km=cfg["d_spill"],
            heading_compatibility=cfg["head"],
            speed_compatibility=cfg["spd"],
            route_intersection_score=cfg["route"],
            trajectory_similarity=cfg["traj"],
            time_compatibility=cfg["time"],
            origin_zone_intersection=cfg["intersect"],
        ))


def _seed_attribution(db):
    print("  -> Seeding attribution scores...")
    candidates = db.query(Vessel).filter(Vessel.is_candidate == True).all()

    default_weights = {"spatial": 0.30, "temporal": 0.25, "trajectory": 0.20, "behaviour": 0.15, "drift": 0.10}

    configs = [
        dict(
            spatial=92, temporal=89, trajectory=91, behaviour=78, drift=85,
            confidence=0.84,
            supporting=["Passed within origin uncertainty zone",
                         "Timing overlaps estimated release window",
                         "Track direction is compatible with origin-to-spill movement",
                         "High trajectory similarity score",
                         "Behavioural anomaly: unexpected stop in origin zone"],
            contradictory=["AIS gap during part of the relevant period",
                            "Origin uncertainty remains significant (8.4 km radius)"],
            missing=["Cargo manifest not available", "Port departure records not verified"],
        ),
        dict(
            spatial=78, temporal=82, trajectory=74, behaviour=65, drift=71,
            confidence=0.68,
            supporting=["Passed near origin zone", "Timing partially overlaps release window"],
            contradictory=["Did not enter origin uncertainty zone directly",
                            "Trajectory deviation less consistent"],
            missing=["AIS coverage incomplete", "Historical behaviour baseline unavailable"],
        ),
        dict(
            spatial=68, temporal=71, trajectory=62, behaviour=58, drift=55,
            confidence=0.52,
            supporting=["Spatially proximate to origin zone"],
            contradictory=["Passed origin zone boundary but did not enter",
                            "Timing less consistent",
                            "No strong behavioural anomaly"],
            missing=["Vessel inspection records unavailable"],
        ),
    ]

    for rank_idx, (vessel, cfg) in enumerate(zip(candidates, configs)):
        overall = (
            cfg["spatial"] * default_weights["spatial"]
            + cfg["temporal"] * default_weights["temporal"]
            + cfg["trajectory"] * default_weights["trajectory"]
            + cfg["behaviour"] * default_weights["behaviour"]
            + cfg["drift"] * default_weights["drift"]
        )
        db.add(AttributionScore(
            id=uid(),
            incident_id=INCIDENT_ID,
            vessel_id=vessel.id,
            rank=rank_idx + 1,
            overall_score=round(overall, 1),
            spatial_score=cfg["spatial"],
            temporal_score=cfg["temporal"],
            trajectory_score=cfg["trajectory"],
            behaviour_score=cfg["behaviour"],
            drift_score=cfg["drift"],
            confidence=cfg["confidence"],
            weights=default_weights,
            supporting_evidence=cfg["supporting"],
            contradictory_evidence=cfg["contradictory"],
            missing_evidence=cfg["missing"],
        ))


def _seed_evidence(db):
    print("  -> Seeding evidence items...")
    candidates = db.query(Vessel).filter(Vessel.is_candidate == True).all()

    # Incident-level evidence
    evidence_items = [
        dict(etype="SATELLITE", source="DemoSatelliteProvider", conf=0.95,
             rel="HIGH", status="SUPPORTING",
             desc="Satellite observation detected dark anomaly consistent with oil slick.",
             details={"platform": "Sentinel-1A", "sensor": "SAR-C"}),
        dict(etype="DRIFT", source="prototype_drift_engine", conf=0.72,
             rel="HIGH", status="SUPPORTING",
             desc="Hindcast simulation places probable origin zone ~6 km NW of detected spill.",
             details={"simulation_type": "HINDCAST", "particles": 50}),
        dict(etype="ENVIRONMENTAL", source="DemoWeatherProvider", conf=0.90,
             rel="MEDIUM", status="SUPPORTING",
             desc="Wind and current conditions consistent with SE drift pattern.",
             details={"wind_speed_avg_ms": 5.0, "current_speed_avg_ms": 0.3}),
    ]
    for item in evidence_items:
        db.add(Evidence(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=None,
            evidence_type=item["etype"], source=item["source"],
            timestamp=NOW, confidence=item["conf"],
            relevance=item["rel"], status=item["status"],
            description=item["desc"], details=item["details"],
        ))

    # Per-candidate evidence
    for vessel in candidates:
        db.add(Evidence(
            id=uid(), incident_id=INCIDENT_ID, vessel_id=vessel.id,
            evidence_type="AIS", source="DemoAISProvider",
            timestamp=NOW - timedelta(hours=18),
            confidence=0.85, relevance="HIGH", status="SUPPORTING",
            description=f"AIS track for {vessel.name} reconstructed for 48-hour window.",
            details={"track_points": 48, "coverage": "complete"},
        ))
        anomalies = db.query(BehaviourAnomaly).filter_by(vessel_id=vessel.id).all()
        for anom in anomalies:
            db.add(Evidence(
                id=uid(), incident_id=INCIDENT_ID, vessel_id=vessel.id,
                evidence_type="BEHAVIOURAL", source="prototype_anomaly_detector",
                timestamp=anom.timestamp,
                confidence=0.70, relevance="HIGH" if anom.severity == "HIGH" else "MEDIUM",
                status="SUPPORTING",
                description=f"Behavioural anomaly ({anom.anomaly_type}): {anom.explanation}",
                details={"anomaly_type": anom.anomaly_type, "severity": anom.severity},
            ))


def _seed_timeline(db):
    print("  -> Seeding investigation timeline...")
    events = [
        (NOW - timedelta(hours=24), "OBSERVATION", "Satellite pass scheduled",
         "Sentinel-1A scheduled acquisition over Arabian Sea."),
        (NOW, "OBSERVATION", "SAR image acquired",
         "Sentinel-1A SAR-C image acquired. Dark anomaly detected."),
        (NOW + timedelta(minutes=30), "DETECTION", "Spill candidate detected",
         "Prototype segmentation algorithm identified a dark region (18.6 km²) consistent with oil slick."),
        (NOW + timedelta(hours=1), "ANALYSIS", "Spill characterised",
         "Spill geometry, age, and look-alike analysis completed. Oil probability: 91%."),
        (NOW + timedelta(hours=1, minutes=30), "ANALYSIS", "Hindcast initiated",
         "Backward drift simulation started from detected spill centroid."),
        (NOW + timedelta(hours=2), "ANALYSIS", "Probable origin estimated",
         "Origin zone identified ~6 km NW of spill. Uncertainty radius: 8.4 km. Time window: 02:00–05:00 UTC."),
        (NOW + timedelta(hours=2, minutes=30), "ANALYSIS", "AIS traffic reconstructed",
         "47 vessels with AIS tracks loaded for the investigation area."),
        (NOW + timedelta(hours=3), "ANALYSIS", "Vessel filtering completed",
         "47 -> 12 (spatial) -> 6 (temporal) -> 4 (trajectory) -> 3 (behaviour). 3 high-priority candidates."),
        (NOW + timedelta(hours=3, minutes=15), "ANOMALY", "Behavioural anomalies detected",
         "Anomalies identified in 3 candidate vessels near probable origin zone."),
        (NOW + timedelta(hours=3, minutes=30), "ANALYSIS", "Attribution scoring completed",
         "Weighted scoring model applied. Top candidate: MT GULF VOYAGER (89/100)."),
        (NOW + timedelta(hours=4), "ANALYSIS", "Evidence graph assembled",
         "All evidence relationships mapped for investigation review."),
    ]
    for t, etype, title, desc in events:
        db.add(InvestigationTimelineEvent(
            id=uid(),
            incident_id=INCIDENT_ID,
            timestamp=t,
            event_type=etype,
            title=title,
            description=desc,
        ))


def _print_summary(db):
    print("\n  +-------------------------------------------+")
    print("  |  SEED SUMMARY                           |")
    print("  +-------------------------------------------+")
    counts = [
        ("Incidents", db.query(Incident).count()),
        ("Satellite Observations", db.query(SatelliteObservation).count()),
        ("Oil Spills", db.query(OilSpill).count()),
        ("Weather Observations", db.query(WeatherObservation).count()),
        ("Ocean Currents", db.query(OceanCurrent).count()),
        ("Drift Simulations", db.query(DriftSimulation).count()),
        ("Drift Particles", db.query(DriftParticle).count()),
        ("Origin Estimates", db.query(OriginEstimate).count()),
        ("Vessels", db.query(Vessel).count()),
        ("  |- Candidates", db.query(Vessel).filter(Vessel.is_candidate == True).count()),
        ("AIS Points", db.query(AISPoint).count()),
        ("Vessel Tracks", db.query(VesselTrack).count()),
        ("Behaviour Anomalies", db.query(BehaviourAnomaly).count()),
        ("Trajectory Analyses", db.query(TrajectoryAnalysis).count()),
        ("Filtering Results", db.query(FilteringResult).count()),
        ("Attribution Scores", db.query(AttributionScore).count()),
        ("Evidence Items", db.query(Evidence).count()),
        ("Timeline Events", db.query(InvestigationTimelineEvent).count()),
        ("Data Provenance", db.query(DataProvenance).count()),
    ]
    for label, count in counts:
        print(f"  |  {label:<30s} {count:>6d}  |")
    print("  +-------------------------------------------+")


if __name__ == "__main__":
    seed()
