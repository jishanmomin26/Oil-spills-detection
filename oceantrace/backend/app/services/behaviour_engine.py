"""
OCEANTRACE AI — Phase 8: Deterministic Vessel Behaviour Analysis Engine

Calculates kinematics features, movement profiles, maneuver events,
and spill interactions from validated AIS history.
Non-accusatory, mathematically auditable, and deterministic.
"""

import math
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.core.behaviour_config import BehaviourConfig
from app.services.geographic import GeographicService


class VesselBehaviourEngine:
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

    @staticmethod
    def _get_field(obj: Any, key: str) -> Any:
        if isinstance(obj, dict):
            return obj.get(key)
        return getattr(obj, key, None)

    @staticmethod
    def calculate_circular_mean_heading(headings: List[float]) -> float:
        """Calculate the circular mean of angular headings in [0, 360) degrees."""
        if not headings:
            return 0.0
        sin_sum = sum(math.sin(math.radians(h)) for h in headings if h is not None)
        cos_sum = sum(math.cos(math.radians(h)) for h in headings if h is not None)
        if len(headings) == 0:
            return 0.0
        avg_angle = math.degrees(math.atan2(sin_sum, cos_sum))
        return round(avg_angle % 360.0, 1)

    @staticmethod
    def calculate_circular_variance(headings: List[float]) -> float:
        """
        Calculate circular variance: S = 1 - R, where R is mean resultant length.
        Values range from 0.0 (all identical) to 1.0 (completely dispersed).
        """
        if not headings:
            return 0.0
        valid = [h for h in headings if h is not None]
        if not valid:
            return 0.0
        sin_sum = sum(math.sin(math.radians(h)) for h in valid)
        cos_sum = sum(math.cos(math.radians(h)) for h in valid)
        r = math.sqrt(sin_sum**2 + cos_sum**2) / len(valid)
        return round(max(0.0, min(1.0, 1.0 - r)), 3)

    @classmethod
    def analyze_vessel_behaviour(
        cls,
        vessel: Any,
        track_points: List[Any],
        incident_id: str,
        origin_lat: Optional[float] = None,
        origin_lon: Optional[float] = None,
        origin_uncertainty_km: Optional[float] = None,
        spill_geometry_wkt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Extract complete deterministic behaviour profile & event stream for a vessel.
        """
        vessel_id = str(cls._get_field(vessel, "id") or "")
        vessel_name = str(cls._get_field(vessel, "name") or "Unknown Vessel")
        mmsi = str(cls._get_field(vessel, "mmsi") or "")

        # Sort points chronologically
        valid_points = []
        for p in track_points:
            ts = cls._parse_timestamp(cls._get_field(p, "timestamp"))
            lat = cls._get_field(p, "lat")
            lon = cls._get_field(p, "lon")
            if ts is not None and lat is not None and lon is not None:
                # Validate geographic bounds
                if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
                    valid_points.append(p)

        valid_points.sort(key=lambda pt: cls._parse_timestamp(cls._get_field(pt, "timestamp")) or datetime.min)

        # Handle empty/insufficient data gracefully
        if len(valid_points) < 2:
            return cls._empty_profile(vessel_id, vessel_name, mmsi, incident_id)

        events: List[Dict[str, Any]] = []

        # ── 1. SPEED PROFILE & SPEED EVENTS ────────────────────────
        speeds = [cls._get_field(p, "speed_knots") for p in valid_points]
        valid_speeds = [s for s in speeds if s is not None and s >= 0]
        
        avg_speed = round(sum(valid_speeds) / len(valid_speeds), 1) if valid_speeds else 0.0
        min_speed = round(min(valid_speeds), 1) if valid_speeds else 0.0
        max_speed = round(max(valid_speeds), 1) if valid_speeds else 0.0

        t_first = cls._parse_timestamp(cls._get_field(valid_points[0], "timestamp"))
        t_last = cls._parse_timestamp(cls._get_field(valid_points[-1], "timestamp"))
        total_duration_hours = (t_last - t_first).total_seconds() / 3600.0 if (t_first and t_last) else 0.0

        stationary_duration_min = 0.0
        low_speed_duration_min = 0.0
        accel_events_count = 0
        decel_events_count = 0

        # Detect speed transitions & stationary periods
        current_stat_start = None
        current_low_start = None

        for i in range(len(valid_points)):
            curr_pt = valid_points[i]
            curr_ts = cls._parse_timestamp(cls._get_field(curr_pt, "timestamp"))
            curr_spd = cls._get_field(curr_pt, "speed_knots")
            curr_lat = cls._get_field(curr_pt, "lat")
            curr_lon = cls._get_field(curr_pt, "lon")

            if curr_spd is None:
                continue

            # Stationary accumulation
            if curr_spd <= BehaviourConfig.STATIONARY_THRESHOLD_KNOTS:
                if current_stat_start is None:
                    current_stat_start = (curr_ts, curr_lat, curr_lon)
            else:
                if current_stat_start is not None:
                    s_time, s_lat, s_lon = current_stat_start
                    dur_min = (curr_ts - s_time).total_seconds() / 60.0 if (curr_ts and s_time) else 0.0
                    stationary_duration_min += dur_min
                    if dur_min >= 15.0:  # Minimum threshold to log stationary event
                        events.append({
                            "event_id": str(uuid.uuid4()),
                            "vessel_id": vessel_id,
                            "incident_id": incident_id,
                            "event_type": "STATIONARY_PERIOD",
                            "timestamp": s_time.isoformat() if s_time else None,
                            "latitude": round(s_lat, 6),
                            "longitude": round(s_lon, 6),
                            "measured_value": round(curr_spd, 1),
                            "threshold": f"≤ {BehaviourConfig.STATIONARY_THRESHOLD_KNOTS} kn",
                            "duration_minutes": round(dur_min, 1),
                            "explanation": f"Vessel remained stationary (speed {curr_spd:.1f} kn) for {dur_min:.0f} minutes.",
                        })
                    current_stat_start = None

            # Low speed accumulation
            if curr_spd <= BehaviourConfig.LOW_SPEED_THRESHOLD_KNOTS:
                if current_low_start is None:
                    current_low_start = curr_ts
            else:
                if current_low_start is not None:
                    dur_min = (curr_ts - current_low_start).total_seconds() / 60.0 if (curr_ts and current_low_start) else 0.0
                    low_speed_duration_min += dur_min
                    current_low_start = None

            # Speed changes between adjacent points
            if i > 0:
                prev_pt = valid_points[i - 1]
                prev_spd = cls._get_field(prev_pt, "speed_knots")
                prev_ts = cls._parse_timestamp(cls._get_field(prev_pt, "timestamp"))

                if prev_spd is not None and prev_spd > 0:
                    delta_spd = curr_spd - prev_spd
                    delta_pct = (abs(delta_spd) / prev_spd) * 100.0

                    dt_min = (curr_ts - prev_ts).total_seconds() / 60.0 if (curr_ts and prev_ts) else 1.0

                    if delta_pct >= BehaviourConfig.SUDDEN_SPEED_CHANGE_PERCENT and abs(delta_spd) >= BehaviourConfig.MIN_SPEED_CHANGE_KNOTS:
                        if delta_spd < 0:
                            decel_events_count += 1
                            events.append({
                                "event_id": str(uuid.uuid4()),
                                "vessel_id": vessel_id,
                                "incident_id": incident_id,
                                "event_type": "SPEED_DROP",
                                "timestamp": curr_ts.isoformat() if curr_ts else None,
                                "latitude": round(curr_lat, 6),
                                "longitude": round(curr_lon, 6),
                                "measured_value": round(curr_spd, 1),
                                "threshold": f"{BehaviourConfig.SUDDEN_SPEED_CHANGE_PERCENT}% reduction",
                                "duration_minutes": round(dt_min, 1),
                                "explanation": f"Speed decreased from {prev_spd:.1f} kn to {curr_spd:.1f} kn ({delta_pct:.0f}% change) over {dt_min:.0f} min.",
                            })
                        else:
                            accel_events_count += 1
                            events.append({
                                "event_id": str(uuid.uuid4()),
                                "vessel_id": vessel_id,
                                "incident_id": incident_id,
                                "event_type": "SPEED_INCREASE",
                                "timestamp": curr_ts.isoformat() if curr_ts else None,
                                "latitude": round(curr_lat, 6),
                                "longitude": round(curr_lon, 6),
                                "measured_value": round(curr_spd, 1),
                                "threshold": f"{BehaviourConfig.SUDDEN_SPEED_CHANGE_PERCENT}% acceleration",
                                "duration_minutes": round(dt_min, 1),
                                "explanation": f"Speed increased from {prev_spd:.1f} kn to {curr_spd:.1f} kn ({delta_pct:.0f}% change) over {dt_min:.0f} min.",
                            })

        # Finalize open stationary period
        if current_stat_start is not None and t_last:
            s_time, s_lat, s_lon = current_stat_start
            dur_min = (t_last - s_time).total_seconds() / 60.0
            stationary_duration_min += dur_min
            if dur_min >= 15.0:
                events.append({
                    "event_id": str(uuid.uuid4()),
                    "vessel_id": vessel_id,
                    "incident_id": incident_id,
                    "event_type": "STATIONARY_PERIOD",
                    "timestamp": s_time.isoformat() if s_time else None,
                    "latitude": round(s_lat, 6),
                    "longitude": round(s_lon, 6),
                    "measured_value": 0.0,
                    "threshold": f"≤ {BehaviourConfig.STATIONARY_THRESHOLD_KNOTS} kn",
                    "duration_minutes": round(dur_min, 1),
                    "explanation": f"Vessel stationary period of {dur_min:.0f} minutes recorded at end of track window.",
                })

        # ── 2. COURSE & HEADING ANALYSIS ───────────────────────────
        headings = [cls._get_field(p, "heading_deg") for p in valid_points]
        courses = [cls._get_field(p, "course_deg") for p in valid_points]
        active_headings = [h for h in headings if h is not None] or [c for c in courses if c is not None]

        circ_mean_heading = cls.calculate_circular_mean_heading(active_headings)
        circ_variance = cls.calculate_circular_variance(active_headings)
        heading_consistency = round(1.0 - circ_variance, 3)

        sharp_turns_count = 0
        repeated_turns_count = 0

        turn_history = []
        for i in range(1, len(valid_points)):
            curr_pt = valid_points[i]
            prev_pt = valid_points[i - 1]

            curr_h = cls._get_field(curr_pt, "heading_deg") or cls._get_field(curr_pt, "course_deg")
            prev_h = cls._get_field(prev_pt, "heading_deg") or cls._get_field(prev_pt, "course_deg")
            curr_lat = cls._get_field(curr_pt, "lat")
            curr_lon = cls._get_field(curr_pt, "lon")
            curr_ts = cls._parse_timestamp(cls._get_field(curr_pt, "timestamp"))

            if curr_h is not None and prev_h is not None:
                # Correct angular wrap-around calculation
                h_diff = GeographicService.heading_difference(prev_h, curr_h)

                if h_diff >= BehaviourConfig.SHARP_TURN_THRESHOLD_DEGREES:
                    sharp_turns_count += 1
                    turn_history.append((curr_ts, h_diff))
                    events.append({
                        "event_id": str(uuid.uuid4()),
                        "vessel_id": vessel_id,
                        "incident_id": incident_id,
                        "event_type": "SHARP_TURN",
                        "timestamp": curr_ts.isoformat() if curr_ts else None,
                        "latitude": round(curr_lat, 6),
                        "longitude": round(curr_lon, 6),
                        "measured_value": round(h_diff, 1),
                        "threshold": f"≥ {BehaviourConfig.SHARP_TURN_THRESHOLD_DEGREES}°",
                        "duration_minutes": 0.0,
                        "explanation": f"Sharp course alteration: {h_diff:.1f}° heading deviation detected.",
                    })
                elif h_diff >= BehaviourConfig.COURSE_CHANGE_THRESHOLD_DEGREES:
                    turn_history.append((curr_ts, h_diff))
                    events.append({
                        "event_id": str(uuid.uuid4()),
                        "vessel_id": vessel_id,
                        "incident_id": incident_id,
                        "event_type": "COURSE_CHANGE",
                        "timestamp": curr_ts.isoformat() if curr_ts else None,
                        "latitude": round(curr_lat, 6),
                        "longitude": round(curr_lon, 6),
                        "measured_value": round(h_diff, 1),
                        "threshold": f"≥ {BehaviourConfig.COURSE_CHANGE_THRESHOLD_DEGREES}°",
                        "duration_minutes": 0.0,
                        "explanation": f"Course change of {h_diff:.1f}° observed.",
                    })

        # ── 3. SPATIAL BEHAVIOUR (LOITERING & ROUTE DEVIATIONS) ────
        total_path_distance_km = 0.0
        for i in range(1, len(valid_points)):
            p1 = valid_points[i - 1]
            p2 = valid_points[i]
            lat1, lon1 = cls._get_field(p1, "lat"), cls._get_field(p1, "lon")
            lat2, lon2 = cls._get_field(p2, "lat"), cls._get_field(p2, "lon")
            total_path_distance_km += GeographicService.haversine_distance_km(lat1, lon1, lat2, lon2)

        p_first = valid_points[0]
        p_last = valid_points[-1]
        net_displacement_km = GeographicService.haversine_distance_km(
            cls._get_field(p_first, "lat"), cls._get_field(p_first, "lon"),
            cls._get_field(p_last, "lat"), cls._get_field(p_last, "lon")
        )

        loitering_index = round(net_displacement_km / total_path_distance_km, 3) if total_path_distance_km > 0 else 1.0

        # Sliding window loitering check
        window_size = min(len(valid_points), 10)
        for i in range(len(valid_points) - window_size + 1):
            w_pts = valid_points[i : i + window_size]
            t_w_start = cls._parse_timestamp(cls._get_field(w_pts[0], "timestamp"))
            t_w_end = cls._parse_timestamp(cls._get_field(w_pts[-1], "timestamp"))
            w_duration_min = (t_w_end - t_w_start).total_seconds() / 60.0 if (t_w_start and t_w_end) else 0.0

            if w_duration_min >= BehaviourConfig.LOITERING_MIN_DURATION_MINUTES:
                w_path = sum(
                    GeographicService.haversine_distance_km(
                        cls._get_field(w_pts[k], "lat"), cls._get_field(w_pts[k], "lon"),
                        cls._get_field(w_pts[k + 1], "lat"), cls._get_field(w_pts[k + 1], "lon"),
                    )
                    for k in range(len(w_pts) - 1)
                )
                w_disp = GeographicService.haversine_distance_km(
                    cls._get_field(w_pts[0], "lat"), cls._get_field(w_pts[0], "lon"),
                    cls._get_field(w_pts[-1], "lat"), cls._get_field(w_pts[-1], "lon"),
                )
                if w_path > 0 and (w_disp / w_path) < BehaviourConfig.LOITERING_MAX_DISPLACEMENT_RATIO:
                    mid_pt = w_pts[len(w_pts) // 2]
                    events.append({
                        "event_id": str(uuid.uuid4()),
                        "vessel_id": vessel_id,
                        "incident_id": incident_id,
                        "event_type": "LOITERING",
                        "timestamp": cls._parse_timestamp(cls._get_field(mid_pt, "timestamp")).isoformat() if cls._get_field(mid_pt, "timestamp") else None,
                        "latitude": round(cls._get_field(mid_pt, "lat"), 6),
                        "longitude": round(cls._get_field(mid_pt, "lon"), 6),
                        "measured_value": round(w_disp / w_path, 2),
                        "threshold": f"< {BehaviourConfig.LOITERING_MAX_DISPLACEMENT_RATIO} displacement ratio",
                        "duration_minutes": round(w_duration_min, 1),
                        "explanation": f"Loitering pattern identified: {w_duration_min:.0f} min duration with {w_disp:.1f} km net displacement along {w_path:.1f} km track.",
                    })
                    break  # Log only one primary loitering event per continuous track segment

        # Route deviation detection
        if len(valid_points) >= 6:
            baseline_headings = [
                cls._get_field(p, "course_deg") or cls._get_field(p, "heading_deg")
                for p in valid_points[:3]
                if (cls._get_field(p, "course_deg") or cls._get_field(p, "heading_deg")) is not None
            ]
            if baseline_headings:
                ref_heading = cls.calculate_circular_mean_heading(baseline_headings)
                for i in range(3, len(valid_points)):
                    curr_pt = valid_points[i]
                    c_h = cls._get_field(curr_pt, "course_deg") or cls._get_field(curr_pt, "heading_deg")
                    if c_h is not None:
                        dev = GeographicService.heading_difference(ref_heading, c_h)
                        if dev >= BehaviourConfig.ROUTE_DEVIATION_HEADING_DEGREES:
                            events.append({
                                "event_id": str(uuid.uuid4()),
                                "vessel_id": vessel_id,
                                "incident_id": incident_id,
                                "event_type": "ROUTE_DEVIATION",
                                "timestamp": cls._parse_timestamp(cls._get_field(curr_pt, "timestamp")).isoformat() if cls._get_field(curr_pt, "timestamp") else None,
                                "latitude": round(cls._get_field(curr_pt, "lat"), 6),
                                "longitude": round(cls._get_field(curr_pt, "lon"), 6),
                                "measured_value": round(dev, 1),
                                "threshold": f"≥ {BehaviourConfig.ROUTE_DEVIATION_HEADING_DEGREES}°",
                                "duration_minutes": 0.0,
                                "explanation": f"Observed heading deviated by {dev:.1f}° from expected transit orientation ({ref_heading:.0f}°).",
                            })
                            break

        # ── 4. SPILL INTERACTION & CLOSE APPROACH ──────────────────
        min_distance_to_origin_km = None
        closest_approach_time = None
        closest_approach_lat = None
        closest_approach_lon = None
        entered_spill_zone = False
        dwell_time_minutes = 0.0

        if origin_lat is not None and origin_lon is not None:
            min_dist = float("inf")
            best_pt = None
            for p in valid_points:
                lat = cls._get_field(p, "lat")
                lon = cls._get_field(p, "lon")
                d = GeographicService.haversine_distance_km(lat, lon, origin_lat, origin_lon)
                if d < min_dist:
                    min_dist = d
                    best_pt = p

            if best_pt is not None:
                min_distance_to_origin_km = round(min_dist, 2)
                closest_approach_lat = round(cls._get_field(best_pt, "lat"), 6)
                closest_approach_lon = round(cls._get_field(best_pt, "lon"), 6)
                closest_ts = cls._parse_timestamp(cls._get_field(best_pt, "timestamp"))
                closest_approach_time = closest_ts.isoformat() if closest_ts else None

                # Generate CLOSE_APPROACH event if within designated proximity
                prox_threshold = origin_uncertainty_km if origin_uncertainty_km else BehaviourConfig.CLOSE_APPROACH_THRESHOLD_KM
                if min_dist <= prox_threshold:
                    events.append({
                        "event_id": str(uuid.uuid4()),
                        "vessel_id": vessel_id,
                        "incident_id": incident_id,
                        "event_type": "CLOSE_APPROACH",
                        "timestamp": closest_approach_time,
                        "latitude": closest_approach_lat,
                        "longitude": closest_approach_lon,
                        "measured_value": min_distance_to_origin_km,
                        "threshold": f"≤ {prox_threshold:.1f} km",
                        "duration_minutes": 0.0,
                        "explanation": f"Closest approach recorded at {min_distance_to_origin_km:.2f} km from estimated release origin.",
                    })

        # Spill zone polygon encounter
        if spill_geometry_wkt:
            zone_entered = False
            entry_ts = None
            exit_ts = None

            for p in valid_points:
                lat = cls._get_field(p, "lat")
                lon = cls._get_field(p, "lon")
                ts = cls._parse_timestamp(cls._get_field(p, "timestamp"))

                inside = GeographicService.point_inside_polygon(lat, lon, spill_geometry_wkt)
                if inside:
                    if not zone_entered:
                        zone_entered = True
                        entered_spill_zone = True
                        entry_ts = ts
                        events.append({
                            "event_id": str(uuid.uuid4()),
                            "vessel_id": vessel_id,
                            "incident_id": incident_id,
                            "event_type": "SPILL_ZONE_ENTRY",
                            "timestamp": ts.isoformat() if ts else None,
                            "latitude": round(lat, 6),
                            "longitude": round(lon, 6),
                            "measured_value": 0.0,
                            "threshold": "Inside polygon",
                            "duration_minutes": 0.0,
                            "explanation": "Vessel trajectory intersected delineated oil spill observation boundary.",
                        })
                    exit_ts = ts
                else:
                    if zone_entered:
                        zone_entered = False
                        if entry_ts and exit_ts:
                            dwell = (exit_ts - entry_ts).total_seconds() / 60.0
                            dwell_time_minutes += dwell
                        events.append({
                            "event_id": str(uuid.uuid4()),
                            "vessel_id": vessel_id,
                            "incident_id": incident_id,
                            "event_type": "SPILL_ZONE_EXIT",
                            "timestamp": ts.isoformat() if ts else None,
                            "latitude": round(lat, 6),
                            "longitude": round(lon, 6),
                            "measured_value": 0.0,
                            "threshold": "Outside polygon",
                            "duration_minutes": round(dwell_time_minutes, 1),
                            "explanation": f"Vessel exited oil spill observation boundary (dwell duration: {dwell_time_minutes:.0f} min).",
                        })

            if zone_entered and entry_ts and exit_ts:
                dwell_time_minutes += (exit_ts - entry_ts).total_seconds() / 60.0

        # ── 5. UNIFIED CHRONOLOGICAL EVENT STREAM ──────────────────
        # Secondary deterministic sorting: (timestamp, event_type, event_id)
        events.sort(key=lambda ev: (ev.get("timestamp") or "", ev.get("event_type") or "", ev.get("event_id") or ""))

        # Data quality metrics
        reconstructed_count = sum(1 for p in valid_points if cls._get_field(p, "is_reconstructed"))
        total_count = len(valid_points)
        quality_score = round(max(0.0, min(100.0, (1.0 - (reconstructed_count / total_count)) * 100.0)), 1) if total_count > 0 else 0.0

        return {
            "vessel_id": vessel_id,
            "vessel_name": vessel_name,
            "mmsi": mmsi,
            "incident_id": incident_id,
            "speed_profile": {
                "average_speed_knots": avg_speed,
                "min_speed_knots": min_speed,
                "max_speed_knots": max_speed,
                "active_duration_hours": round(total_duration_hours, 1),
                "stationary_duration_minutes": round(stationary_duration_min, 1),
                "low_speed_duration_minutes": round(low_speed_duration_min, 1),
                "acceleration_events_count": accel_events_count,
                "deceleration_events_count": decel_events_count,
            },
            "course_profile": {
                "circular_mean_heading_deg": circ_mean_heading,
                "heading_variance": circ_variance,
                "heading_consistency": heading_consistency,
                "sharp_turns_count": sharp_turns_count,
            },
            "spatial_behaviour": {
                "total_path_distance_km": round(total_path_distance_km, 2),
                "net_displacement_km": round(net_displacement_km, 2),
                "loitering_index": loitering_index,
            },
            "spill_interaction": {
                "closest_approach_distance_km": min_distance_to_origin_km,
                "closest_approach_timestamp": closest_approach_time,
                "closest_approach_latitude": closest_approach_lat,
                "closest_approach_longitude": closest_approach_lon,
                "entered_spill_zone": entered_spill_zone,
                "dwell_time_minutes": round(dwell_time_minutes, 1),
            },
            "behaviour_events": events,
            "data_quality": {
                "total_points": total_count,
                "reconstructed_points": reconstructed_count,
                "observed_points": total_count - reconstructed_count,
                "quality_score": quality_score,
            },
        }

    @classmethod
    def _empty_profile(cls, vessel_id: str, vessel_name: str, mmsi: str, incident_id: str) -> Dict[str, Any]:
        return {
            "vessel_id": vessel_id,
            "vessel_name": vessel_name,
            "mmsi": mmsi,
            "incident_id": incident_id,
            "speed_profile": {
                "average_speed_knots": 0.0,
                "min_speed_knots": 0.0,
                "max_speed_knots": 0.0,
                "active_duration_hours": 0.0,
                "stationary_duration_minutes": 0.0,
                "low_speed_duration_minutes": 0.0,
                "acceleration_events_count": 0,
                "deceleration_events_count": 0,
            },
            "course_profile": {
                "circular_mean_heading_deg": 0.0,
                "heading_variance": 0.0,
                "heading_consistency": 0.0,
                "sharp_turns_count": 0,
            },
            "spatial_behaviour": {
                "total_path_distance_km": 0.0,
                "net_displacement_km": 0.0,
                "loitering_index": 1.0,
            },
            "spill_interaction": {
                "closest_approach_distance_km": None,
                "closest_approach_timestamp": None,
                "closest_approach_latitude": None,
                "closest_approach_longitude": None,
                "entered_spill_zone": False,
                "dwell_time_minutes": 0.0,
            },
            "behaviour_events": [],
            "data_quality": {
                "total_points": 0,
                "reconstructed_points": 0,
                "observed_points": 0,
                "quality_score": 0.0,
            },
        }
