"""
OCEANTRACE AI — Phase 9: Deterministic Evidence-Based Vessel Attribution Engine

Calculates 5-category evidence relevance scores (Spatial, Temporal, Trajectory,
Behaviour, Data Quality) with centralized configurable weights, transparent
mathematical formulas, traceable +/- evidence items, and non-accusatory relevance tiers.
"""

import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.core.attribution_config import AttributionConfig
from app.services.geographic import GeographicService


class VesselAttributionEngine:
    @staticmethod
    def _parse_timestamp(ts: Any) -> Optional[datetime]:
        if ts is None:
            return None
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, str):
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                return None
        return None

    @classmethod
    def validate_and_normalize_weights(cls, custom_weights: Optional[Dict[str, float]]) -> Dict[str, float]:
        """
        Validate investigator weights, reject negative values, and normalize sum to 1.00.
        """
        if not custom_weights:
            return dict(AttributionConfig.DEFAULT_WEIGHTS)

        cleaned = {}
        for key in ["spatial", "temporal", "trajectory", "behaviour", "quality"]:
            val = custom_weights.get(key)
            if val is None:
                val = AttributionConfig.DEFAULT_WEIGHTS[key]
            if val < 0.0:
                raise ValueError(f"Weight '{key}' cannot be negative: {val}")
            cleaned[key] = float(val)

        total = sum(cleaned.values())
        if total <= 0.0:
            raise ValueError("Sum of attribution weights must be strictly greater than 0.")

        # Normalize to 1.00
        return {k: round(v / total, 4) for k, v in cleaned.items()}

    @classmethod
    def calculate_spatial_score(
        cls,
        closest_distance_km: Optional[float],
        origin_uncertainty_km: float,
        entered_spill_zone: bool,
    ) -> Tuple[float, List[str], List[str]]:
        """
        Calculate 0-100 spatial evidence score using Gaussian proximity kernel:
        S = 100 * exp(-d^2 / (2 * R_unc^2)) + zone_encounter_bonus
        """
        supporting = []
        contradictory = []

        if closest_distance_km is None:
            contradictory.append("No spatial proximity data available.")
            return 0.0, supporting, contradictory

        unc = max(1.0, origin_uncertainty_km)
        # Gaussian proximity decay centered at origin
        base_score = 100.0 * math.exp(- (closest_distance_km ** 2) / (2.0 * (unc ** 2)))

        if entered_spill_zone:
            base_score = min(100.0, base_score + 15.0)
            supporting.append("Vessel track directly intersected the delineated spill observation boundary.")

        if closest_distance_km <= unc:
            supporting.append(f"Passed within estimated origin uncertainty zone (closest approach: {closest_distance_km:.1f} km ≤ {unc:.1f} km).")
        elif closest_distance_km <= unc * 2.0:
            supporting.append(f"Passed in proximity to origin zone perimeter (closest approach: {closest_distance_km:.1f} km).")
        else:
            contradictory.append(f"Closest approach ({closest_distance_km:.1f} km) significantly exceeds origin uncertainty zone ({unc:.1f} km).")

        return round(max(0.0, min(100.0, base_score)), 1), supporting, contradictory

    @classmethod
    def calculate_temporal_score(
        cls,
        closest_approach_time: Optional[datetime],
        time_window_start: Optional[datetime],
        time_window_end: Optional[datetime],
        satellite_observation_time: Optional[datetime],
    ) -> Tuple[float, List[str], List[str]]:
        """
        Calculate 0-100 temporal score based on overlap with estimated release window.
        """
        supporting = []
        contradictory = []

        if not closest_approach_time or not time_window_start or not time_window_end:
            contradictory.append("Temporal overlap cannot be verified due to missing release window.")
            return 50.0, supporting, contradictory

        c_time = closest_approach_time
        w_start = time_window_start
        w_end = time_window_end

        # Handle tz-naive vs tz-aware comparisons gracefully
        if c_time.tzinfo and not w_start.tzinfo:
            w_start = w_start.replace(tzinfo=c_time.tzinfo)
            w_end = w_end.replace(tzinfo=c_time.tzinfo)
        elif not c_time.tzinfo and w_start.tzinfo:
            c_time = c_time.replace(tzinfo=w_start.tzinfo)

        if w_start <= c_time <= w_end:
            supporting.append("Vessel transit time directly overlaps estimated oil release window.")
            return 95.0, supporting, contradictory

        # Calculate time distance to window in hours
        if c_time < w_start:
            dt_hours = (w_start - c_time).total_seconds() / 3600.0
        else:
            dt_hours = (c_time - w_end).total_seconds() / 3600.0

        # Exponential decay with 6-hour half-life
        temp_score = 100.0 * math.exp(-dt_hours / 6.0)

        if dt_hours <= 3.0:
            supporting.append(f"Closest approach occurred within {dt_hours:.1f} hours of estimated release window.")
        else:
            contradictory.append(f"Transit occurred {dt_hours:.1f} hours outside the primary estimated release window.")

        return round(max(0.0, min(100.0, temp_score)), 1), supporting, contradictory

    @classmethod
    def calculate_trajectory_score(
        cls,
        heading_consistency: float,
        sharp_turns_count: int,
        closest_distance_km: Optional[float],
        origin_uncertainty_km: float,
    ) -> Tuple[float, List[str], List[str]]:
        """
        Calculate 0-100 trajectory score reflecting transit correlation with the origin corridor.
        """
        supporting = []
        contradictory = []

        base_score = heading_consistency * 70.0  # Consistency contributes up to 70

        if closest_distance_km is not None and closest_distance_km <= origin_uncertainty_km * 1.5:
            base_score += 25.0
            supporting.append("Trajectory path aligns with the primary origin passage corridor.")
        else:
            contradictory.append("Trajectory path does not align with the probable discharge axis.")

        if sharp_turns_count > 0:
            supporting.append(f"Course alterations recorded along trajectory ({sharp_turns_count} turn events).")
        else:
            contradictory.append("Vessel maintained uniform transit heading with zero sharp turns.")

        return round(max(0.0, min(100.0, base_score)), 1), supporting, contradictory

    @classmethod
    def calculate_behaviour_score(
        cls,
        behaviour_events: List[Dict[str, Any]],
        closest_distance_km: Optional[float],
        origin_uncertainty_km: float,
    ) -> Tuple[float, List[str], List[str]]:
        """
        Calculate 0-100 behaviour score from Phase 8 detected maneuvers.
        """
        supporting = []
        contradictory = []

        if not behaviour_events:
            contradictory.append("No behavioural anomalies detected along vessel track.")
            return 25.0, supporting, contradictory

        score = 30.0  # baseline for active maneuvers
        event_types = [e.get("event_type") for e in behaviour_events]

        if "STATIONARY_PERIOD" in event_types:
            score += 30.0
            supporting.append("Vessel entered stationary state in vicinity of investigation area.")
        if "SPEED_DROP" in event_types:
            score += 20.0
            supporting.append("Significant speed reduction detected along track.")
        if "LOITERING" in event_types:
            score += 25.0
            supporting.append("Loitering movement pattern detected with low net displacement.")
        if "SHARP_TURN" in event_types:
            score += 15.0
            supporting.append("Sharp maneuvering detected along route.")
        if "ROUTE_DEVIATION" in event_types:
            score += 15.0
            supporting.append("Course deviation from expected transit heading detected.")

        # Bonus if vessel was spatially proximate when anomaly occurred
        if closest_distance_km is not None and closest_distance_km <= origin_uncertainty_km:
            score += 10.0
            supporting.append("Kinematics anomalies coincided spatially with probable origin zone.")

        return round(max(0.0, min(100.0, score)), 1), supporting, contradictory

    @classmethod
    def calculate_data_quality_score(
        cls,
        total_points: int,
        reconstructed_points: int,
    ) -> Tuple[float, List[str], List[str]]:
        """
        Calculate 0-100 data quality score based on AIS sampling and completeness.
        """
        supporting = []
        contradictory = []

        if total_points == 0:
            contradictory.append("Zero AIS observations available for analysis.")
            return 0.0, supporting, contradictory

        observed_points = total_points - reconstructed_points
        obs_ratio = observed_points / total_points

        # Density score (up to 40)
        density_score = min(40.0, (total_points / 48.0) * 40.0)
        # Completeness/integrity score (up to 60)
        integrity_score = obs_ratio * 60.0

        total_quality = density_score + integrity_score

        if obs_ratio >= 0.90:
            supporting.append(f"High AIS observation coverage ({obs_ratio * 100:.0f}% raw verified points).")
        elif obs_ratio >= 0.70:
            supporting.append(f"Acceptable AIS coverage with minor interpolation ({obs_ratio * 100:.0f}% raw points).")
        else:
            contradictory.append(f"Significant AIS gaps present ({(1.0 - obs_ratio) * 100:.0f}% interpolated points).")

        if total_points < 20:
            contradictory.append(f"Limited observation count ({total_points} points).")

        return round(max(0.0, min(100.0, total_quality)), 1), supporting, contradictory

    @classmethod
    def score_vessel(
        cls,
        vessel: Any,
        behaviour_profile: Dict[str, Any],
        origin_estimate: Optional[Any] = None,
        custom_weights: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Perform complete multi-criteria evidence scoring on a single vessel.
        """
        weights = cls.validate_and_normalize_weights(custom_weights)

        # Extract parameters from incident origin
        origin_uncertainty = 8.4
        w_start = None
        w_end = None
        sat_time = None

        if origin_estimate:
            origin_uncertainty = getattr(origin_estimate, "uncertainty_radius_km", 8.4) or 8.4
            w_start = cls._parse_timestamp(getattr(origin_estimate, "time_window_start", None))
            w_end = cls._parse_timestamp(getattr(origin_estimate, "time_window_end", None))

        spill_inter = behaviour_profile.get("spill_interaction", {})
        c_dist = spill_inter.get("closest_approach_distance_km")
        c_time_raw = spill_inter.get("closest_approach_timestamp")
        c_time = cls._parse_timestamp(c_time_raw)
        entered_zone = spill_inter.get("entered_spill_zone", False)

        course_prof = behaviour_profile.get("course_profile", {})
        h_consistency = course_prof.get("heading_consistency", 0.8)
        sharp_turns = course_prof.get("sharp_turns_count", 0)

        events = behaviour_profile.get("behaviour_events", [])
        dq = behaviour_profile.get("data_quality", {})
        total_pts = dq.get("total_points", 0)
        rec_pts = dq.get("reconstructed_points", 0)

        # 1. Spatial
        s_score, s_sup, s_con = cls.calculate_spatial_score(c_dist, origin_uncertainty, entered_zone)
        # 2. Temporal
        t_score, t_sup, t_con = cls.calculate_temporal_score(c_time, w_start, w_end, sat_time)
        # 3. Trajectory
        tr_score, tr_sup, tr_con = cls.calculate_trajectory_score(h_consistency, sharp_turns, c_dist, origin_uncertainty)
        # 4. Behaviour
        b_score, b_sup, b_con = cls.calculate_behaviour_score(events, c_dist, origin_uncertainty)
        # 5. Data Quality
        q_score, q_sup, q_con = cls.calculate_data_quality_score(total_pts, rec_pts)

        # Composite multi-criteria fusion
        composite = (
            s_score * weights["spatial"]
            + t_score * weights["temporal"]
            + tr_score * weights["trajectory"]
            + b_score * weights["behaviour"]
            + q_score * weights["quality"]
        )
        composite = round(max(0.0, min(100.0, composite)), 1)
        relevance_level = AttributionConfig.classify_relevance(composite)

        all_supporting = s_sup + t_sup + tr_sup + b_sup + q_sup
        all_contradictory = s_con + t_con + tr_con + b_con + q_con

        v_id = str(getattr(vessel, "id", None) or behaviour_profile.get("vessel_id") or "")
        v_name = str(getattr(vessel, "name", None) or behaviour_profile.get("vessel_name") or "Unknown")
        mmsi = str(getattr(vessel, "mmsi", None) or behaviour_profile.get("mmsi") or "")

        v_type = str(getattr(vessel, "vessel_type", None) or "")
        drift_score = round((s_score * 0.6 + tr_score * 0.4), 1)
        confidence = round(q_score / 100.0, 2)

        return {
            "id": f"attr-{v_id}",
            "vessel_id": v_id,
            "vessel_name": v_name,
            "vessel_type": v_type,
            "mmsi": mmsi,
            "overall_score": composite,
            "relevance_level": relevance_level,
            "category_scores": {
                "spatial": s_score,
                "temporal": t_score,
                "trajectory": tr_score,
                "behaviour": b_score,
                "quality": q_score,
            },
            "spatial_score": s_score,
            "temporal_score": t_score,
            "trajectory_score": tr_score,
            "behaviour_score": b_score,
            "drift_score": drift_score,
            "confidence": confidence,
            "weights": weights,
            "closest_approach_km": c_dist,
            "closest_approach_time": c_time_raw,
            "entered_spill_zone": entered_zone,
            "supporting_evidence": all_supporting,
            "contradictory_evidence": all_contradictory,
            "missing_evidence": [],
            "disclaimer": AttributionConfig.DISCLAIMER,
        }

    @classmethod
    def rank_candidates(
        cls,
        vessel_attributions: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Rank candidate vessels deterministically.
        Tie-breaking criteria:
        1. Composite evidence score descending
        2. Closest approach distance ascending (None treated as infinity)
        3. Vessel ID ascending
        """
        def sort_key(item: Dict[str, Any]):
            score = item.get("overall_score", 0.0)
            c_dist = item.get("closest_approach_km")
            dist_val = c_dist if c_dist is not None else float("inf")
            v_id = str(item.get("vessel_id", ""))
            return (-score, dist_val, v_id)

        sorted_list = sorted(vessel_attributions, key=sort_key)
        for rank_idx, item in enumerate(sorted_list, start=1):
            item["rank"] = rank_idx
        return sorted_list
