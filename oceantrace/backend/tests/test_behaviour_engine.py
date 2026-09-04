"""
Unit and integration tests for Phase 8: Vessel Behaviour Analysis Engine.
Uses controlled fixtures (no fabricated production data).
"""

from datetime import datetime, timedelta, timezone
import pytest

from app.services.behaviour_engine import VesselBehaviourEngine
from app.core.behaviour_config import BehaviourConfig


class MockVessel:
    def __init__(self, id="test-vessel-1", name="Test Vessel", mmsi="123456789"):
        self.id = id
        self.name = name
        self.mmsi = mmsi


def test_circular_heading_wrap_around():
    """Verify 359° and 1° mean is 0° / 360°, not 180°."""
    headings = [359.0, 1.0]
    mean_h = VesselBehaviourEngine.calculate_circular_mean_heading(headings)
    assert mean_h == 0.0 or mean_h == 360.0

    variance = VesselBehaviourEngine.calculate_circular_variance(headings)
    assert variance < 0.01  # Very low variance since they point in almost identical directions


def test_speed_drop_and_increase_detection():
    """Verify sudden speed drop and speed increase events are generated."""
    t0 = datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc)
    vessel = MockVessel()

    points = [
        {"timestamp": t0, "lat": 15.0, "lon": 65.0, "speed_knots": 12.0, "course_deg": 90.0, "heading_deg": 90.0},
        {"timestamp": t0 + timedelta(minutes=15), "lat": 15.05, "lon": 65.05, "speed_knots": 3.0, "course_deg": 90.0, "heading_deg": 90.0},
        {"timestamp": t0 + timedelta(minutes=30), "lat": 15.10, "lon": 65.10, "speed_knots": 11.5, "course_deg": 90.0, "heading_deg": 90.0},
    ]

    profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=points,
        incident_id="TEST-INCIDENT",
    )

    events = profile["behaviour_events"]
    event_types = [e["event_type"] for e in events]
    assert "SPEED_DROP" in event_types
    assert "SPEED_INCREASE" in event_types

    drop_ev = next(e for e in events if e["event_type"] == "SPEED_DROP")
    assert drop_ev["measured_value"] == 3.0
    assert "Speed decreased" in drop_ev["explanation"]


def test_stationary_detection():
    """Verify prolonged zero speed is detected as STATIONARY_PERIOD."""
    t0 = datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc)
    vessel = MockVessel()

    points = [
        {"timestamp": t0 + timedelta(minutes=i * 10), "lat": 15.0, "lon": 65.0, "speed_knots": 0.2, "course_deg": 0.0, "heading_deg": 0.0}
        for i in range(5)  # 40 minutes at 0.2 knots (threshold is 0.5 kn, duration threshold is 15 min)
    ]

    profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=points,
        incident_id="TEST-INCIDENT",
    )

    events = profile["behaviour_events"]
    assert any(e["event_type"] == "STATIONARY_PERIOD" for e in events)
    assert profile["speed_profile"]["stationary_duration_minutes"] >= 40.0


def test_sharp_turn_detection():
    """Verify sharp course change > 45° generates SHARP_TURN."""
    t0 = datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc)
    vessel = MockVessel()

    points = [
        {"timestamp": t0, "lat": 15.0, "lon": 65.0, "speed_knots": 10.0, "course_deg": 45.0, "heading_deg": 45.0},
        {"timestamp": t0 + timedelta(minutes=15), "lat": 15.05, "lon": 65.05, "speed_knots": 10.0, "course_deg": 120.0, "heading_deg": 120.0},
    ]

    profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=points,
        incident_id="TEST-INCIDENT",
    )

    events = profile["behaviour_events"]
    sharp_turn = next((e for e in events if e["event_type"] == "SHARP_TURN"), None)
    assert sharp_turn is not None
    assert sharp_turn["measured_value"] == 75.0  # 120 - 45 = 75 degrees


def test_loitering_detection():
    """Verify vessel staying in small area for > 45 minutes with low displacement is detected as LOITERING."""
    t0 = datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc)
    vessel = MockVessel()

    # Move in small back-and-forth pattern around (15.0, 65.0)
    points = []
    for i in range(10):
        # Small oscillation of ~0.002 degrees (< 250m), total time 90 minutes
        offset = 0.002 if i % 2 == 1 else 0.0
        points.append({
            "timestamp": t0 + timedelta(minutes=i * 10),
            "lat": 15.0 + offset,
            "lon": 65.0 + offset,
            "speed_knots": 3.5,
            "course_deg": 45.0 if i % 2 == 1 else 225.0,
            "heading_deg": 45.0 if i % 2 == 1 else 225.0,
        })

    profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=points,
        incident_id="TEST-INCIDENT",
    )

    events = profile["behaviour_events"]
    assert any(e["event_type"] == "LOITERING" for e in events)


def test_spill_zone_entry_and_closest_approach():
    """Verify closest approach and spill polygon entry/exit events."""
    t0 = datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc)
    vessel = MockVessel()

    # Spill polygon around (15.5, 65.5)
    polygon_wkt = "POLYGON((65.45 15.45, 65.55 15.45, 65.55 15.55, 65.45 15.55, 65.45 15.45))"
    origin_lat = 15.50
    origin_lon = 15.50  # wait, origin_lon should match regional 65.50
    origin_lon = 65.50

    points = [
        {"timestamp": t0, "lat": 15.40, "lon": 65.50, "speed_knots": 10.0, "course_deg": 0.0, "heading_deg": 0.0},
        {"timestamp": t0 + timedelta(minutes=15), "lat": 15.50, "lon": 65.50, "speed_knots": 10.0, "course_deg": 0.0, "heading_deg": 0.0}, # inside
        {"timestamp": t0 + timedelta(minutes=30), "lat": 15.60, "lon": 65.50, "speed_knots": 10.0, "course_deg": 0.0, "heading_deg": 0.0}, # outside
    ]

    profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=points,
        incident_id="TEST-INCIDENT",
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        origin_uncertainty_km=8.4,
        spill_geometry_wkt=polygon_wkt,
    )

    events = profile["behaviour_events"]
    types = [e["event_type"] for e in events]
    assert "SPILL_ZONE_ENTRY" in types
    assert "SPILL_ZONE_EXIT" in types
    assert "CLOSE_APPROACH" in types

    assert profile["spill_interaction"]["entered_spill_zone"] is True
    assert profile["spill_interaction"]["closest_approach_distance_km"] == 0.0


def test_chronological_ordering_and_invalid_data_handling():
    """Verify events are strictly chronological and invalid coordinates are rejected."""
    t0 = datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc)
    vessel = MockVessel()

    points = [
        # Out-of-order timestamps and an invalid lat > 90
        {"timestamp": t0 + timedelta(hours=2), "lat": 15.2, "lon": 65.0, "speed_knots": 12.0, "course_deg": 90.0, "heading_deg": 90.0},
        {"timestamp": t0 + timedelta(hours=1), "lat": 95.0, "lon": 65.0, "speed_knots": 12.0, "course_deg": 90.0, "heading_deg": 90.0}, # INVALID
        {"timestamp": t0, "lat": 15.0, "lon": 65.0, "speed_knots": 2.0, "course_deg": 90.0, "heading_deg": 90.0},
    ]

    profile = VesselBehaviourEngine.analyze_vessel_behaviour(
        vessel=vessel,
        track_points=points,
        incident_id="TEST-INCIDENT",
    )

    # Invalid point was filtered out, remaining 2 points were sorted
    events = profile["behaviour_events"]
    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps)
    assert profile["data_quality"]["total_points"] == 2
