import math
from typing import Tuple, Optional, List, Dict, Any
from shapely import wkt
from shapely.geometry import Point, Polygon
import pyproj

class GeographicService:
    @staticmethod
    def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the great circle distance in kilometers between two points
        on the earth (specified in decimal degrees)
        """
        # Convert decimal degrees to radians
        lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

        # Haversine formula
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        r = 6371.0 # Radius of earth in kilometers
        return c * r

    @staticmethod
    def bearing_between_points(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate the initial bearing from point 1 to point 2.
        Returns the bearing in degrees (0-360).
        """
        lat1 = math.radians(lat1)
        lon1 = math.radians(lon1)
        lat2 = math.radians(lat2)
        lon2 = math.radians(lon2)

        dlon = lon2 - lon1

        x = math.sin(dlon) * math.cos(lat2)
        y = math.cos(lat1) * math.sin(lat2) - (math.sin(lat1) * math.cos(lat2) * math.cos(dlon))

        initial_bearing = math.atan2(x, y)
        
        # Normalize to 0-360
        initial_bearing = math.degrees(initial_bearing)
        compass_bearing = (initial_bearing + 360) % 360
        
        return compass_bearing

    @staticmethod
    def normalize_heading(heading: float) -> float:
        """Normalize heading to 0-360 degrees."""
        if heading is None:
            return 0.0
        return heading % 360.0

    @staticmethod
    def heading_difference(h1: float, h2: float) -> float:
        """
        Calculate the shortest angular difference between two headings.
        Returns a value between 0 and 180 degrees.
        Handles wraparound (e.g. 359 to 1 is a 2 degree difference).
        """
        if h1 is None or h2 is None:
            return 0.0
        diff = abs(GeographicService.normalize_heading(h1) - GeographicService.normalize_heading(h2))
        return min(diff, 360.0 - diff)

    @staticmethod
    def point_inside_polygon(lat: float, lon: float, polygon_wkt: str) -> bool:
        """Check if a coordinate is inside a WKT polygon."""
        if not polygon_wkt:
            return False
        try:
            point = Point(lon, lat)
            polygon = wkt.loads(polygon_wkt)
            return polygon.contains(point) or polygon.touches(point)
        except Exception:
            return False
            
    @staticmethod
    def distance_to_polygon_km(lat: float, lon: float, polygon_wkt: str) -> Optional[float]:
        """Calculate the shortest distance from a point to a WKT polygon."""
        if not polygon_wkt:
            return None
        try:
            point = Point(lon, lat)
            polygon = wkt.loads(polygon_wkt)
            dist_deg = polygon.distance(point)
            return dist_deg * 111.0 
        except Exception:
            return None

    @staticmethod
    def nearest_point_on_track(track_points: List[Any], target_lat: float, target_lon: float) -> Optional[Any]:
        """Find the track point closest to the target coordinate."""
        if not track_points:
            return None
            
        min_dist = float('inf')
        closest = None
        
        for pt in track_points:
            # Handle both dict and object access
            lat = pt.lat if hasattr(pt, 'lat') else pt.get('lat')
            lon = pt.lon if hasattr(pt, 'lon') else pt.get('lon')
            if lat is None or lon is None:
                continue
                
            dist = GeographicService.haversine_distance_km(lat, lon, target_lat, target_lon)
            if dist < min_dist:
                min_dist = dist
                closest = pt
                
        return closest

    @staticmethod
    def calculate_polygon_area_km2(polygon_wkt: str) -> Optional[float]:
        """
        Calculate the ellipsoidal geographic area of a WKT polygon on the WGS84 ellipsoid.
        Uses pyproj.Geod(ellps='WGS84') for exact geodesic area (divided by 1e6 to return km²).
        Returns None if WKT is invalid or empty.
        """
        if not polygon_wkt:
            return None
        try:
            geom = wkt.loads(polygon_wkt)
            if not isinstance(geom, Polygon):
                return None
            geod = pyproj.Geod(ellps="WGS84")
            area_m2, _ = geod.geometry_area_perimeter(geom)
            return round(abs(area_m2) / 1.0e6, 4)
        except Exception:
            return None

    @staticmethod
    def calculate_polygon_centroid(polygon_wkt: str) -> Optional[Tuple[float, float]]:
        """
        Obtain the polygon's geometric centroid (latitude, longitude) using Shapely.
        Note: This is the planar geometric lon/lat centroid (centroid.y=lat, centroid.x=lon),
        which serves as an accurate proxy for local spill feature centroids rather than
        a spherical/geodesic surface centroid.
        """
        if not polygon_wkt:
            return None
        try:
            geom = wkt.loads(polygon_wkt)
            centroid = geom.centroid
            return (round(float(centroid.y), 6), round(float(centroid.x), 6))
        except Exception:
            return None

    @staticmethod
    def calculate_bounding_box(polygon_wkt: str) -> Optional[Dict[str, float]]:
        """
        Return the geographic bounding box of a WKT polygon required for satellite footprint / map layers.
        Returns {'min_lon': float, 'min_lat': float, 'max_lon': float, 'max_lat': float}.
        """
        if not polygon_wkt:
            return None
        try:
            geom = wkt.loads(polygon_wkt)
            minx, miny, maxx, maxy = geom.bounds
            return {
                "min_lon": round(float(minx), 6),
                "min_lat": round(float(miny), 6),
                "max_lon": round(float(maxx), 6),
                "max_lat": round(float(maxy), 6),
            }
        except Exception:
            return None

    @staticmethod
    def generate_geodesic_circle_polygon(
        center_lat: float, center_lon: float, radius_km: float, num_points: int = 64
    ) -> str:
        """
        Generate a closed geodesic circle polygon in WKT format using pyproj forward geodesic calculation
        on the WGS84 ellipsoid.
        """
        geod = pyproj.Geod(ellps="WGS84")
        radius_m = radius_km * 1000.0
        coords = []
        for i in range(num_points):
            azimuth = 360.0 * i / num_points
            lon, lat, _ = geod.fwd(center_lon, center_lat, azimuth, radius_m)
            coords.append(f"{lon:.6f} {lat:.6f}")
        # Close the ring
        coords.append(coords[0])
        return f"POLYGON(({', '.join(coords)}))"
