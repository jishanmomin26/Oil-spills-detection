import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import SessionLocal
from app.services.investigation_timeline import InvestigationTimelineService
from app.core.timeline_config import TimelineConfig

INCIDENT_ID = "OCEANTRACE-DEMO-001"


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_harvest_and_build_timeline(db):
    """Test full timeline generation and non-empty event collection."""
    res = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    assert res is not None
    assert res["incident_id"] == INCIDENT_ID
    assert res["total_events"] > 0
    assert len(res["events"]) == res["total_events"]

    event_types = {e["event_type"] for e in res["events"]}
    assert "SATELLITE_OBSERVATION" in event_types
    assert "SPILL_DETECTED" in event_types
    assert "ORIGIN_ESTIMATED" in event_types
    assert "ATTRIBUTION_UPDATE" in event_types


def test_deterministic_ordering(db):
    """Test that events are strictly sorted by timestamp ASC, event_type ASC, event_id ASC."""
    res = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    events = res["events"]
    for i in range(len(events) - 1):
        e1 = events[i]
        e2 = events[i + 1]
        t1 = e1["timestamp"]
        t2 = e2["timestamp"]
        assert t1 <= t2, f"Inverted timestamps: {t1} > {t2}"
        if t1 == t2:
            assert e1["event_type"] <= e2["event_type"]


def test_deduplication(db):
    """Test that deduplication prevents any duplicate event records."""
    res = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    events = res["events"]
    keys = set()
    for e in events:
        key = (
            e.get("source"),
            e.get("event_type"),
            e["timestamp"].isoformat(),
            e.get("vessel_id") or "",
            round(e.get("latitude") or 0.0, 4),
            round(e.get("longitude") or 0.0, 4)
        )
        assert key not in keys, f"Duplicate key detected: {key}"
        keys.add(key)


def test_provenance_labels(db):
    """Test that all events have valid provenance labels: OBSERVED, ESTIMATED, MODELLED, FORECAST, DEMO / SYNTHETIC."""
    res = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    for e in res["events"]:
        assert e["data_label"] in TimelineConfig.VALID_PROVENANCE_LABELS
        if e["event_type"] == "SATELLITE_OBSERVATION":
            assert e["data_label"] in [TimelineConfig.PROVENANCE_OBSERVED, TimelineConfig.PROVENANCE_DEMO_SYNTHETIC]
        elif e["event_type"] in ["SPILL_DETECTED", "ORIGIN_ESTIMATED", "SPILL_EVOLUTION"]:
            assert e["data_label"] in [TimelineConfig.PROVENANCE_ESTIMATED, TimelineConfig.PROVENANCE_DEMO_SYNTHETIC]
        elif e["event_type"] == "DRIFT_HINDCAST":
            assert e["data_label"] == TimelineConfig.PROVENANCE_MODELLED


def test_correlation_chains(db):
    """Test that correlation chains are formed for candidate vessels with non-accusatory terms."""
    res = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    correlations = res["correlations"]
    assert len(correlations) > 0

    for chain in correlations:
        assert chain["correlation_id"]
        assert chain["vessel_name"]
        assert len(chain["event_ids"]) >= TimelineConfig.MIN_EVENTS_FOR_CHAIN
        assert 0.0 <= chain["correlation_strength"] <= 1.0
        assert len(chain["limitations"]) > 0

        # Check non-accusatory terminology
        for rel in chain["relationships"]:
            assert rel["relationship_type"] in ["temporally_associated", "spatially_proximate"]
            assert "guilty" not in rel["description"].lower()
            assert "caused by" not in rel["description"].lower()


def test_vessel_filtering(db):
    """Test filtering by specific vessel ID."""
    full = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    candidate_event = next((e for e in full["events"] if e.get("vessel_id")), None)
    assert candidate_event is not None
    v_id = candidate_event["vessel_id"]

    filtered = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID, vessel_id=v_id)
    assert filtered["total_events"] > 0
    for e in filtered["events"]:
        assert e.get("vessel_id") == v_id or e.get("vessel_id") is None


def test_category_filtering(db):
    """Test filtering by category."""
    filtered_spill = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID, category=TimelineConfig.CAT_SPILL)
    for e in filtered_spill["events"]:
        assert TimelineConfig.EVENT_CATEGORY_MAP.get(e["event_type"]) == TimelineConfig.CAT_SPILL


def test_determinism_three_runs(db):
    """Test that 3 consecutive runs produce 100% identical output with 0% variation."""
    run1 = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    run2 = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)
    run3 = InvestigationTimelineService.build_unified_timeline(db, INCIDENT_ID)

    ids1 = [e["event_id"] for e in run1["events"]]
    ids2 = [e["event_id"] for e in run2["events"]]
    ids3 = [e["event_id"] for e in run3["events"]]
    assert ids1 == ids2 == ids3

    types1 = [e["event_type"] for e in run1["events"]]
    types2 = [e["event_type"] for e in run2["events"]]
    types3 = [e["event_type"] for e in run3["events"]]
    assert types1 == types2 == types3

    chains1 = [(c["vessel_id"], c["correlation_strength"], len(c["event_ids"])) for c in run1["correlations"]]
    chains2 = [(c["vessel_id"], c["correlation_strength"], len(c["event_ids"])) for c in run2["correlations"]]
    chains3 = [(c["vessel_id"], c["correlation_strength"], len(c["event_ids"])) for c in run3["correlations"]]
    assert chains1 == chains2 == chains3


def test_api_endpoint_timeline(client):
    """Test GET /api/incidents/{incident_id}/timeline via FastAPI client."""
    resp = client.get(f"/api/incidents/{INCIDENT_ID}/timeline")
    assert resp.status_code == 200
    data = resp.json()
    assert data["incident_id"] == INCIDENT_ID
    assert data["total_events"] > 0
    assert len(data["events"]) == data["total_events"]
    assert "correlations" in data
    assert len(data["correlations"]) > 0

    # Test category filter param
    resp_spill = client.get(f"/api/incidents/{INCIDENT_ID}/timeline", params={"category": "SPILL"})
    assert resp_spill.status_code == 200
    data_spill = resp_spill.json()
    assert data_spill["total_events"] > 0
    for e in data_spill["events"]:
        assert e["event_type"] in ["SPILL_DETECTED", "ORIGIN_ESTIMATED", "SPILL_EVOLUTION"]
