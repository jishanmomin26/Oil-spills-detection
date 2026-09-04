from typing import Any, Dict, List, Optional
from datetime import datetime
from app.services.geographic import GeographicService
from app.services.proximity_engine import ProximityEngine

class AisFiltering:
    @staticmethod
    def filter_vessels(
        vessels: List[Any],
        tracks: List[Any],
        spill_lat: float,
        spill_lon: float,
        spill_zone_wkt: str,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compound AIS filtering.
        filters structure:
        {
            "max_distance_km": float,
            "min_time": datetime,
            "max_time": datetime,
            "vessel_types": List[str],
            "min_speed": float,
            "max_speed": float,
            "must_encounter_spill": bool
        }
        Returns: matching vessels, counts, and funnel data.
        """
        
        # Build lookup for tracks
        track_by_vessel = {t.vessel_id if hasattr(t, 'vessel_id') else t.get('vessel_id'): t for t in tracks}
        
        total_vessels = len(vessels)
        
        # Stages
        spatial_candidates = []
        temporal_candidates = []
        trajectory_candidates = []
        final_candidates = []
        
        filtering_details = []
        
        for v in vessels:
            v_id = v.id if hasattr(v, 'id') else v.get('id')
            v_type = v.vessel_type if hasattr(v, 'vessel_type') else v.get('vessel_type')
            
            track = track_by_vessel.get(v_id)
            if not track:
                filtering_details.append({
                    "vessel_id": v_id, "stage": "spatial", "passed": False, 
                    "reason": "No track data"
                })
                continue
                
            pts = track.points if hasattr(track, 'points') else track.get('points', [])
            
            # --- VESSEL TYPE FILTER ---
            if filters.get("vessel_types") and v_type not in filters["vessel_types"]:
                filtering_details.append({
                    "vessel_id": v_id, "stage": "vessel_type", "passed": False, 
                    "reason": "Vessel type excluded"
                })
                continue
                
            # --- SPATIAL FILTER (Distance) ---
            max_dist = filters.get("max_distance_km")
            prox = ProximityEngine.calculate_origin_proximity(pts, spill_lat, spill_lon)
            min_dist = prox.get("min_distance_km")
            
            passed_spatial = True
            if max_dist is not None:
                if min_dist is None or min_dist > max_dist:
                    passed_spatial = False
                    filtering_details.append({
                        "vessel_id": v_id, "stage": "spatial", "passed": False, 
                        "reason": f"Distance {min_dist} > {max_dist}"
                    })
                    
            if passed_spatial:
                spatial_candidates.append(v)
                filtering_details.append({
                    "vessel_id": v_id, "stage": "spatial", "passed": True
                })
            else:
                continue
                
            # --- TEMPORAL FILTER ---
            min_t = filters.get("min_time")
            max_t = filters.get("max_time")
            
            passed_temporal = False
            # Check if any point falls within time window
            for pt in pts:
                ts = pt.timestamp if hasattr(pt, 'timestamp') else pt.get('timestamp')
                if ts:
                    # Parse if string
                    if isinstance(ts, str):
                        try:
                            ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                        except:
                            pass
                    
                    if min_t and ts < min_t: continue
                    if max_t and ts > max_t: continue
                    passed_temporal = True
                    break
                    
            if not min_t and not max_t:
                passed_temporal = True
                
            if passed_temporal:
                temporal_candidates.append(v)
                filtering_details.append({
                    "vessel_id": v_id, "stage": "temporal", "passed": True
                })
            else:
                filtering_details.append({
                    "vessel_id": v_id, "stage": "temporal", "passed": False, 
                    "reason": "Outside time window"
                })
                continue
                
            # --- TRAJECTORY FILTER (Spill encounter & Movement) ---
            passed_trajectory = True
            
            if filters.get("must_encounter_spill"):
                enc = ProximityEngine.calculate_spill_zone_encounter(pts, spill_zone_wkt)
                if not enc.get("entered_spill_zone"):
                    passed_trajectory = False
                    filtering_details.append({
                        "vessel_id": v_id, "stage": "trajectory", "passed": False, 
                        "reason": "Did not encounter spill zone"
                    })
                    
            min_s = filters.get("min_speed")
            max_s = filters.get("max_speed")
            if (min_s is not None or max_s is not None) and passed_trajectory:
                # Check if vessel speed meets criteria at least once (or on average? Let's say max speed within window)
                speeds = [p.speed_knots if hasattr(p, 'speed_knots') else p.get('speed_knots') for p in pts]
                speeds = [s for s in speeds if s is not None]
                if speeds:
                    v_max_s = max(speeds)
                    if min_s is not None and v_max_s < min_s:
                        passed_trajectory = False
                        filtering_details.append({
                            "vessel_id": v_id, "stage": "trajectory", "passed": False, 
                            "reason": f"Speed {v_max_s} < {min_s}"
                        })
                    elif max_s is not None and v_max_s > max_s:
                        passed_trajectory = False
                        filtering_details.append({
                            "vessel_id": v_id, "stage": "trajectory", "passed": False, 
                            "reason": f"Speed {v_max_s} > {max_s}"
                        })
                else:
                    passed_trajectory = False
                    
            if passed_trajectory:
                trajectory_candidates.append(v)
                final_candidates.append(v)
                filtering_details.append({
                    "vessel_id": v_id, "stage": "trajectory", "passed": True
                })
                
        return {
            "total_vessels": total_vessels,
            "spatial_candidates": len(spatial_candidates),
            "temporal_candidates": len(temporal_candidates),
            "trajectory_candidates": len(trajectory_candidates),
            "behaviour_candidates": len(final_candidates),
            "final_candidates": len(final_candidates),
            "matched_vessels": final_candidates,
            "details": filtering_details
        }
