import pytest
import math
from app.services.geographic import GeographicService

def test_haversine_distance_zero():
    d = GeographicService.haversine_distance_km(15.0, 65.0, 15.0, 65.0)
    assert d == 0.0

def test_haversine_distance_known():
    d = GeographicService.haversine_distance_km(18.922, 72.834, 15.299, 73.985)
    assert 400 < d < 450

def test_bearing_cardinal_directions():
    b_north = GeographicService.bearing_between_points(10.0, 60.0, 11.0, 60.0)
    assert abs(b_north - 0.0) < 0.1 or abs(b_north - 360.0) < 0.1

    b_east = GeographicService.bearing_between_points(0.0, 60.0, 0.0, 61.0)
    assert abs(b_east - 90.0) < 0.1

def test_heading_difference():
    assert GeographicService.heading_difference(10.0, 50.0) == 40.0
    assert GeographicService.heading_difference(350.0, 10.0) == 20.0
    assert GeographicService.heading_difference(5.0, 355.0) == 10.0
    assert GeographicService.heading_difference(0.0, 180.0) == 180.0

def test_point_inside_polygon():
    poly_wkt = 'POLYGON((64.0 14.0, 66.0 14.0, 66.0 16.0, 64.0 16.0, 64.0 14.0))'
    assert GeographicService.point_inside_polygon(15.0, 65.0, poly_wkt) is True
    assert GeographicService.point_inside_polygon(17.0, 65.0, poly_wkt) is False
    assert GeographicService.point_inside_polygon(15.0, 63.0, poly_wkt) is False
