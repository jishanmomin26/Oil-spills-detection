import pytest
from datetime import datetime, timedelta
from app.services.proximity_engine import ProximityEngine

class DummyPoint:
    def __init__(self, lat, lon, timestamp, speed_knots=10.0, heading_deg=0.0):
        self.lat = lat
        self.lon = lon
        self.timestamp = timestamp
        self.speed_knots = speed_knots
        self.heading_deg = heading_deg

def test_calculate_origin_proximity():
    t0 = datetime(2024, 1, 1, 12, 0, 0)
    pts = [
        DummyPoint(14.0, 65.0, t0),
        DummyPoint(15.0, 65.0, t0 + timedelta(hours=1)),
        DummyPoint(16.0, 65.0, t0 + timedelta(hours=2)),
    ]
    # Origin at (15.05, 65.0) -> closest point should be (15.0, 65.0)
    res = ProximityEngine.calculate_origin_proximity(pts, 15.05, 65.0)
    assert res["min_distance_km"] is not None
    assert res["min_distance_km"] < 10.0
    assert res["closest_approach_lat"] == 15.0
    assert res["closest_approach_time"] == t0 + timedelta(hours=1)

def test_calculate_spill_zone_encounter():
    poly_wkt = "POLYGON((64.5 14.5, 65.5 14.5, 65.5 15.5, 64.5 15.5, 64.5 14.5))"
    t0 = datetime(2024, 1, 1, 10, 0, 0)
    pts = [
        DummyPoint(14.0, 65.0, t0),                          # Outside
        DummyPoint(14.8, 65.0, t0 + timedelta(hours=1)),    # Inside
        DummyPoint(15.2, 65.0, t0 + timedelta(hours=2)),    # Inside
        DummyPoint(16.0, 65.0, t0 + timedelta(hours=3)),    # Outside
    ]
    res = ProximityEngine.calculate_spill_zone_encounter(pts, poly_wkt)
    assert res["entered_spill_zone"] is True
    assert res["entry_time"] == t0 + timedelta(hours=1)
    assert res["exit_time"] == t0 + timedelta(hours=2)
    assert res["encounter_duration_minutes"] > 0
    assert res["distance_travelled_inside_km"] > 0
