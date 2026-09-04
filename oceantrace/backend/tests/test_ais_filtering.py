import pytest
from datetime import datetime, timedelta
from app.services.ais_filtering import AisFiltering

class DummyVessel:
    def __init__(self, id, name, vessel_type="tanker", mmsi="123456789", flag_state="PA"):
        self.id = id
        self.name = name
        self.vessel_type = vessel_type
        self.mmsi = mmsi
        self.flag_state = flag_state

class DummyPoint:
    def __init__(self, lat, lon, timestamp, speed_knots=10.0, heading_deg=0.0, course_deg=0.0):
        self.lat = lat
        self.lon = lon
        self.timestamp = timestamp
        self.speed_knots = speed_knots
        self.heading_deg = heading_deg
        self.course_deg = course_deg

class DummyTrack:
    def __init__(self, vessel_id, points):
        self.vessel_id = vessel_id
        self.points = points

def test_filter_vessels_distance():
    t0 = datetime(2024, 1, 1, 12, 0)
    v1 = DummyVessel("v1", "Close Tanker", "tanker")
    v2 = DummyVessel("v2", "Far Cargo", "cargo")

    t1 = DummyTrack("v1", [DummyPoint(15.09, 65.0, t0, speed_knots=12.0)])
    t2 = DummyTrack("v2", [DummyPoint(17.0, 65.0, t0, speed_knots=12.0)])

    res = AisFiltering.filter_vessels(
        vessels=[v1, v2],
        tracks=[t1, t2],
        spill_lat=15.0,
        spill_lon=65.0,
        spill_zone_wkt="POLYGON((64.5 14.5, 65.5 14.5, 65.5 15.5, 64.5 15.5, 64.5 14.5))",
        filters={"max_distance_km": 50.0}
    )

    matched_ids = [v.id for v in res["matched_vessels"]]
    assert "v1" in matched_ids
    assert "v2" not in matched_ids
