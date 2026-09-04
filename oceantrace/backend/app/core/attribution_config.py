"""
OCEANTRACE AI — Phase 9: Vessel Attribution & Evidence Scoring Configuration

Centralized, explainable configuration for evidence category weights,
relevance tiers, and multi-criteria fusion parameters.
"""

from typing import Dict

class AttributionConfig:
    # Standard centralized weights (Must sum to 1.00)
    DEFAULT_WEIGHTS: Dict[str, float] = {
        "spatial": 0.30,
        "temporal": 0.25,
        "trajectory": 0.20,
        "behaviour": 0.15,
        "quality": 0.10,
    }

    # Relevance Classification Thresholds (Non-Accusatory)
    HIGH_RELEVANCE_THRESHOLD: float = 75.0
    MEDIUM_RELEVANCE_THRESHOLD: float = 50.0
    LOW_RELEVANCE_THRESHOLD: float = 25.0

    # Human-readable non-accusatory relevance labels
    LABEL_HIGH = "High relevance"
    LABEL_MEDIUM = "Medium relevance"
    LABEL_LOW = "Low relevance"
    LABEL_INSUFFICIENT = "Insufficient evidence"

    # Statutory analytical disclaimer
    DISCLAIMER = (
        "Evidence is analytical and should be interpreted with supporting "
        "satellite, AIS and environmental evidence."
    )

    @classmethod
    def classify_relevance(cls, score: float) -> str:
        if score >= cls.HIGH_RELEVANCE_THRESHOLD:
            return cls.LABEL_HIGH
        elif score >= cls.MEDIUM_RELEVANCE_THRESHOLD:
            return cls.LABEL_MEDIUM
        elif score >= cls.LOW_RELEVANCE_THRESHOLD:
            return cls.LABEL_LOW
        else:
            return cls.LABEL_INSUFFICIENT
