"""
OCEANTRACE AI — Database Models: Incident & Spill Domain

All geometry is stored as WKT strings for SQLite compatibility.
When migrating to PostGIS, replace String geometry columns with
geoalchemy2.Geometry types and add spatial indexes.
"""
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, JSON, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class DataProvenance(Base):
    """Tracks the origin, processing, and classification of every analytical result."""
    __tablename__ = "data_provenance"

    id = Column(String, primary_key=True, index=True)
    evidence_id = Column(String, index=True)
    source_type = Column(String)          # satellite, ais, weather, drift_model, algorithm
    source_name = Column(String)          # e.g. "DemoSatelliteProvider"
    source_timestamp = Column(DateTime)
    processing_timestamp = Column(DateTime, default=func.now())
    algorithm_name = Column(String)
    algorithm_version = Column(String, default="1.0.0-prototype")
    input_ids = Column(JSON)              # list of input provenance IDs
    parameters = Column(JSON)             # dict of algorithm parameters
    result_type = Column(String)          # what was produced
    confidence = Column(Float)
    uncertainty = Column(JSON)            # structured uncertainty info
    is_simulated = Column(Boolean, default=True)
    notes = Column(String)
    classification = Column(String)       # OBSERVED | DERIVED | MODELLED | SIMULATED | UNCERTAIN


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="UNDER_INVESTIGATION")
    region = Column(String)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # relationships
    spills = relationship("OilSpill", back_populates="incident", cascade="all, delete-orphan")
    observations = relationship("SatelliteObservation", back_populates="incident", cascade="all, delete-orphan")
    weather_observations = relationship("WeatherObservation", back_populates="incident", cascade="all, delete-orphan")
    ocean_currents = relationship("OceanCurrent", back_populates="incident", cascade="all, delete-orphan")
    drift_simulations = relationship("DriftSimulation", back_populates="incident", cascade="all, delete-orphan")
    evidence_items = relationship("Evidence", back_populates="incident", cascade="all, delete-orphan")
    timeline_events = relationship("InvestigationTimelineEvent", back_populates="incident", cascade="all, delete-orphan")


class SatelliteObservation(Base):
    __tablename__ = "satellite_observations"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    platform = Column(String)             # e.g. "Sentinel-1"
    sensor = Column(String)               # e.g. "SAR-C"
    acquisition_time = Column(DateTime)
    resolution_m = Column(Float)          # ground resolution in meters
    bounds_wkt = Column(String)           # WKT POLYGON — observation footprint
    processing_status = Column(String, default="COMPLETED")
    provenance_id = Column(String, ForeignKey("data_provenance.id"), nullable=True)

    incident = relationship("Incident", back_populates="observations")
    spill = relationship("OilSpill", back_populates="observation", uselist=False)


class OilSpill(Base):
    __tablename__ = "oil_spills"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    observation_id = Column(String, ForeignKey("satellite_observations.id"))
    geometry_wkt = Column(String)         # WKT POLYGON — spill outline
    centroid_wkt = Column(String)         # WKT POINT
    area_km2 = Column(Float)
    perimeter_km = Column(Float)
    length_km = Column(Float)
    width_km = Column(Float)
    aspect_ratio = Column(Float)
    orientation_deg = Column(Float)
    compactness = Column(Float)
    estimated_age_hours = Column(Float)
    confidence = Column(Float)
    detection_method = Column(String, default="prototype_segmentation")
    # Look-alike analysis probabilities
    oil_probability = Column(Float)
    low_wind_probability = Column(Float)
    ship_wake_probability = Column(Float)
    rain_artifact_probability = Column(Float)
    biological_film_probability = Column(Float)
    provenance_id = Column(String, ForeignKey("data_provenance.id"), nullable=True)

    incident = relationship("Incident", back_populates="spills")
    observation = relationship("SatelliteObservation", back_populates="spill")


