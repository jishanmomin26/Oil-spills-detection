import pytest
from datetime import datetime, timedelta
from app.services.trajectory_analysis import TrajectoryAnalysis

class DummyPoint:
    def __init__(self, lat, lon, timestamp, speed_knots=12.0, course_deg=90.0, heading_deg=90.0):
        self.lat = lat
        self.lon = lon
        self.timestamp = timestamp
        self.speed_knots = speed_knots
        self.course_deg = course_deg
        self.heading_deg = heading_deg

def test_detect_sharp_turn():
    t0 = datetime(2024, 1, 1, 12, 0)
    pts = [
        DummyPoint(15.0, 65.0, t0, speed_knots=12.0, course_deg=90.0),
        DummyPoint(15.0, 65.1, t0 + timedelta(minutes=15), speed_knots=12.0, course_deg=160.0), # 70 deg turn (>45)
    ]
    events = TrajectoryAnalysis.detect_trajectory_events(pts)
    sharp_turns = [e for e in events if e["event_type"] == "SHARP_TURN"]
    assert len(sharp_turns) >= 1
    assert sharp_turns[0]["difference"] >= 45.0

def test_detect_sudden_stop():
    t0 = datetime(2024, 1, 1, 12, 0)
    pts = [
        DummyPoint(15.0, 65.0, t0, speed_knots=14.0),
        DummyPoint(15.0, 65.05, t0 + timedelta(minutes=15), speed_knots=0.5), # below 1.0
    ]
    events = TrajectoryAnalysis.detect_trajectory_events(pts)
    stops = [e for e in events if e["event_type"] == "SUDDEN_STOP"]
    assert len(stops) == 1

def test_analyze_approach_departure():
    t0 = datetime(2024, 1, 1, 12, 0)
    pts = [
        DummyPoint(14.0, 65.0, t0, speed_knots=10.0),
        DummyPoint(15.0, 65.0, t0 + timedelta(hours=1), speed_knots=10.0),
        DummyPoint(16.0, 65.0, t0 + timedelta(hours=2), speed_knots=10.0),
    ]
    # Origin is at (15.01, 65.0)
    res = TrajectoryAnalysis.analyze_approach_departure(pts, 15.01, 65.0)
    assert res["approach_direction_deg"] is not None
    assert res["departure_direction_deg"] is not None
