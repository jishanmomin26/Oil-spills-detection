"""
Unit and integration tests for Phase 9: Vessel Attribution & Evidence Scoring Engine.
Verifies determinism, non-accusatory language, tie-breaking, weights, and edge cases.
"""

from datetime import datetime, timedelta, timezone
import pytest

from app.services.attribution_engine import VesselAttributionEngine
from app.core.attribution_config import AttributionConfig


class MockVessel:
    def __init__(self, id="v-1", name="Vessel One", mmsi="100000001"):
        self.id = id
        self.name = name
        self.mmsi = mmsi


class MockOrigin:
    def __init__(self):
        self.uncertainty_radius_km = 8.4
        self.time_window_start = datetime(2026, 9, 16, 12, 0, 0, tzinfo=timezone.utc)
        self.time_window_end = datetime(2026, 9, 16, 18, 0, 0, tzinfo=timezone.utc)


def test_weight_validation_and_normalization():
    """Verify weight validation, negative weight rejection, and normalization."""
    # Negative weight must raise ValueError
    with pytest.raises(ValueError):
        VesselAttributionEngine.validate_and_normalize_weights({"spatial": -0.1})

    # Zero total sum must raise ValueError
    with pytest.raises(ValueError):
        VesselAttributionEngine.validate_and_normalize_weights({
            "spatial": 0, "temporal": 0, "trajectory": 0, "behaviour": 0, "quality": 0
        })

    # Custom weights normalized to 1.00
    custom = {"spatial": 2.0, "temporal": 2.0, "trajectory": 0.0, "behaviour": 0.0, "quality": 0.0}
    norm = VesselAttributionEngine.validate_and_normalize_weights(custom)
    assert norm["spatial"] == 0.5
    assert norm["temporal"] == 0.5
    assert sum(norm.values()) == 1.0


def test_score_determinism_and_reproducibility():
    """Verify identical inputs produce strictly identical category scores and composite scores."""
    vessel = MockVessel("v-test", "Test Ship", "999999999")
    origin = MockOrigin()

    mock_profile = {
        "vessel_id": vessel.id,
        "vessel_name": vessel.name,
        "mmsi": vessel.mmsi,
        "course_profile": {"heading_consistency": 0.85, "sharp_turns_count": 1},
        "spill_interaction": {
            "closest_approach_distance_km": 5.2,
            "closest_approach_timestamp": "2026-09-16T14:30:00+00:00",
            "entered_spill_zone": True,
        },
        "behaviour_events": [{"event_type": "SPEED_DROP"}, {"event_type": "SHARP_TURN"}],
        "data_quality": {"total_points": 48, "reconstructed_points": 2},
    }

    res1 = VesselAttributionEngine.score_vessel(vessel, mock_profile, origin)
    res2 = VesselAttributionEngine.score_vessel(vessel, mock_profile, origin)

    assert res1["overall_score"] == res2["overall_score"]
    assert res1["category_scores"] == res2["category_scores"]
    assert res1["relevance_level"] == res2["relevance_level"]
    assert res1["supporting_evidence"] == res2["supporting_evidence"]
    assert res1["contradictory_evidence"] == res2["contradictory_evidence"]


def test_relevance_classification_and_language_safety():
    """Verify strictly non-accusatory relevance labels across score ranges."""
    assert AttributionConfig.classify_relevance(85.0) == "High relevance"
    assert AttributionConfig.classify_relevance(75.0) == "High relevance"
    assert AttributionConfig.classify_relevance(65.0) == "Medium relevance"
    assert AttributionConfig.classify_relevance(50.0) == "Medium relevance"
    assert AttributionConfig.classify_relevance(35.0) == "Low relevance"
    assert AttributionConfig.classify_relevance(25.0) == "Low relevance"
    assert AttributionConfig.classify_relevance(15.0) == "Insufficient evidence"

    # Ensure forbidden words never appear in statutory disclaimer or labels
    forbidden = ["guilty", "responsible vessel", "polluter", "culprit"]
    for word in forbidden:
        assert word not in AttributionConfig.DISCLAIMER.lower()
        assert word not in AttributionConfig.LABEL_HIGH.lower()
        assert word not in AttributionConfig.LABEL_MEDIUM.lower()
        assert word not in AttributionConfig.LABEL_LOW.lower()
        assert word not in AttributionConfig.LABEL_INSUFFICIENT.lower()


def test_far_away_vessel_low_spatial_score():
    """Verify vessel far away from origin (>100 km) gets near-zero spatial score."""
    score, sup, con = VesselAttributionEngine.calculate_spatial_score(
        closest_distance_km=150.0,
        origin_uncertainty_km=8.4,
        entered_spill_zone=False,
    )
    assert score < 1.0
    assert any("significantly exceeds" in c for c in con)


def test_deterministic_candidate_ranking_and_tie_breaker():
    """
    Verify candidate ranking order:
    1. Overall score descending
    2. Closest approach ascending (tie-breaker)
    3. Vessel ID ascending (tie-breaker)
    """
    items = [
        {"vessel_id": "v-c", "overall_score": 75.0, "closest_approach_km": 10.0},
        {"vessel_id": "v-a", "overall_score": 88.0, "closest_approach_km": 5.0},
        {"vessel_id": "v-b", "overall_score": 75.0, "closest_approach_km": 6.0},  # Ties v-c on score, wins on distance
        {"vessel_id": "v-d", "overall_score": 75.0, "closest_approach_km": 10.0}, # Ties v-c on score & dist, v-c wins on ID
    ]

    ranked = VesselAttributionEngine.rank_candidates(items)

    assert ranked[0]["vessel_id"] == "v-a"
    assert ranked[0]["rank"] == 1
    assert ranked[1]["vessel_id"] == "v-b"
    assert ranked[1]["rank"] == 2
    assert ranked[2]["vessel_id"] == "v-c"
    assert ranked[2]["rank"] == 3
    assert ranked[3]["vessel_id"] == "v-d"
    assert ranked[3]["rank"] == 4
