"""
OCEANTRACE AI — Phase 10: Unified Investigation Timeline & Evidence Correlation Service

Harvests, normalizes, deduplicates, and deterministically correlates investigation events
from Phase 1–7 incident/spill/drift/AIS data, Phase 8 behaviour maneuvers, and Phase 9
attribution results into a single explainable, reproducible timeline.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.timeline_config import TimelineConfig
from app.db.models.incident import (
    Incident, OilSpill, SatelliteObservation, OriginEstimate,
    DriftSimulation, Evidence
)
from app.db.models.vessel import Vessel, VesselTrack
from app.services.geographic import GeographicService
from app.services.ais_reconstruction import AisReconstructionService
from app.services.behaviour_engine import VesselBehaviourEngine
from app.services.attribution_engine import VesselAttributionEngine


class InvestigationTimelineService:

    @staticmethod
    def _parse_ts(ts: Any) -> Optional[datetime]:
        if ts is None:
            return None
        if isinstance(ts, datetime):
            return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        if isinstance(ts, str):
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                return None
        return None

    @classmethod
    def _make_deterministic_id(cls, incident_id: str, source: str, event_type: str, ts_str: str, entity_id: str = "") -> str:
        """
        Generate a strictly deterministic UUIDv5 identifier so repeated runs produce identical IDs.
        """
        unique_seed = f"{incident_id}:{source}:{event_type}:{ts_str}:{entity_id}"
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, unique_seed))

    @classmethod
    def harvest_incident_events(cls, db: Session, incident_id: str) -> List[Dict[str, Any]]:
        """
        Harvest events from Satellite Observations, Oil Spill segmentation, Origin Estimate,
        and Drift Simulations.
        """
        events: List[Dict[str, Any]] = []

        # 1. Satellite Observations
        # 1. Satellite Observations
        sat_obs = db.query(SatelliteObservation).filter(SatelliteObservation.incident_id == incident_id).order_by(SatelliteObservation.acquisition_time.asc()).all()
        for sat in sat_obs:
            ts = cls._parse_ts(sat.acquisition_time)
            if not ts:
                continue
            e_id = cls._make_deterministic_id(incident_id, "satellite_observations", "SATELLITE_OBSERVATION", ts.isoformat(), sat.id)
            events.append({
                "event_id": e_id,
                "timestamp": ts,
                "event_type": "SATELLITE_OBSERVATION",
                "source": "Satellite Observation System",
                "vessel_id": None,
                "vessel_name": None,
                "latitude": None,
                "longitude": None,
                "description": f"Earth observation satellite acquisition ({sat.platform or 'SAR-C'} sensor, {sat.resolution_m or 10.0}m resolution) [Synthetic Demonstration].",
                "severity": "INFO",
                "related_phase": "Phase 11: Remote Sensing",
                "evidence_reference": f"satellite_observations:{sat.id}",
                "data_label": TimelineConfig.PROVENANCE_DEMO_SYNTHETIC,
                "metadata": {
                    "platform": sat.platform,
                    "sensor": sat.sensor,
                    "resolution_m": sat.resolution_m,
                    "processing_status": sat.processing_status,
                }
            })

        # 2. Oil Spill Detection
        spills = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).all()
        spills_chronological = []
        for sp in spills:
            sat_time = None
            if sp.observation and sp.observation.acquisition_time:
                sat_time = cls._parse_ts(sp.observation.acquisition_time)
            elif sat_obs:
                sat_time = cls._parse_ts(sat_obs[0].acquisition_time)
            
            ts = sat_time or datetime.now(timezone.utc)
            # Centroid approximation from WKT or default region
            c_lat, c_lon = 15.59, 65.50
            if sp.centroid_wkt and "POINT" in sp.centroid_wkt:
                try:
                    coords = sp.centroid_wkt.replace("POINT", "").replace("(", "").replace(")", "").strip().split()
                    c_lon, c_lat = float(coords[0]), float(coords[1])
                except Exception:
                    pass

            spills_chronological.append((ts, sp, c_lat, c_lon))

            e_id = cls._make_deterministic_id(incident_id, "oil_spills", "SPILL_DETECTED", ts.isoformat(), sp.id)
            events.append({
                "event_id": e_id,
                "timestamp": ts,
                "event_type": "SPILL_DETECTED",
                "source": "SAR Segmentation Engine",
                "vessel_id": None,
                "vessel_name": None,
                "latitude": c_lat,
                "longitude": c_lon,
                "description": f"Delineated surface oil slick ({sp.area_km2:.1f} km², length: {sp.length_km or 7.8:.1f} km, confidence: {int((sp.confidence or 0.9)*100)}%).",
                "severity": "HIGH",
                "related_phase": "Phase 11: Oil Spill Delineation",
                "evidence_reference": f"oil_spills:{sp.id}",
                "data_label": TimelineConfig.PROVENANCE_DEMO_SYNTHETIC,
                "metadata": {
                    "area_km2": sp.area_km2,
                    "length_km": sp.length_km,
                    "width_km": sp.width_km,
                    "oil_probability": sp.oil_probability,
                    "detection_method": sp.detection_method,
                }
            })

        # 2b. Spill Evolution Progression (Phase 11)
        spills_chronological.sort(key=lambda x: x[0])
        for idx in range(len(spills_chronological) - 1):
            t1, sp1, lat1, lon1 = spills_chronological[idx]
            t2, sp2, lat2, lon2 = spills_chronological[idx + 1]
            dt_h = max(0.1, (t2 - t1).total_seconds() / 3600.0)
            d_area = (sp2.area_km2 or 0.0) - (sp1.area_km2 or 0.0)
            growth_pct = (d_area / max(0.1, sp1.area_km2 or 0.1)) * 100.0
            exp_rate = d_area / dt_h
            from app.services.geographic import GeographicService
            disp_km = GeographicService.haversine_distance_km(lat1, lon1, lat2, lon2)
            bearing_deg = GeographicService.bearing_between_points(lat1, lon1, lat2, lon2)
            drift_knots = (disp_km / dt_h) / 1.852

            evo_id = cls._make_deterministic_id(incident_id, "spill_evolution", "SPILL_EVOLUTION", t2.isoformat(), f"{sp1.id}_{sp2.id}")
            events.append({
                "event_id": evo_id,
                "timestamp": t2,
                "event_type": "SPILL_EVOLUTION",
                "source": "Spill Evolution Engine",
                "vessel_id": None,
                "vessel_name": None,
                "latitude": lat2,
                "longitude": lon2,
                "description": (
                    f"Spill evolution observed over {dt_h:.1f}h window: Area changed by {d_area:+.1f} km² "
                    f"({growth_pct:+.1f}%, expansion rate: {exp_rate:.2f} km²/h). Centroid displaced {disp_km:.1f} km "
                    f"bearing {bearing_deg:.0f}° at {drift_knots:.2f} kts."
                ),
                "severity": "MEDIUM",
                "related_phase": "Phase 11: Satellite & Spill Evolution",
                "evidence_reference": f"oil_spills:{sp1.id}->{sp2.id}",
                "data_label": TimelineConfig.PROVENANCE_DEMO_SYNTHETIC,
                "metadata": {
                    "delta_time_hours": round(dt_h, 2),
                    "delta_area_km2": round(d_area, 2),
                    "area_growth_pct": round(growth_pct, 1),
                    "expansion_rate_km2_per_hr": round(exp_rate, 3),
                    "centroid_displacement_km": round(disp_km, 2),
                    "bearing_deg": round(bearing_deg, 1),
                    "drift_speed_knots": round(drift_knots, 2),
                }
            })

        # 3. Origin Estimate
        origins = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).all()
        for org in origins:
            w_start = cls._parse_ts(org.time_window_start)
            w_end = cls._parse_ts(org.time_window_end)
            ts = w_start or datetime.now(timezone.utc)
            e_id = cls._make_deterministic_id(incident_id, "origin_estimates", "ORIGIN_ESTIMATED", ts.isoformat(), org.id)
            events.append({
                "event_id": e_id,
                "timestamp": ts,
                "event_type": "ORIGIN_ESTIMATED",
                "source": "Backtracking Lagrangian Model",
                "vessel_id": None,
                "vessel_name": None,
                "latitude": org.center_lat,
                "longitude": org.center_lon,
                "description": f"Probable discharge origin localized ({org.center_lat:.3f}°N, {org.center_lon:.3f}°E ±{org.uncertainty_radius_km:.1f} km uncertainty).",
                "severity": "MEDIUM",
                "related_phase": "Phase 6: Origin Backtracking",
                "evidence_reference": f"origin_estimates:{org.id}",
                "data_label": TimelineConfig.PROVENANCE_ESTIMATED,
                "metadata": {
                    "uncertainty_radius_km": org.uncertainty_radius_km,
                    "release_window_start": w_start.isoformat() if w_start else None,
                    "release_window_end": w_end.isoformat() if w_end else None,
                    "probability": getattr(org, "probability", 0.85),
                }
            })

        # 4. Drift Simulations
        sims = db.query(DriftSimulation).filter(DriftSimulation.incident_id == incident_id).all()
        for sim in sims:
            ts = cls._parse_ts(sim.start_time) or datetime.now(timezone.utc)
            e_type = "DRIFT_HINDCAST" if sim.simulation_type == "HINDCAST" else "DRIFT_FORECAST"
            data_lbl = TimelineConfig.PROVENANCE_MODELLED if sim.simulation_type == "HINDCAST" else TimelineConfig.PROVENANCE_FORECAST
            e_id = cls._make_deterministic_id(incident_id, "drift_simulations", e_type, ts.isoformat(), sim.id)
            events.append({
                "event_id": e_id,
                "timestamp": ts,
                "event_type": e_type,
                "source": "Lagrangian Particle Drift Model",
                "vessel_id": None,
                "vessel_name": None,
                "latitude": None,
                "longitude": None,
                "description": f"MetOcean {sim.simulation_type.lower()} simulation executed ({sim.num_particles or 50} Lagrangian tracer particles).",
                "severity": "INFO",
                "related_phase": "Phase 4: Environmental Drift",
                "evidence_reference": f"drift_simulations:{sim.id}",
                "data_label": data_lbl,
                "metadata": {
                    "simulation_type": sim.simulation_type,
                    "num_particles": sim.num_particles,
                    "wind_drift_coefficient": sim.wind_drift_coefficient,
                    "diffusion_coefficient": sim.diffusion_coefficient,
                }
            })

        return events

    @classmethod
    def harvest_vessel_events(
        cls,
        db: Session,
        incident_id: str,
        target_vessel_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Harvest vessel movements, Phase 8 behaviour maneuvers, and Phase 9 attribution updates.
        """
        events: List[Dict[str, Any]] = []

        origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
        spill = db.query(OilSpill).filter(OilSpill.incident_id == incident_id).first()

        v_query = db.query(Vessel)
        if target_vessel_ids:
            v_query = v_query.filter(Vessel.id.in_(target_vessel_ids))
        else:
            v_query = v_query.filter(Vessel.is_candidate == True)
        candidates = v_query.all()

        tracks = db.query(VesselTrack).filter(VesselTrack.incident_id == incident_id).all()
        tracks_by_vessel = {t.vessel_id: t for t in tracks}

        for v in candidates:
            track = tracks_by_vessel.get(v.id)
            pts: List[Any] = []
            if track:
                out_tracks, stats = AisReconstructionService.simulate_and_reconstruct([track])
                if out_tracks:
                    pts = out_tracks[0]["points"]

            if not pts:
                continue

            # Run Phase 8 Behaviour Engine
            beh_profile = VesselBehaviourEngine.analyze_vessel_behaviour(
                vessel=v,
                track_points=pts,
                incident_id=incident_id,
                origin_lat=origin.center_lat if origin else None,
                origin_lon=origin.center_lon if origin else None,
                origin_uncertainty_km=origin.uncertainty_radius_km if origin else None,
                spill_geometry_wkt=spill.geometry_wkt if spill else None,
            )

            # Ingest Approach & Departure
            o_lat = origin.center_lat if origin else 15.58
            o_lon = origin.center_lon if origin else 65.48
            approach_pt = None
            departure_pt = None
            for p in pts:
                p_lat = p.get("lat") if isinstance(p, dict) else getattr(p, "lat", None)
                p_lon = p.get("lon") if isinstance(p, dict) else getattr(p, "lon", None)
                if p_lat is not None and p_lon is not None:
                    d = GeographicService.haversine_distance_km(p_lat, p_lon, o_lat, o_lon)
                    if d <= TimelineConfig.APPROACH_PROXIMITY_THRESHOLD_KM:
                        if approach_pt is None:
                            approach_pt = p
                        departure_pt = p

            if approach_pt:
                a_ts = cls._parse_ts(approach_pt.get("timestamp") if isinstance(approach_pt, dict) else getattr(approach_pt, "timestamp", None))
                if a_ts:
                    a_lat = round(approach_pt.get("lat") if isinstance(approach_pt, dict) else getattr(approach_pt, "lat", 0.0), 5)
                    a_lon = round(approach_pt.get("lon") if isinstance(approach_pt, dict) else getattr(approach_pt, "lon", 0.0), 5)
                    e_id = cls._make_deterministic_id(incident_id, "vessel_transit", "VESSEL_APPROACH", a_ts.isoformat(), v.id)
                    events.append({
                        "event_id": e_id,
                        "timestamp": a_ts,
                        "event_type": "VESSEL_APPROACH",
                        "source": "Phase 7 Trajectory Monitoring",
                        "vessel_id": v.id,
                        "vessel_name": v.name,
                        "latitude": a_lat,
                        "longitude": a_lon,
                        "description": f"Vessel entered investigation AOI ({TimelineConfig.APPROACH_PROXIMITY_THRESHOLD_KM:.0f} km perimeter of origin).",
                        "severity": "LOW",
                        "related_phase": "Phase 7: Trajectory Analysis",
                        "evidence_reference": f"ais_points:{v.id}",
                        "data_label": TimelineConfig.PROVENANCE_OBSERVED,
                        "metadata": {"distance_to_origin_km": round(GeographicService.haversine_distance_km(a_lat, a_lon, o_lat, o_lon), 1)},
                    })

            # Ingest Phase 8 Detected Behaviour Events
            raw_beh_events = beh_profile.get("behaviour_events", [])
            for b_ev in raw_beh_events:
                ev_ts = cls._parse_ts(b_ev.get("timestamp"))
                if not ev_ts:
                    continue
                ev_type = b_ev.get("event_type", "BEHAVIOUR_EVENT")
                e_id = cls._make_deterministic_id(incident_id, "behaviour_engine", ev_type, ev_ts.isoformat(), f"{v.id}_{b_ev.get('measured_value')}")
                
                # Determine severity
                sev = "MEDIUM"
                if ev_type in ["CLOSE_APPROACH", "SPILL_ZONE_ENTRY", "STATIONARY_PERIOD", "LOITERING"]:
                    sev = "HIGH"
                elif ev_type in ["SPEED_INCREASE", "VESSEL_DEPARTURE"]:
                    sev = "LOW"

                events.append({
                    "event_id": e_id,
                    "timestamp": ev_ts,
                    "event_type": ev_type,
                    "source": "Phase 8 Behaviour Analysis Engine",
                    "vessel_id": v.id,
                    "vessel_name": v.name,
                    "latitude": b_ev.get("latitude"),
                    "longitude": b_ev.get("longitude"),
                    "description": b_ev.get("explanation") or f"Detected {ev_type.replace('_', ' ').lower()}.",
                    "severity": sev,
                    "related_phase": "Phase 8: Vessel Behaviour",
                    "evidence_reference": f"behaviour_events:{b_ev.get('event_id', v.id)}",
                    "data_label": TimelineConfig.PROVENANCE_ESTIMATED,
                    "metadata": {
                        "measured_value": b_ev.get("measured_value"),
                        "threshold": b_ev.get("threshold"),
                        "duration_minutes": b_ev.get("duration_minutes", 0.0),
                    }
                })

            if departure_pt and departure_pt != approach_pt:
                d_ts = cls._parse_ts(departure_pt.get("timestamp") if isinstance(departure_pt, dict) else getattr(departure_pt, "timestamp", None))
                if d_ts:
                    d_lat = round(departure_pt.get("lat") if isinstance(departure_pt, dict) else getattr(departure_pt, "lat", 0.0), 5)
                    d_lon = round(departure_pt.get("lon") if isinstance(departure_pt, dict) else getattr(departure_pt, "lon", 0.0), 5)
                    e_id = cls._make_deterministic_id(incident_id, "vessel_transit", "VESSEL_DEPARTURE", d_ts.isoformat(), v.id)
                    events.append({
                        "event_id": e_id,
                        "timestamp": d_ts,
                        "event_type": "VESSEL_DEPARTURE",
                        "source": "Phase 7 Trajectory Monitoring",
                        "vessel_id": v.id,
                        "vessel_name": v.name,
                        "latitude": d_lat,
                        "longitude": d_lon,
                        "description": f"Vessel exited primary investigation corridor, continuing transit.",
                        "severity": "LOW",
                        "related_phase": "Phase 7: Trajectory Analysis",
                        "evidence_reference": f"ais_points:{v.id}",
                        "data_label": TimelineConfig.PROVENANCE_OBSERVED,
                        "metadata": {"distance_to_origin_km": round(GeographicService.haversine_distance_km(d_lat, d_lon, o_lat, o_lon), 1)},
                    })

            # Ingest Phase 9 Attribution Result
            attr = VesselAttributionEngine.score_vessel(
                vessel=v,
                behaviour_profile=beh_profile,
                origin_estimate=origin,
            )
            # Timestamp attribution update after departure or latest observation
            last_pt = pts[-1] if pts else None
            attr_ts = cls._parse_ts(last_pt.get("timestamp") if isinstance(last_pt, dict) else getattr(last_pt, "timestamp", None)) if last_pt else None
            if not attr_ts:
                attr_ts = datetime.now(timezone.utc)

            e_id = cls._make_deterministic_id(incident_id, "attribution_engine", "ATTRIBUTION_UPDATE", attr_ts.isoformat(), v.id)
            events.append({
                "event_id": e_id,
                "timestamp": attr_ts,
                "event_type": "ATTRIBUTION_UPDATE",
                "source": "Phase 9 Multi-Criteria Attribution Engine",
                "vessel_id": v.id,
                "vessel_name": v.name,
                "latitude": beh_profile.get("spill_interaction", {}).get("closest_approach_latitude"),
                "longitude": beh_profile.get("spill_interaction", {}).get("closest_approach_longitude"),
                "description": f"Attribution assessment synthesized: composite score {attr['overall_score']:.1f}/100 ({attr['relevance_level']}).",
                "severity": "INFO",
                "related_phase": "Phase 9: Evidence-Based Attribution",
                "evidence_reference": f"attribution_scores:{v.id}",
                "data_label": TimelineConfig.PROVENANCE_ESTIMATED,
                "metadata": {
                    "overall_score": attr["overall_score"],
                    "relevance_level": attr["relevance_level"],
                    "category_scores": attr["category_scores"],
                    "closest_approach_km": attr.get("closest_approach_km"),
                }
            })

        return events

    @classmethod
    def deduplicate_and_sort(cls, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deduplicate events based on (source, event_type, timestamp, vessel_id)
        and sort deterministically: (timestamp ASC, event_type ASC, event_id ASC).
        """
        seen = set()
        unique_events: List[Dict[str, Any]] = []

        for e in events:
            ts = e["timestamp"]
            ts_str = ts.isoformat() if isinstance(ts, datetime) else str(ts)
            key = (
                e.get("source", ""),
                e.get("event_type", ""),
                ts_str,
                e.get("vessel_id") or "",
                round(e.get("latitude") or 0.0, 4),
                round(e.get("longitude") or 0.0, 4),
            )
            if key not in seen:
                seen.add(key)
                unique_events.append(e)

        # Deterministic sorting: (timestamp, event_type, event_id)
        unique_events.sort(key=lambda item: (
            item["timestamp"].isoformat() if isinstance(item["timestamp"], datetime) else str(item["timestamp"]),
            item.get("event_type", ""),
            item.get("event_id", "")
        ))

        return unique_events

    @classmethod
    def build_correlation_chains(
        cls,
        events: List[Dict[str, Any]],
        candidates: List[Any],
        origin_lat: float,
        origin_lon: float,
    ) -> List[Dict[str, Any]]:
        """
        Build deterministic correlation chains per candidate vessel linking:
        Satellite/Spill -> Vessel Approach -> Kinematic Maneuvers -> Zone Encounter -> Closest Approach -> Departure -> Attribution
        """
        chains: List[Dict[str, Any]] = []

        # Find key incident milestone events
        sat_event = next((e for e in events if e["event_type"] == "SATELLITE_OBSERVATION"), None)
        spill_event = next((e for e in events if e["event_type"] == "SPILL_DETECTED"), None)
        origin_event = next((e for e in events if e["event_type"] == "ORIGIN_ESTIMATED"), None)

        for v in candidates:
            v_id = str(v.id if hasattr(v, "id") else v.get("id"))
            v_name = str(v.name if hasattr(v, "name") else v.get("name"))

            # Filter events belonging to this vessel
            v_events = [e for e in events if e.get("vessel_id") == v_id]
            if len(v_events) < TimelineConfig.MIN_EVENTS_FOR_CHAIN:
                continue

            # Full correlated event sequence for this vessel
            chain_events: List[Dict[str, Any]] = []
            if sat_event: chain_events.append(sat_event)
            if spill_event: chain_events.append(spill_event)
            if origin_event: chain_events.append(origin_event)
            chain_events.extend(v_events)

            # Sort chronological sequence
            chain_events.sort(key=lambda e: (
                e["timestamp"].isoformat() if isinstance(e["timestamp"], datetime) else str(e["timestamp"]),
                e.get("event_type", "")
            ))

            relationships: List[Dict[str, Any]] = []
            evidence_refs: List[str] = []

            for i in range(len(chain_events) - 1):
                e_from = chain_events[i]
                e_to = chain_events[i + 1]

                t1 = e_from["timestamp"]
                t2 = e_to["timestamp"]
                dt_hrs = None
                if isinstance(t1, datetime) and isinstance(t2, datetime):
                    dt_hrs = round((t2 - t1).total_seconds() / 3600.0, 1)

                dist_km = None
                if e_from.get("latitude") and e_from.get("longitude") and e_to.get("latitude") and e_to.get("longitude"):
                    dist_km = round(GeographicService.haversine_distance_km(
                        e_from["latitude"], e_from["longitude"], e_to["latitude"], e_to["longitude"]
                    ), 1)

                # Determine non-accusatory relationship wording
                rel_type = "temporally_associated"
                desc = f"Observed event '{e_to['event_type']}' occurred {dt_hrs}h following '{e_from['event_type']}'."
                if dist_km is not None and dist_km <= 15.0:
                    rel_type = "spatially_proximate"
                    desc = f"Maneuver coincided within {dist_km} km of preceding event location."

                relationships.append({
                    "from_event_id": e_from["event_id"],
                    "to_event_id": e_to["event_id"],
                    "relationship_type": rel_type,
                    "description": desc,
                    "temporal_delta_hours": dt_hrs,
                    "spatial_distance_km": dist_km,
                })

                if e_to.get("evidence_reference"):
                    evidence_refs.append(e_to["evidence_reference"])

            # Calculate deterministic correlation strength (0.0 to 1.0)
            # Separate from Phase 9 attribution score; counts milestones presence
            milestone_types = {e["event_type"] for e in v_events}
            strength_pts = 0.2  # base for transit presence
            if "VESSEL_APPROACH" in milestone_types: strength_pts += 0.15
            if "CLOSE_APPROACH" in milestone_types: strength_pts += 0.25
            if "SPILL_ZONE_ENTRY" in milestone_types: strength_pts += 0.20
            if any(t in milestone_types for t in ["SPEED_DROP", "LOITERING", "STATIONARY_PERIOD"]): strength_pts += 0.20
            correlation_strength = round(min(1.0, strength_pts), 2)

            # Document limitations
            limitations = [
                "Drift simulation particles utilize modelled atmospheric and hydrodynamic currents.",
                "Correlation establishes spatial-temporal concurrence and does not constitute conclusive physical liability.",
            ]
            reconstructed_count = sum(1 for e in v_events if e.get("metadata", {}).get("is_reconstructed"))
            if reconstructed_count > 0:
                limitations.append(f"Vessel trajectory includes {reconstructed_count} reconstructed AIS points.")

            chain_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"chain:{v_id}:{len(chain_events)}"))
            start_ts = chain_events[0]["timestamp"]
            end_ts = chain_events[-1]["timestamp"]

            chains.append({
                "correlation_id": chain_id,
                "vessel_id": v_id,
                "vessel_name": v_name,
                "chain_type": "VESSEL_INCIDENT_CORRELATION",
                "event_ids": [e["event_id"] for e in chain_events],
                "start_timestamp": start_ts,
                "end_timestamp": end_ts,
                "correlation_strength": correlation_strength,
                "relationships": relationships,
                "evidence_references": list(set(evidence_refs)),
                "limitations": limitations,
            })

        return chains

    @classmethod
    def build_unified_timeline(
        cls,
        db: Session,
        incident_id: str,
        vessel_id: Optional[str] = None,
        event_type: Optional[str] = None,
        category: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Build, correlate, filter, and return complete unified investigation timeline.
        """
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        origin = db.query(OriginEstimate).filter(OriginEstimate.incident_id == incident_id).first()
        o_lat = origin.center_lat if origin else 15.58
        o_lon = origin.center_lon if origin else 65.48

        # 1. Harvest incident events
        inc_events = cls.harvest_incident_events(db, incident_id)

        # 2. Harvest candidate vessel events
        candidates = db.query(Vessel).filter(Vessel.is_candidate == True).all()
        target_ids = [vessel_id] if vessel_id else [v.id for v in candidates]
        v_events = cls.harvest_vessel_events(db, incident_id, target_vessel_ids=target_ids)

        all_events = inc_events + v_events

        # 3. Deduplicate and sort deterministically
        sorted_events = cls.deduplicate_and_sort(all_events)

        # 4. Build correlation chains
        correlations = cls.build_correlation_chains(sorted_events, candidates, o_lat, o_lon)

        # 5. Apply investigator filters (presentation-level only)
        filtered = sorted_events
        if vessel_id:
            filtered = [e for e in filtered if e.get("vessel_id") == vessel_id or e.get("vessel_id") is None]
        if event_type:
            filtered = [e for e in filtered if e.get("event_type") == event_type]
        if category and category.upper() != TimelineConfig.CAT_ALL:
            cat_upper = category.upper()
            filtered = [e for e in filtered if TimelineConfig.EVENT_CATEGORY_MAP.get(e.get("event_type", ""), "") == cat_upper]
        if start_time:
            st = cls._parse_ts(start_time)
            if st:
                filtered = [e for e in filtered if e["timestamp"] >= st]
        if end_time:
            et = cls._parse_ts(end_time)
            if et:
                filtered = [e for e in filtered if e["timestamp"] <= et]

        return {
            "incident_id": incident_id,
            "total_events": len(filtered),
            "events": filtered,
            "correlations": correlations,
            "filter_categories": TimelineConfig.CATEGORIES,
        }
