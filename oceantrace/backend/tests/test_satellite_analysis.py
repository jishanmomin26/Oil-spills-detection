"""
OCEANTRACE AI — Phase 11 Backend Test Suite: Advanced Satellite + Spill Analysis

Covers:
- Satellite observation retrieval & chronological ordering
- WGS84 ellipsoidal area calculation via pyproj vs stored area
- Geometric centroid calculation & displacement distance/bearing
- Spill evolution progression (time delta, area delta, growth %, drift velocity)
- Origin estimate integration & uncertainty buffer extraction
- Environmental drift correlation & neutral investigative language
- Strict provenance tracking ('DEMO / SYNTHETIC')
- Determinism across repeated calls (0% variation)
- Edge cases: non-existent incident, missing geometry, empty observations
"""

import pytest
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.db.models.incident import Incident, SatelliteObservation, OilSpill, OriginEstimate
from app.services.geographic import GeographicService
from app.services.satellite_analysis import SatelliteAnalysisService
from app.core.timeline_config import TimelineConfig


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()


def test_geographic_service_area_calculation():
    """Verify ellipsoidal WGS84 area calculation on a known geodesic circle polygon."""
    center_lat, center_lon, radius_km = 15.58, 65.48, 8.4
    poly_wkt = GeographicService.generate_geodesic_circle_polygon(center_lat, center_lon, radius_km, num_points=64)
    assert poly_wkt.startswith("POLYGON((")
    
    area_km2 = GeographicService.calculate_polygon_area_km2(poly_wkt)
    assert area_km2 is not None
    # True circle area: pi * 8.4^2 = ~221.67 km2
    assert 215.0 <= area_km2 <= 225.0


def test_geographic_service_centroid_calculation():
    """Verify polygon geometric centroid extraction."""
    center_lat, center_lon, radius_km = 15.58, 65.48, 5.0
    poly_wkt = GeographicService.generate_geodesic_circle_polygon(center_lat, center_lon, radius_km, num_points=32)
    
    centroid = GeographicService.calculate_polygon_centroid(poly_wkt)
    assert centroid is not None
    c_lat, c_lon = centroid
    assert abs(c_lat - center_lat) < 0.01
    assert abs(c_lon - center_lon) < 0.01


def test_geographic_service_bounding_box():
    """Verify bounding box calculation for sensor footprint."""
    center_lat, center_lon, radius_km = 15.50, 65.50, 10.0
    poly_wkt = GeographicService.generate_geodesic_circle_polygon(center_lat, center_lon, radius_km)
    bbox = GeographicService.calculate_bounding_box(poly_wkt)
    
    assert bbox is not None
    assert bbox["min_lon"] < center_lon < bbox["max_lon"]
    assert bbox["min_lat"] < center_lat < bbox["max_lat"]


def test_geographic_service_invalid_geometry_handling():
    """Verify robust error handling for invalid or empty WKT."""
    assert GeographicService.calculate_polygon_area_km2("") is None
    assert GeographicService.calculate_polygon_area_km2("INVALID_WKT") is None
    assert GeographicService.calculate_polygon_centroid("") is None
    assert GeographicService.calculate_polygon_centroid("NOT A POLYGON") is None
    assert GeographicService.calculate_bounding_box("") is None


def test_satellite_observations_retrieval_and_ordering(db_session: Session):
    """Verify observations are retrieved and ordered chronologically."""
    res = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    observations = res["observations"]
    
    assert len(observations) >= 3, "Expected at least 3 satellite passes in demonstration database"
    timestamps = [obs["acquisition_time"] for obs in observations]
    assert timestamps == sorted(timestamps), "Satellite observations must be strictly chronologically sorted"


def test_satellite_observations_provenance_labeling(db_session: Session):
    """Verify all synthetic demonstration observations carry strict DEMO / SYNTHETIC provenance."""
    res = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    
    assert res["provenance"] == TimelineConfig.PROVENANCE_DEMO_SYNTHETIC
    assert res["summary"]["data_provenance"] == "DEMO / SYNTHETIC"
    assert res["summary"]["classification"] == "SYNTHETIC"
    
    for obs in res["observations"]:
        assert obs["data_provenance"] == "DEMO / SYNTHETIC"
        assert obs["classification"] == "SYNTHETIC"
        # Must never describe synthetic demo observations as real or confirmed
        assert "REAL" not in obs["data_provenance"].upper()
        assert "CONFIRMED" not in obs["data_provenance"].upper()


def test_spill_evolution_steps_metrics(db_session: Session):
    """Verify spill evolution calculation between consecutive passes."""
    res = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    steps = res["evolution_steps"]
    
    assert len(steps) >= 2, "Expected at least 2 evolution steps for 3 passes"
    for step in steps:
        assert step["delta_time_hours"] > 0
        assert step["from_area_km2"] > 0
        assert step["to_area_km2"] > 0
        assert "expansion_rate_km2_per_hr" in step
        assert step["centroid_displacement_km"] >= 0
        assert 0.0 <= step["displacement_bearing_deg"] <= 360.0
        assert step["drift_speed_knots"] >= 0
        assert step["direction_cardinal"] in ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def test_origin_integration_reuse(db_session: Session):
    """Verify origin integration reuses existing entity without algorithm duplication."""
    res = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    origin = res["origin_integration"]
    
    assert origin["origin_id"] is not None
    assert origin["provenance"] == TimelineConfig.PROVENANCE_ESTIMATED
    assert origin["uncertainty_radius_km"] > 0
    assert origin["uncertainty_polygon_wkt"] is not None
    assert origin["distance_to_first_observation_km"] >= 0


def test_environmental_drift_correlation(db_session: Session):
    """Verify environmental MetOcean drift correlation and neutral terminology."""
    res = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    drift = res["drift_correlation"]
    
    assert drift["modelled_current_speed_knots"] > 0
    assert 0.0 <= drift["modelled_current_direction_deg"] <= 360.0
    assert drift["model_agreement_rating"] in ["HIGH", "MODERATE", "LOW"]
    assert "consistent" in drift["spatial_consistency"].lower() or "partial" in drift["spatial_consistency"].lower()
    
    # Neutral language verification
    forbidden_terms = ["proves", "guilty", "perpetrator", "culprit", "confirms liability", "convicted"]
    summary_lower = drift["summary"].lower()
    for term in forbidden_terms:
        assert term not in summary_lower, f"Forbidden accusatory term '{term}' found in drift summary"


def test_satellite_analysis_determinism(db_session: Session):
    """Verify identical outputs across multiple repeated analytical runs (0% variation)."""
    run1 = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    run2 = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    run3 = SatelliteAnalysisService.analyze_spill_evolution(db_session, "OCEANTRACE-DEMO-001")
    
    assert run1["summary"] == run2["summary"] == run3["summary"]
    assert len(run1["observations"]) == len(run2["observations"]) == len(run3["observations"])
    assert run1["evolution_steps"] == run2["evolution_steps"] == run3["evolution_steps"]
    assert run1["origin_integration"] == run2["origin_integration"] == run3["origin_integration"]
    assert run1["drift_correlation"] == run2["drift_correlation"] == run3["drift_correlation"]


def test_empty_observations_fallback(db_session: Session):
    """Verify safe empty state handling for non-existent incident."""
    res = SatelliteAnalysisService.analyze_spill_evolution(db_session, "NONEXISTENT-INCIDENT-999")
    
    assert res["summary"]["total_observations"] == 0
    assert len(res["observations"]) == 0
    assert len(res["evolution_steps"]) == 0
    assert res["summary"]["data_quality"] == "UNAVAILABLE"
