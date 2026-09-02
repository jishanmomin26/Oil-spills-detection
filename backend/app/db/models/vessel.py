"""
OCEANTRACE AI — Database Models: Vessel & AIS Domain
"""
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, JSON, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Vessel(Base):
    __tablename__ = "vessels"

    id = Column(String, primary_key=True, index=True)
    mmsi = Column(String, unique=True, index=True)
    name = Column(String, nullable=False)
    vessel_type = Column(String)          # tanker, cargo, container, fishing, passenger, tug, service, other
    flag_state = Column(String)
    length_m = Column(Float)
    width_m = Column(Float)
    destination = Column(String, nullable=True)
    is_candidate = Column(Boolean, default=False)

    tracks = relationship("VesselTrack", back_populates="vessel", cascade="all, delete-orphan")
    anomalies = relationship("BehaviourAnomaly", back_populates="vessel", cascade="all, delete-orphan")
    attribution_scores = relationship("AttributionScore", back_populates="vessel", cascade="all, delete-orphan")


class VesselTrack(Base):
    __tablename__ = "vessel_tracks"

    id = Column(String, primary_key=True, index=True)
    vessel_id = Column(String, ForeignKey("vessels.id"), index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    trajectory_wkt = Column(String)       # WKT LINESTRING

    vessel = relationship("Vessel", back_populates="tracks")
    points = relationship("AISPoint", back_populates="track", cascade="all, delete-orphan")


class AISPoint(Base):
    __tablename__ = "ais_points"

    id = Column(String, primary_key=True, index=True)
    track_id = Column(String, ForeignKey("vessel_tracks.id"), index=True)
    vessel_id = Column(String, ForeignKey("vessels.id"), index=True)
    timestamp = Column(DateTime, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    location_wkt = Column(String)         # WKT POINT
    speed_knots = Column(Float)
    course_deg = Column(Float)
    heading_deg = Column(Float)

    track = relationship("VesselTrack", back_populates="points")


class BehaviourAnomaly(Base):
    __tablename__ = "behaviour_anomalies"

    id = Column(String, primary_key=True, index=True)
    vessel_id = Column(String, ForeignKey("vessels.id"), index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    timestamp = Column(DateTime)
    anomaly_type = Column(String)         # speed_reduction, course_deviation, loitering, ais_gap, unexpected_stop
    severity = Column(String)             # HIGH, MEDIUM, LOW
    baseline_value = Column(Float)
    observed_value = Column(Float)
    deviation = Column(Float)
    explanation = Column(Text)
    lat = Column(Float)
    lon = Column(Float)
    location_wkt = Column(String)         # WKT POINT

    vessel = relationship("Vessel", back_populates="anomalies")


class AttributionScore(Base):
    __tablename__ = "attribution_scores"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    vessel_id = Column(String, ForeignKey("vessels.id"), index=True)
    rank = Column(Integer)
    overall_score = Column(Float)
    spatial_score = Column(Float)
    temporal_score = Column(Float)
    trajectory_score = Column(Float)
    behaviour_score = Column(Float)
    drift_score = Column(Float)
    confidence = Column(Float)
    # Weights used for this scoring
    weights = Column(JSON)
    supporting_evidence = Column(JSON)    # list of evidence IDs
    contradictory_evidence = Column(JSON) # list of evidence IDs
    missing_evidence = Column(JSON)       # list of missing evidence types

    vessel = relationship("Vessel", back_populates="attribution_scores")


class TrajectoryAnalysis(Base):
    __tablename__ = "trajectory_analyses"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    vessel_id = Column(String, ForeignKey("vessels.id"), index=True)
    min_distance_to_origin_km = Column(Float)
    distance_at_spill_time_km = Column(Float)
    time_of_closest_approach = Column(DateTime, nullable=True)
    heading_compatibility = Column(Float)     # 0-100
    speed_compatibility = Column(Float)       # 0-100
    route_intersection_score = Column(Float)  # 0-100
    trajectory_similarity = Column(Float)     # 0-100
    time_compatibility = Column(Float)        # 0-100
    origin_zone_intersection = Column(Boolean, default=False)

    vessel = relationship("Vessel")


class FilteringResult(Base):
    """Stores why each vessel was kept or eliminated at each filtering stage."""
    __tablename__ = "filtering_results"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    vessel_id = Column(String, ForeignKey("vessels.id"), index=True)
    stage = Column(String)                # spatial, temporal, trajectory, behaviour
    passed = Column(Boolean)
    reason = Column(Text)
    metric_name = Column(String)
    metric_value = Column(Float)
    threshold = Column(Float)
