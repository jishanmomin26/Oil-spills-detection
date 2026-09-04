"""
OCEANTRACE AI — Phase 10: Unified Investigation Timeline & Correlation Configuration

Centralized parameters, correlation thresholds, provenance categories,
and non-accusatory terminology for maritime intelligence timeline generation.
"""

from typing import Dict, List, Set


class TimelineConfig:
    # ── PROVENANCE LABELS ──────────────────────────────────────────
    PROVENANCE_OBSERVED = "OBSERVED"
    PROVENANCE_ESTIMATED = "ESTIMATED"
    PROVENANCE_MODELLED = "MODELLED"
    PROVENANCE_FORECAST = "FORECAST"
    PROVENANCE_DEMO_SYNTHETIC = "DEMO / SYNTHETIC"

    VALID_PROVENANCE_LABELS: Set[str] = {
        PROVENANCE_OBSERVED,
        PROVENANCE_ESTIMATED,
        PROVENANCE_MODELLED,
        PROVENANCE_FORECAST,
        PROVENANCE_DEMO_SYNTHETIC,
    }

    # ── EVENT CATEGORIES FOR FILTERING ────────────────────────────
    CAT_ALL = "ALL"
    CAT_SATELLITE = "SATELLITE"
    CAT_SPILL = "SPILL"
    CAT_AIS = "AIS"
    CAT_BEHAVIOUR = "BEHAVIOUR"
    CAT_ENVIRONMENTAL = "ENVIRONMENTAL"
    CAT_ATTRIBUTION = "ATTRIBUTION"

    CATEGORIES: List[str] = [
        CAT_ALL,
        CAT_SATELLITE,
        CAT_SPILL,
        CAT_AIS,
        CAT_BEHAVIOUR,
        CAT_ENVIRONMENTAL,
        CAT_ATTRIBUTION,
    ]

    # Category Mapping by Event Type
    EVENT_CATEGORY_MAP: Dict[str, str] = {
        "SATELLITE_OBSERVATION": CAT_SATELLITE,
        "SPILL_DETECTED": CAT_SPILL,
        "ORIGIN_ESTIMATED": CAT_SPILL,
        "SPILL_EVOLUTION": CAT_SPILL,
        "DRIFT_HINDCAST": CAT_ENVIRONMENTAL,
        "DRIFT_FORECAST": CAT_ENVIRONMENTAL,
        "AIS_OBSERVATION": CAT_AIS,
        "VESSEL_APPROACH": CAT_AIS,
        "SPILL_ZONE_ENTRY": CAT_BEHAVIOUR,
        "SPILL_ZONE_EXIT": CAT_BEHAVIOUR,
        "CLOSE_APPROACH": CAT_BEHAVIOUR,
        "VESSEL_DEPARTURE": CAT_AIS,
        "SPEED_DROP": CAT_BEHAVIOUR,
        "SPEED_INCREASE": CAT_BEHAVIOUR,
        "COURSE_CHANGE": CAT_BEHAVIOUR,
        "SHARP_TURN": CAT_BEHAVIOUR,
        "LOITERING": CAT_BEHAVIOUR,
        "STATIONARY_PERIOD": CAT_BEHAVIOUR,
        "ROUTE_DEVIATION": CAT_BEHAVIOUR,
        "ATTRIBUTION_UPDATE": CAT_ATTRIBUTION,
    }

    # ── TEMPORAL CORRELATION WINDOWS (HOURS) ──────────────────────
    # Maximum time window before/after spill release to consider vessel events correlated
    VESSEL_CORRELATION_WINDOW_HOURS = 24.0
    
    # Proximity threshold in km for vessel approach event generation
    APPROACH_PROXIMITY_THRESHOLD_KM = 35.0

    # Minimum events required to establish a valid candidate correlation chain
    MIN_EVENTS_FOR_CHAIN = 3

    # ── NON-ACCUSATORY TERMINOLOGY ─────────────────────────────────
    RELATIONSHIP_SPATIAL = "spatially proximate to"
    RELATIONSHIP_TEMPORAL = "temporally associated with"
    RELATIONSHIP_KINEMATIC = "correlated movement maneuver"
    RELATIONSHIP_ENCOUNTER = "coincided with delineated boundary"
    RELATIONSHIP_EVIDENCE = "contributing evidence for multi-criteria assessment"

    DISCLAIMER = (
        "Investigation timeline correlations reflect mathematical and spatial coincidence "
        "derived from validated sensor and model outputs. Correlations do not establish legal "
        "liability or physical causation without corroborating physical forensic inspection."
    )
