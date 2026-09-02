import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any

class AisReconstructionService:
    GAP_THRESHOLD_HOURS = 2.0
    INTERPOLATION_INTERVAL_HOURS = 1.0

    @staticmethod
    def simulate_and_reconstruct(tracks: List[Any]) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
        total_vessels = len(tracks)
        vessels_with_gaps = 0
        total_points = 0
        reconstructed_points = 0
        
        out_tracks = []
        
        for track in tracks:
            vessel_id = str(track.vessel_id)
            h = int(hashlib.sha256(vessel_id.encode()).hexdigest(), 16)
            
            # Deterministic gap: 1 in 3 vessels has a gap
            has_gap = (h % 3 == 0)
            if has_gap:
                vessels_with_gaps += 1
                
            points = sorted(track.points, key=lambda p: p.timestamp) if track.points else []
            
            # Simulate gap by dropping points deterministically
            if has_gap and len(points) > 10:
                # Use hash to determine drop start and length
                drop_start = 5 + (h % (len(points) - 10))
                drop_len = 4 + (h % 6)  # Drop between 4 and 9 points
                
                simulated_points = points[:drop_start] + points[drop_start + drop_len:]
            else:
                simulated_points = points
                
            final_points = []
            
            for i in range(len(simulated_points)):
                p = simulated_points[i]
                final_points.append({
                    "timestamp": p.timestamp,
                    "lat": p.lat,
                    "lon": p.lon,
                    "speed_knots": p.speed_knots,
                    "course_deg": p.course_deg,
                    "heading_deg": p.heading_deg,
                    "is_reconstructed": False,
                    "reconstruction_method": None,
                    "gap_duration_hrs": 0.0
                })
                total_points += 1
                
                # Check for gap with the next point
                if i < len(simulated_points) - 1:
                    p_next = simulated_points[i + 1]
                    t1 = p.timestamp.timestamp() if p.timestamp else 0
                    t2 = p_next.timestamp.timestamp() if p_next.timestamp else 0
                    dt_hours = (t2 - t1) / 3600.0
                    
                    if dt_hours > AisReconstructionService.GAP_THRESHOLD_HOURS:
                        # Reconstruct points
                        num_interpolated = int(dt_hours // AisReconstructionService.INTERPOLATION_INTERVAL_HOURS)
                        
                        for j in range(1, num_interpolated + 1):
                            fraction = j / (num_interpolated + 1)
                            
                            mid_t = t1 + (t2 - t1) * fraction
                            mid_lat = p.lat + (p_next.lat - p.lat) * fraction
                            mid_lon = p.lon + (p_next.lon - p.lon) * fraction
                            
                            # Simple interpolation for speed and course
                            mid_speed = p.speed_knots + (p_next.speed_knots - p.speed_knots) * fraction
                            
                            # Handle course wrap-around
                            c1 = p.course_deg
                            c2 = p_next.course_deg
                            if abs(c2 - c1) > 180:
                                if c2 > c1:
                                    c1 += 360
                                else:
                                    c2 += 360
                            mid_course = (c1 + (c2 - c1) * fraction) % 360
                            
                            h1 = p.heading_deg
                            h2 = p_next.heading_deg
                            if abs(h2 - h1) > 180:
                                if h2 > h1:
                                    h1 += 360
                                else:
                                    h2 += 360
                            mid_heading = (h1 + (h2 - h1) * fraction) % 360
                            
                            final_points.append({
                                "timestamp": datetime.fromtimestamp(mid_t, tz=p.timestamp.tzinfo) if p.timestamp else None,
                                "lat": mid_lat,
                                "lon": mid_lon,
                                "speed_knots": round(mid_speed, 1),
                                "course_deg": round(mid_course, 1),
                                "heading_deg": round(mid_heading, 1),
                                "is_reconstructed": True,
                                "reconstruction_method": "linear_interpolation",
                                "gap_duration_hrs": round(dt_hours, 2)
                            })
                            total_points += 1
                            reconstructed_points += 1
                            
            out_tracks.append({
                "id": track.id,
                "vessel_id": track.vessel_id,
                "start_time": track.start_time,
                "end_time": track.end_time,
                "points": final_points
            })
            
        # Calculate overall confidence
        # A simple metric: 1.0 - (reconstructed_points / total_points)
        if total_points > 0:
            overall_confidence = max(0.0, min(1.0, 1.0 - (reconstructed_points / total_points)))
        else:
            overall_confidence = 0.0
            
        stats = {
            "total_vessels": total_vessels,
            "vessels_with_gaps": vessels_with_gaps,
            "total_points": total_points,
            "reconstructed_points": reconstructed_points,
            "overall_confidence": round(overall_confidence, 2)
        }
        
        return out_tracks, stats
