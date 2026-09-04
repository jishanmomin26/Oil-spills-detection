from typing import Any, Dict, List, Optional
from datetime import datetime
from app.services.geographic import GeographicService

class ProximityEngine:
    @staticmethod
    def calculate_origin_proximity(
        track_points: List[Any], 
        origin_lat: float, 
        origin_lon: float
    ) -> Dict[str, Any]:
        """
        Calculate proximity metrics of a vessel track to a spill origin.
        Returns closest approach details.
        """
        if not track_points:
            return {
                "min_distance_km": None,
                "closest_approach_time": None,
                "closest_approach_lat": None,
                "closest_approach_lon": None
            }
            
        closest_pt = GeographicService.nearest_point_on_track(track_points, origin_lat, origin_lon)
        
        if not closest_pt:
            return {
                "min_distance_km": None,
                "closest_approach_time": None,
                "closest_approach_lat": None,
                "closest_approach_lon": None
            }
            
        lat = closest_pt.lat if hasattr(closest_pt, 'lat') else closest_pt.get('lat')
        lon = closest_pt.lon if hasattr(closest_pt, 'lon') else closest_pt.get('lon')
        timestamp = closest_pt.timestamp if hasattr(closest_pt, 'timestamp') else closest_pt.get('timestamp')
        
        min_dist = GeographicService.haversine_distance_km(lat, lon, origin_lat, origin_lon)
        
        return {
            "min_distance_km": min_dist,
            "closest_approach_time": timestamp,
            "closest_approach_lat": lat,
            "closest_approach_lon": lon
        }

    @staticmethod
    def calculate_spill_zone_encounter(
        track_points: List[Any], 
        spill_zone_wkt: str
    ) -> Dict[str, Any]:
        """
        Determine if and when a vessel encountered the spill investigation zone.
        """
        if not track_points or not spill_zone_wkt:
            return {
                "entered_spill_zone": False,
                "entry_time": None,
                "exit_time": None,
                "encounter_duration_minutes": 0,
                "number_of_encounters": 0,
                "distance_travelled_inside_km": 0.0
            }

        sorted_points = sorted(
            track_points, 
            key=lambda p: (p.timestamp if hasattr(p, 'timestamp') else p.get('timestamp')) or datetime.min
        )

        inside = False
        encounters = 0
        entry_time = None
        exit_time = None
        duration_minutes = 0.0
        distance_inside_km = 0.0
        
        current_entry_time = None
        last_inside_pt = None

        for pt in sorted_points:
            lat = pt.lat if hasattr(pt, 'lat') else pt.get('lat')
            lon = pt.lon if hasattr(pt, 'lon') else pt.get('lon')
            timestamp = pt.timestamp if hasattr(pt, 'timestamp') else pt.get('timestamp')
            
            if lat is None or lon is None or timestamp is None:
                continue
                
            is_inside = GeographicService.point_inside_polygon(lat, lon, spill_zone_wkt)
            
            if is_inside:
                if not inside:
                    # Just entered
                    inside = True
                    encounters += 1
                    current_entry_time = timestamp
                    if entry_time is None:
                        entry_time = timestamp
                
                # If we were already inside, accumulate distance
                if last_inside_pt:
                    l_lat = last_inside_pt.lat if hasattr(last_inside_pt, 'lat') else last_inside_pt.get('lat')
                    l_lon = last_inside_pt.lon if hasattr(last_inside_pt, 'lon') else last_inside_pt.get('lon')
                    distance_inside_km += GeographicService.haversine_distance_km(l_lat, l_lon, lat, lon)
                    
                last_inside_pt = pt
                exit_time = timestamp # Keep updating exit time while inside
            else:
                if inside:
                    # Just exited
                    inside = False
                    if current_entry_time and exit_time:
                        dur = (exit_time - current_entry_time).total_seconds() / 60.0
                        duration_minutes += dur
                    last_inside_pt = None
                    
        # Handle case where track ends while still inside zone
        if inside and current_entry_time and exit_time:
            dur = (exit_time - current_entry_time).total_seconds() / 60.0
            duration_minutes += dur

        return {
            "entered_spill_zone": encounters > 0,
            "entry_time": entry_time,
            "exit_time": exit_time if encounters > 0 else None,
            "encounter_duration_minutes": round(duration_minutes, 2),
            "number_of_encounters": encounters,
            "distance_travelled_inside_km": round(distance_inside_km, 2)
        }