class WeatherObservation(Base):
    __tablename__ = "weather_observations"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    timestamp = Column(DateTime)
    location_wkt = Column(String)         # WKT POINT
    wind_speed_ms = Column(Float)         # m/s
    wind_direction_deg = Column(Float)    # degrees from north
    temperature_c = Column(Float)
    wave_height_m = Column(Float, nullable=True)
    source = Column(String, default="DemoWeatherProvider")

    incident = relationship("Incident", back_populates="weather_observations")


class OceanCurrent(Base):
    __tablename__ = "ocean_currents"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    timestamp = Column(DateTime)
    location_wkt = Column(String)         # WKT POINT
    speed_ms = Column(Float)             # m/s
    direction_deg = Column(Float)         # degrees from north
    depth_m = Column(Float, default=0.0)  # surface = 0
    source = Column(String, default="DemoOceanProvider")

    incident = relationship("Incident", back_populates="ocean_currents")


class DriftSimulation(Base):
    __tablename__ = "drift_simulations"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    simulation_type = Column(String)      # HINDCAST | FORECAST
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    start_location_wkt = Column(String)   # WKT POINT
    wind_drift_coefficient = Column(Float, default=0.03)
    diffusion_coefficient = Column(Float, default=100.0)
    num_particles = Column(Integer, default=100)
    parameters = Column(JSON)
    provenance_id = Column(String, ForeignKey("data_provenance.id"), nullable=True)

    incident = relationship("Incident", back_populates="drift_simulations")
    particles = relationship("DriftParticle", back_populates="simulation", cascade="all, delete-orphan")


class DriftParticle(Base):
    __tablename__ = "drift_particles"

    id = Column(String, primary_key=True, index=True)
    simulation_id = Column(String, ForeignKey("drift_simulations.id"), index=True)
    particle_index = Column(Integer)
    timestamp = Column(DateTime)
    location_wkt = Column(String)         # WKT POINT
    lat = Column(Float)
    lon = Column(Float)

    simulation = relationship("DriftSimulation", back_populates="particles")


class OriginEstimate(Base):
    """Probable spill origin derived from hindcast."""
    __tablename__ = "origin_estimates"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    simulation_id = Column(String, ForeignKey("drift_simulations.id"), nullable=True)
    center_lat = Column(Float)
    center_lon = Column(Float)
    center_wkt = Column(String)           # WKT POINT
    uncertainty_radius_km = Column(Float)
    ellipse_wkt = Column(String)          # WKT POLYGON — uncertainty ellipse
    probability = Column(Float)
    time_window_start = Column(DateTime)
    time_window_end = Column(DateTime)
    provenance_id = Column(String, ForeignKey("data_provenance.id"), nullable=True)


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    vessel_id = Column(String, ForeignKey("vessels.id"), nullable=True, index=True)
    evidence_type = Column(String)        # SATELLITE, AIS, TRAJECTORY, BEHAVIOUR, DRIFT, TEMPORAL, SPATIAL
    source = Column(String)
    timestamp = Column(DateTime)
    confidence = Column(Float)
    relevance = Column(String)            # HIGH, MEDIUM, LOW
    status = Column(String)               # SUPPORTING, CONTRADICTORY, UNCERTAIN
    description = Column(Text)
    details = Column(JSON)
    provenance_id = Column(String, ForeignKey("data_provenance.id"), nullable=True)

    incident = relationship("Incident", back_populates="evidence_items")


class InvestigationTimelineEvent(Base):
    __tablename__ = "investigation_timeline_events"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    timestamp = Column(DateTime)
    event_type = Column(String)           # OBSERVATION, DETECTION, ANALYSIS, ANOMALY, etc.
    title = Column(String)
    description = Column(Text)
    related_entity_id = Column(String, nullable=True)
    related_entity_type = Column(String, nullable=True)

    incident = relationship("Incident", back_populates="timeline_events")


class InvestigationReport(Base):
    __tablename__ = "investigation_reports"

    id = Column(String, primary_key=True, index=True)
    incident_id = Column(String, ForeignKey("incidents.id"), index=True)
    generated_at = Column(DateTime, default=func.now())
    content_html = Column(Text)
    content_md = Column(Text)
    analyst_notes = Column(Text, nullable=True)
