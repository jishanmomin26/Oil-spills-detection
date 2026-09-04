import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

INCIDENT_ID = "OCEANTRACE-DEMO-001"

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["database"] == "sqlite"
    assert any(m["name"] == "Attribution Scoring" for m in data["modules"])


def test_list_incidents_and_detail():
    resp = client.get("/api/incidents")
    assert resp.status_code == 200
    incidents = resp.json()
    assert len(incidents) > 0
    assert any(inc["id"] == INCIDENT_ID for inc in incidents)

    resp_detail = client.get(f"/api/incidents/{INCIDENT_ID}")
    assert resp_detail.status_code == 200
    detail = resp_detail.json()
    assert detail["id"] == INCIDENT_ID


def test_vessels_list_candidates():
    resp = client.get(f"/api/incidents/{INCIDENT_ID}/vessels")
    assert resp.status_code == 200
    vessels = resp.json()
    assert len(vessels) >= 3
    candidates = [v for v in vessels if v.get("is_candidate")]
    assert len(candidates) == 3


def test_vessel_attribution_endpoint_default_weights():
    resp = client.get(f"/api/incidents/{INCIDENT_ID}/vessels/attribution")
    assert resp.status_code == 200
    attributions = resp.json()
    assert isinstance(attributions, list)
    assert len(attributions) == 3  # candidates_only defaults to true

    # Verify ranking order
    scores = [a["overall_score"] for a in attributions]
    assert scores == sorted(scores, reverse=True)
    assert attributions[0]["rank"] == 1

    # Verify fields
    for a in attributions:
        assert "overall_score" in a
        assert "relevance_level" in a
        assert a["relevance_level"] in ["High relevance", "Medium relevance", "Low relevance", "Insufficient evidence"]
        assert "category_scores" in a
        assert "weights" in a
        assert "disclaimer" in a
        assert "Evidence is analytical" in a["disclaimer"]

        # Strict non-accusatory vocabulary checks
        banned = ["guilty", "responsible", "polluter", "suspect", "culprit", "blame"]
        combined_text = (
            str(a["relevance_level"]) +
            " " + str(a["disclaimer"]) +
            " " + " ".join(a.get("supporting_evidence", [])) +
            " " + " ".join(a.get("contradictory_evidence", []))
        ).lower()
        for word in banned:
            assert word not in combined_text, f"Found non-compliant accusatory term '{word}' in attribution output"


def test_vessel_attribution_endpoint_custom_weights():
    # Weight only spatial proximity
    params = {
        "w_spatial": 1.0,
        "w_temporal": 0.0,
        "w_trajectory": 0.0,
        "w_behaviour": 0.0,
        "w_quality": 0.0,
    }
    resp = client.get(f"/api/incidents/{INCIDENT_ID}/vessels/attribution", params=params)
    assert resp.status_code == 200
    attributions = resp.json()
    assert len(attributions) == 3

    # With only spatial weight, overall score should match spatial category score
    for a in attributions:
        assert abs(a["overall_score"] - a["category_scores"]["spatial"]) < 0.01


def test_vessel_behaviour_endpoint_for_candidate():
    # Fetch candidate vessels
    resp = client.get(f"/api/incidents/{INCIDENT_ID}/vessels")
    candidates = [v for v in resp.json() if v.get("is_candidate")]
    assert len(candidates) > 0

    candidate_id = candidates[0]["id"]
    beh_resp = client.get(f"/api/incidents/{INCIDENT_ID}/vessels/{candidate_id}/behaviour")
    assert beh_resp.status_code == 200
    profile = beh_resp.json()

    assert profile["vessel_id"] == candidate_id
    assert "speed_profile" in profile
    assert "course_profile" in profile
    assert "spill_interaction" in profile
    assert "behaviour_events" in profile
    assert "data_quality" in profile

    # Check metrics
    sp = profile["speed_profile"]
    assert sp["average_speed_knots"] >= 0
    assert sp["min_speed_knots"] <= sp["max_speed_knots"]

    cp = profile["course_profile"]
    assert 0 <= cp["circular_mean_heading_deg"] <= 360
    assert 0 <= cp["heading_consistency"] <= 1.0

    # Non-accusatory event explanations
    banned = ["guilty", "responsible", "polluter", "suspect", "culprit", "blame"]
    for ev in profile.get("behaviour_events", []):
        desc = ev.get("description", "").lower()
        for word in banned:
            assert word not in desc


def test_vessel_behaviour_endpoint_not_found():
    resp = client.get(f"/api/incidents/{INCIDENT_ID}/vessels/NON_EXISTENT_ID/behaviour")
    assert resp.status_code == 404
