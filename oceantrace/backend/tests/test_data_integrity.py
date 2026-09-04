import pytest
from app.db.database import SessionLocal
from app.db.models.vessel import (
    Vessel, VesselTrack, AISPoint,
    BehaviourAnomaly, AttributionScore
)
from app.db.models.incident import Incident, OriginEstimate, OilSpill

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    yield db
    db.close()

def test_vessel_uniqueness(db_session):
    """Verify that all vessels have unique IDs, unique MMSIs, and unique names."""
    vessels = db_session.query(Vessel).all()
    assert len(vessels) > 0, "No vessels found in database"
    
    ids = [v.id for v in vessels]
    mmsis = [v.mmsi for v in vessels]
    names = [v.name for v in vessels]
    
    assert len(ids) == len(set(ids)), f"Duplicate vessel IDs found: {len(ids) - len(set(ids))}"
    assert len(mmsis) == len(set(mmsis)), f"Duplicate vessel MMSIs found: {len(mmsis) - len(set(mmsis))}"
    assert len(names) == len(set(names)), f"Duplicate vessel names found: {len(names) - len(set(names))}"

def test_ais_point_coordinates_validity(db_session):
    """Verify all AIS point coordinates are within valid geographic bounds."""
    points = db_session.query(AISPoint).all()
    assert len(points) > 0, "No AIS points found in database"
    
    for pt in points:
        assert -90.0 <= pt.lat <= 90.0, f"Invalid latitude {pt.lat} for point {pt.id}"
        assert -180.0 <= pt.lon <= 180.0, f"Invalid longitude {pt.lon} for point {pt.id}"
        assert 0.0 <= pt.speed_knots <= 100.0, f"Unrealistic speed {pt.speed_knots} knots for point {pt.id}"
        assert 0.0 <= pt.heading_deg <= 360.0, f"Invalid heading {pt.heading_deg} for point {pt.id}"
        assert 0.0 <= pt.course_deg <= 360.0, f"Invalid course {pt.course_deg} for point {pt.id}"

def test_ais_no_duplicate_points(db_session):
    """Verify no vessel has duplicate AIS timestamps."""
    vessels = db_session.query(Vessel).all()
    for v in vessels:
        points = db_session.query(AISPoint).filter(AISPoint.vessel_id == v.id).all()
        timestamps = [p.timestamp for p in points]
        assert len(timestamps) == len(set(timestamps)), f"Vessel {v.name} ({v.id}) has duplicate AIS timestamps"

def test_track_continuity_and_chronology(db_session):
    """Verify all tracks have points ordered chronologically with valid start/end times."""
    tracks = db_session.query(VesselTrack).all()
    assert len(tracks) > 0, "No vessel tracks found in database"
    
    for track in tracks:
        points = db_session.query(AISPoint).filter(AISPoint.track_id == track.id).order_by(AISPoint.timestamp).all()
        assert len(points) >= 2, f"Track {track.id} has fewer than 2 points"
        
        timestamps = [p.timestamp for p in points]
        assert timestamps == sorted(timestamps), f"Track {track.id} timestamps are not in chronological order"
        assert track.start_time == points[0].timestamp, f"Track {track.id} start_time does not match first point"
        assert track.end_time == points[-1].timestamp, f"Track {track.id} end_time does not match last point"

def test_no_orphan_records(db_session):
    """Verify all AIS points and tracks map to valid existing vessels."""
    vessel_ids = {v.id for v in db_session.query(Vessel.id).all()}
    
    points = db_session.query(AISPoint).all()
    for pt in points:
        assert pt.vessel_id in vessel_ids, f"AIS point {pt.id} references non-existent vessel {pt.vessel_id}"
        
    tracks = db_session.query(VesselTrack).all()
    for track in tracks:
        assert track.vessel_id in vessel_ids, f"Track {track.id} references non-existent vessel {track.vessel_id}"
