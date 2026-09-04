from typing import Any, Dict, List
from datetime import datetime
from app.services.geographic import GeographicService
from app.services.proximity_engine import ProximityEngine

class TrajectoryAnalysis:
    SHARP_TURN_THRESHOLD_DEG = 45.0
    SPEED_CHANGE_THRESHOLD_PCT = 0.20
    STOP_SPEED_THRESHOLD_KNOTS = 1.0
    
    @staticmethod
    def detect_trajectory_events(track_points: List[Any]) -> List[Dict[str, Any]]:
        """
        Detect significant events in a trajectory:
        - Sharp turns
        - Speed changes
        - Sudden stops
        - Route deviations
        """
        events = []
        if not track_points or len(track_points) < 2:
            return events
            
        sorted_points = sorted(
            track_points, 
            key=lambda p: (p.timestamp if hasattr(p, 'timestamp') else p.get('timestamp')) or datetime.min
        )
        
        for i in range(1, len(sorted_points)):
            prev = sorted_points[i-1]
            curr = sorted_points[i]
            
            p_course = prev.course_deg if hasattr(prev, 'course_deg') else prev.get('course_deg')
            c_course = curr.course_deg if hasattr(curr, 'course_deg') else curr.get('course_deg')
            p_speed = prev.speed_knots if hasattr(prev, 'speed_knots') else prev.get('speed_knots')
            c_speed = curr.speed_knots if hasattr(curr, 'speed_knots') else curr.get('speed_knots')
            c_lat = curr.lat if hasattr(curr, 'lat') else curr.get('lat')
            c_lon = curr.lon if hasattr(curr, 'lon') else curr.get('lon')
            c_ts = curr.timestamp if hasattr(curr, 'timestamp') else curr.get('timestamp')
            
            # Course change detection
            if p_course is not None and c_course is not None:
                diff = GeographicService.heading_difference(p_course, c_course)
                if diff > TrajectoryAnalysis.SHARP_TURN_THRESHOLD_DEG:
                    events.append({
                        "event_type": "SHARP_TURN",
                        "timestamp": c_ts,
                        "lat": c_lat,
                        "lon": c_lon,
                        "previous_value": p_course,
                        "new_value": c_course,
                        "difference": diff,
                        "threshold_used": TrajectoryAnalysis.SHARP_TURN_THRESHOLD_DEG,
                        "explanation": f"Sharp course change: {diff:.1f}° detected."
                    })
                    
            # Speed change detection
            if p_speed is not None and c_speed is not None and p_speed > 0:
                speed_diff_pct = abs(c_speed - p_speed) / p_speed
                if speed_diff_pct > TrajectoryAnalysis.SPEED_CHANGE_THRESHOLD_PCT:
                    event_type = "SPEED_INCREASE" if c_speed > p_speed else "SPEED_DECREASE"
                    events.append({
                        "event_type": event_type,
                        "timestamp": c_ts,
                        "lat": c_lat,
                        "lon": c_lon,
                        "previous_value": p_speed,
                        "new_value": c_speed,
                        "difference": c_speed - p_speed,
                        "threshold_used": f"{TrajectoryAnalysis.SPEED_CHANGE_THRESHOLD_PCT*100}%",
                        "explanation": f"Significant {event_type.replace('_', ' ').lower()}: {(speed_diff_pct*100):.1f}%."
                    })
                    
            # Stop detection
            if p_speed is not None and c_speed is not None:
                if p_speed > TrajectoryAnalysis.STOP_SPEED_THRESHOLD_KNOTS and c_speed <= TrajectoryAnalysis.STOP_SPEED_THRESHOLD_KNOTS:
                    events.append({
                        "event_type": "SUDDEN_STOP",
                        "timestamp": c_ts,
                        "lat": c_lat,
                        "lon": c_lon,
                        "previous_value": p_speed,
                        "new_value": c_speed,
                        "difference": p_speed - c_speed,
                        "threshold_used": TrajectoryAnalysis.STOP_SPEED_THRESHOLD_KNOTS,
                        "explanation": f"Sudden stop: speed fell below {TrajectoryAnalysis.STOP_SPEED_THRESHOLD_KNOTS} knots."
                    })
                    
        return events

    @staticmethod
    def analyze_approach_departure(
        track_points: List[Any], 
        origin_lat: float, 
        origin_lon: float
    ) -> Dict[str, Any]:
        """
        Analyze the vessel's approach and departure relative to the spill origin.
        """
        result = {
            "approach_direction_deg": None,
            "departure_direction_deg": None,
            "approach_speed_knots": None,
            "departure_speed_knots": None,
            "closest_approach_heading": None
        }
        
        if not track_points or len(track_points) < 3:
            return result
            
        sorted_points = sorted(
            track_points, 
            key=lambda p: (p.timestamp if hasattr(p, 'timestamp') else p.get('timestamp')) or datetime.min
        )
        
        # Find index of closest approach
        closest_pt = GeographicService.nearest_point_on_track(track_points, origin_lat, origin_lon)
        if not closest_pt:
            return result
            
        try:
            closest_idx = sorted_points.index(closest_pt)
        except ValueError:
            return result
            
        # Get point before (for approach) and point after (for departure)
        # Note: We take a point some steps back/forward if possible to get a better overall direction
        appr_idx = max(0, closest_idx - max(1, len(sorted_points)//10))
        dep_idx = min(len(sorted_points) - 1, closest_idx + max(1, len(sorted_points)//10))
        
        if closest_idx > 0:
            p_appr = sorted_points[appr_idx]
            lat_a = p_appr.lat if hasattr(p_appr, 'lat') else p_appr.get('lat')
            lon_a = p_appr.lon if hasattr(p_appr, 'lon') else p_appr.get('lon')
            lat_c = closest_pt.lat if hasattr(closest_pt, 'lat') else closest_pt.get('lat')
            lon_c = closest_pt.lon if hasattr(closest_pt, 'lon') else closest_pt.get('lon')
            
            if lat_a is not None and lat_c is not None:
                result["approach_direction_deg"] = GeographicService.bearing_between_points(lat_a, lon_a, lat_c, lon_c)
                
            speed_a = p_appr.speed_knots if hasattr(p_appr, 'speed_knots') else p_appr.get('speed_knots')
            result["approach_speed_knots"] = speed_a
            
        if closest_idx < len(sorted_points) - 1:
            p_dep = sorted_points[dep_idx]
            lat_d = p_dep.lat if hasattr(p_dep, 'lat') else p_dep.get('lat')
            lon_d = p_dep.lon if hasattr(p_dep, 'lon') else p_dep.get('lon')
            lat_c = closest_pt.lat if hasattr(closest_pt, 'lat') else closest_pt.get('lat')
            lon_c = closest_pt.lon if hasattr(closest_pt, 'lon') else closest_pt.get('lon')
            
            if lat_c is not None and lat_d is not None:
                result["departure_direction_deg"] = GeographicService.bearing_between_points(lat_c, lon_c, lat_d, lon_d)
                
            speed_d = p_dep.speed_knots if hasattr(p_dep, 'speed_knots') else p_dep.get('speed_knots')
            result["departure_speed_knots"] = speed_d
            
        result["closest_approach_heading"] = closest_pt.heading_deg if hasattr(closest_pt, 'heading_deg') else closest_pt.get('heading_deg')
        
        return result

    @staticmethod
    def detect_route_deviation(track_points: List[Any]) -> List[Dict[str, Any]]:
        """
        Detect if the vessel deviated from its expected straight-line course 
        based on the initial heading of segments.
        """
        events = []
        if not track_points or len(track_points) < 5:
            return events
            
        sorted_points = sorted(
            track_points, 
            key=lambda p: (p.timestamp if hasattr(p, 'timestamp') else p.get('timestamp')) or datetime.min
        )
        
        # A simple route deviation for Phase 7:
        # Compare a rolling average heading of N points to the current heading.
        # If it deviates consistently for a period, it's a deviation.
        
        window = 3
        for i in range(window, len(sorted_points)):
            # Calculate average heading of previous 'window' points
            headings = []
            for j in range(i - window, i):
                pt = sorted_points[j]
                h = pt.heading_deg if hasattr(pt, 'heading_deg') else pt.get('heading_deg')
                if h is not None:
                    headings.append(h)
                    
            if not headings:
                continue
                
            # Naive average works if we assume they don't cross 360 often in a straight line
            # A better way is using vectors, but for this demo standard average is okay for small variances
            expected_heading = sum(headings) / len(headings) 
            
            curr = sorted_points[i]
            c_heading = curr.heading_deg if hasattr(curr, 'heading_deg') else curr.get('heading_deg')
            c_ts = curr.timestamp if hasattr(curr, 'timestamp') else curr.get('timestamp')
            c_lat = curr.lat if hasattr(curr, 'lat') else curr.get('lat')
            c_lon = curr.lon if hasattr(curr, 'lon') else curr.get('lon')
            
            if c_heading is not None:
                diff = GeographicService.heading_difference(expected_heading, c_heading)
                # If deviation is greater than 30 degrees from expected path, flag it
                if diff > 30.0:
                    events.append({
                        "event_type": "ROUTE_DEVIATION",
                        "timestamp": c_ts,
                        "lat": c_lat,
                        "lon": c_lon,
                        "expected_heading": expected_heading,
                        "observed_heading": c_heading,
                        "deviation_deg": diff,
                        "classification": "Potential route deviation",
                        "explanation": f"Observed heading deviated by {diff:.1f}° from expected route."
                    })
                    
        return events
