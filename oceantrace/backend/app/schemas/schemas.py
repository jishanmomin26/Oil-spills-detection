"""
OCEANTRACE AI — Pydantic Schemas for API serialization.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field


# ── Provenance ──────────────────────────────────────────────

class ProvenanceOut(BaseModel):
    id: str
    source_type: Optional[str] = None
    source_name: Optional[str] = None
    classification: Optional[str] = None  # OBSERVED | DERIVED | MODELLED | SIMULATED | UNCERTAIN
    confidence: Optional[float] = None
    is_simulated: bool = True
    algorithm_name: Optional[str] = None
    algorithm_version: Optional[str] = None

    class Config:
        from_attributes = True


# ── Incident ────────────────────────────────────────────────

class IncidentSummary(BaseModel):
    id: str
    name: str
    status: str
    region: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SpillOut(BaseModel):
    id: str
    incident_id: str
    observation_id: Optional[str] = None
    geometry_wkt: Optional[str] = None
    centroid_wkt: Optional[str] = None
    area_km2: Optional[float] = None
    perimeter_km: Optional[float] = None
    length_km: Optional[float] = None
    width_km: Optional[float] = None
    aspect_ratio: Optional[float] = None
    orientation_deg: Optional[float] = None
    compactness: Optional[float] = None
    estimated_age_hours: Optional[float] = None
    confidence: Optional[float] = None
    detection_method: Optional[str] = None
    oil_probability: Optional[float] = None
    low_wind_probability: Optional[float] = None
    ship_wake_probability: Optional[float] = None
    rain_artifact_probability: Optional[float] = None
    biological_film_probability: Optional[float] = None
    estimated_severity: Optional[str] = None

    class Config:
        from_attributes = True


class SatelliteObservationOut(BaseModel):
    id: str
    incident_id: str
    platform: Optional[str] = None
    sensor: Optional[str] = None
    acquisition_time: Optional[datetime] = None
    resolution_m: Optional[float] = None
    bounds_wkt: Optional[str] = None
    processing_status: Optional[str] = None

    class Config:
        from_attributes = True


class IncidentDetail(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    region: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    spills: list[SpillOut] = []
    observations: list[SatelliteObservationOut] = []

    class Config:
        from_attributes = True


# ── Weather & Ocean ─────────────────────────────────────────

class WeatherOut(BaseModel):
    id: str
    timestamp: Optional[datetime] = None
    location_wkt: Optional[str] = None
    wind_speed_ms: Optional[float] = None
    wind_direction_deg: Optional[float] = None
    temperature_c: Optional[float] = None
    wave_height_m: Optional[float] = None
    source: Optional[str] = None

    class Config:
        from_attributes = True


class OceanCurrentOut(BaseModel):
    id: str
    timestamp: Optional[datetime] = None
    location_wkt: Optional[str] = None
    speed_ms: Optional[float] = None
    direction_deg: Optional[float] = None
    depth_m: Optional[float] = None
    source: Optional[str] = None

    class Config:
        from_attributes = True


# ── Drift ───────────────────────────────────────────────────

class DriftParticleOut(BaseModel):
    particle_index: int
    timestamp: Optional[datetime] = None
    lat: float
    lon: float

    class Config:
        from_attributes = True


class DriftSimulationOut(BaseModel):
    id: str
    simulation_type: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    start_location_wkt: Optional[str] = None
    wind_drift_coefficient: Optional[float] = None
    num_particles: Optional[int] = None
    particles: list[DriftParticleOut] = []

    class Config:
        from_attributes = True


class OriginEstimateOut(BaseModel):
    id: str
    center_lat: float
    center_lon: float
    uncertainty_radius_km: float
    ellipse_wkt: Optional[str] = None
    probability: Optional[float] = None
    time_window_start: Optional[datetime] = None
    time_window_end: Optional[datetime] = None
    forward_validation_distance_km: Optional[float] = None
    spatial_overlap_pct: Optional[float] = None
    trajectory_similarity_score: Optional[float] = None

    class Config:
        from_attributes = True

class ForecastOut(BaseModel):
    id: str
    incident_id: str
    predicted_lat: float
    predicted_lon: float
    forecast_time: datetime
    affected_zone_wkt: Optional[str] = None
    confidence: float
    uncertainty_radius_km: float

    class Config:
        from_attributes = True


# ── Vessel & AIS ────────────────────────────────────────────

class VesselOut(BaseModel):
    id: str
    mmsi: str
    name: str
    vessel_type: Optional[str] = None
    flag_state: Optional[str] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    destination: Optional[str] = None
    is_candidate: bool = False

    class Config:
        from_attributes = True


class AISPointOut(BaseModel):
    timestamp: Optional[datetime] = None
    lat: float
    lon: float
    speed_knots: Optional[float] = None
    course_deg: Optional[float] = None
    heading_deg: Optional[float] = None
    is_reconstructed: bool = False
    reconstruction_method: Optional[str] = None
    gap_duration_hrs: Optional[float] = None

    class Config:
        from_attributes = True

class AisReconstructionStatsOut(BaseModel):
    total_vessels: int
    vessels_with_gaps: int
    total_points: int
    reconstructed_points: int
    overall_confidence: float

    class Config:
        from_attributes = True


class VesselTrackOut(BaseModel):
    id: str
    vessel_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    points: list[AISPointOut] = []

    class Config:
        from_attributes = True


# ── Anomaly ─────────────────────────────────────────────────

class AnomalyOut(BaseModel):
    id: str
    vessel_id: str
    timestamp: Optional[datetime] = None
    anomaly_type: str
    severity: str
    baseline_value: Optional[float] = None
    observed_value: Optional[float] = None
    deviation: Optional[float] = None
    explanation: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None

    class Config:
        from_attributes = True


# ── Attribution ─────────────────────────────────────────────

class AttributionScoreOut(BaseModel):
    id: str
    vessel_id: str
    vessel_name: Optional[str] = None
    vessel_type: Optional[str] = None
    rank: Optional[int] = None
    overall_score: float
    spatial_score: float
    temporal_score: float
    trajectory_score: float
    behaviour_score: float
    drift_score: float
    confidence: Optional[float] = None
    weights: Optional[dict] = None
    supporting_evidence: Optional[list] = None
    contradictory_evidence: Optional[list] = None
    missing_evidence: Optional[list] = None

    class Config:
        from_attributes = True


class TrajectoryAnalysisOut(BaseModel):
    id: str
    vessel_id: str
    min_distance_to_origin_km: Optional[float] = None
    distance_at_spill_time_km: Optional[float] = None
    heading_compatibility: Optional[float] = None
    speed_compatibility: Optional[float] = None
    route_intersection_score: Optional[float] = None
    trajectory_similarity: Optional[float] = None
    time_compatibility: Optional[float] = None
    origin_zone_intersection: bool = False

    class Config:
        from_attributes = True


# ── Filtering ───────────────────────────────────────────────

class FilteringResultOut(BaseModel):
    vessel_id: str
    stage: str
    passed: bool
    reason: Optional[str] = None
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    threshold: Optional[float] = None

    class Config:
        from_attributes = True


class FilteringFunnelOut(BaseModel):
    total_vessels: int
    spatial_candidates: int
    temporal_candidates: int
    trajectory_candidates: int
    behaviour_candidates: int
    final_candidates: int
    details: list[FilteringResultOut] = []


# ── Evidence ────────────────────────────────────────────────

class EvidenceOut(BaseModel):
    id: str
    incident_id: str
    vessel_id: Optional[str] = None
    evidence_type: str
    source: Optional[str] = None
    timestamp: Optional[datetime] = None
    confidence: Optional[float] = None
    relevance: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    details: Optional[dict] = None

    class Config:
        from_attributes = True


# ── Timeline ───────────────────────────────────────────────

class TimelineEventOut(BaseModel):
    id: str
    timestamp: Optional[datetime] = None
    event_type: str
    title: str
    description: Optional[str] = None
    related_entity_id: Optional[str] = None
    related_entity_type: Optional[str] = None

    class Config:
        from_attributes = True


# ── Report ──────────────────────────────────────────────────

class ReportOut(BaseModel):
    id: str
    incident_id: str
    generated_at: Optional[datetime] = None
    content_html: Optional[str] = None
    content_md: Optional[str] = None
    analyst_notes: Optional[str] = None

    class Config:
        from_attributes = True


# ── System Status ───────────────────────────────────────────

class ModuleStatus(BaseModel):
    name: str
    status: str  # ONLINE | OFFLINE | ERROR
    detail: Optional[str] = None


class SystemStatusOut(BaseModel):
    database: str
    demo_mode: bool
    modules: list[ModuleStatus] = []


# ── Request Bodies ──────────────────────────────────────────

class DriftRequest(BaseModel):
    incident_id: str
    simulation_type: str = "HINDCAST"
    wind_speed_ms: Optional[float] = None
    wind_direction_deg: Optional[float] = None
    current_speed_ms: Optional[float] = None
    current_direction_deg: Optional[float] = None
    drift_coefficient: float = 0.03
    duration_hours: float = 24.0
    num_particles: int = 100


class AttributionWeights(BaseModel):
    spatial: float = 0.30
    temporal: float = 0.25
    trajectory: float = 0.20
    behaviour: float = 0.15
    quality: float = 0.10


class SimulationRequest(BaseModel):
    incident_id: str
    wind_speed_ms: float
    wind_direction_deg: float
    current_speed_ms: float
    current_direction_deg: float
    drift_coefficient: float = 0.03
    weights: Optional[AttributionWeights] = None


# ── Phase 8: Vessel Behaviour Analysis ──────────────────────

class BehaviourEventOut(BaseModel):
    event_id: str
    vessel_id: str
    incident_id: str
    event_type: str
    timestamp: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    measured_value: Optional[float] = None
    threshold: Optional[str] = None
    duration_minutes: Optional[float] = None
    explanation: Optional[str] = None


class SpeedProfileOut(BaseModel):
    average_speed_knots: float
    min_speed_knots: float
    max_speed_knots: float
    active_duration_hours: float
    stationary_duration_minutes: float
    low_speed_duration_minutes: float
    acceleration_events_count: int
    deceleration_events_count: int


class CourseProfileOut(BaseModel):
    circular_mean_heading_deg: float
    heading_variance: float
    heading_consistency: float
    sharp_turns_count: int


class SpatialBehaviourOut(BaseModel):
    total_path_distance_km: float
    net_displacement_km: float
    loitering_index: float


class SpillInteractionOut(BaseModel):
    closest_approach_distance_km: Optional[float] = None
    closest_approach_timestamp: Optional[str] = None
    closest_approach_latitude: Optional[float] = None
    closest_approach_longitude: Optional[float] = None
    entered_spill_zone: bool = False
    dwell_time_minutes: float = 0.0


class DataQualityMetadataOut(BaseModel):
    total_points: int
    reconstructed_points: int
    observed_points: int
    quality_score: float


class VesselBehaviourProfileOut(BaseModel):
    vessel_id: str
    vessel_name: str
    mmsi: str
    incident_id: str
    speed_profile: SpeedProfileOut
    course_profile: CourseProfileOut
    spatial_behaviour: SpatialBehaviourOut
    spill_interaction: SpillInteractionOut
    behaviour_events: list[BehaviourEventOut] = []
    data_quality: DataQualityMetadataOut


# ── Phase 9: Vessel Attribution & Evidence Scoring ──────────

class CategoryScoresOut(BaseModel):
    spatial: float
    temporal: float
    trajectory: float
    behaviour: float
    quality: float


class VesselAttributionOut(BaseModel):
    id: Optional[str] = None
    rank: Optional[int] = None
    vessel_id: str
    vessel_name: str
    vessel_type: Optional[str] = None
    mmsi: str
    overall_score: float
    relevance_level: str  # High relevance | Medium relevance | Low relevance | Insufficient evidence
    category_scores: CategoryScoresOut
    spatial_score: Optional[float] = None
    temporal_score: Optional[float] = None
    trajectory_score: Optional[float] = None
    behaviour_score: Optional[float] = None
    drift_score: Optional[float] = None
    confidence: Optional[float] = None
    weights: dict[str, float]
    closest_approach_km: Optional[float] = None
    closest_approach_time: Optional[str] = None
    entered_spill_zone: bool = False
    supporting_evidence: list[str] = []
    contradictory_evidence: list[str] = []
    missing_evidence: list[str] = []
    disclaimer: str


# ── Phase 10: Unified Investigation Timeline & Correlation ──

class TimelineEvent(BaseModel):
    event_id: str
    timestamp: datetime
    event_type: str
    source: str
    vessel_id: Optional[str] = None
    vessel_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: str
    severity: Optional[str] = None
    related_phase: str
    evidence_reference: Optional[str] = None
    data_label: str  # OBSERVED | ESTIMATED | MODELLED | FORECAST
    metadata: dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True


class CorrelationRelationship(BaseModel):
    from_event_id: str
    to_event_id: str
    relationship_type: str
    description: str
    temporal_delta_hours: Optional[float] = None
    spatial_distance_km: Optional[float] = None


class CorrelationChain(BaseModel):
    correlation_id: str
    vessel_id: str
    vessel_name: str
    chain_type: str
    event_ids: list[str]
    start_timestamp: datetime
    end_timestamp: datetime
    correlation_strength: float
    relationships: list[CorrelationRelationship] = []
    evidence_references: list[str] = []
    limitations: list[str] = []


class UnifiedTimelineOut(BaseModel):
    incident_id: str
    total_events: int
    events: list[TimelineEvent]
    correlations: list[CorrelationChain] = []
    filter_categories: list[str] = []


# ── Phase 11: Advanced Satellite + Spill Analysis ──

class SatelliteObservationDetail(BaseModel):
    id: str
    platform: str
    sensor: str
    acquisition_time: datetime
    resolution_m: Optional[float] = None
    bounds_wkt: Optional[str] = None
    bounds_bbox: Optional[dict[str, float]] = None
    spill_id: Optional[str] = None
    spill_geometry_wkt: Optional[str] = None
    centroid_lat: Optional[float] = None
    centroid_lon: Optional[float] = None
    stored_area_km2: Optional[float] = None
    calculated_area_km2: Optional[float] = None
    area_discrepancy_pct: Optional[float] = None
    confidence: float = 0.90
    quality_rating: str = "HIGH"
    cloud_cover_pct: Optional[float] = None
    processing_status: str = "COMPLETED"
    data_provenance: str = "DEMO / SYNTHETIC"
    classification: str = "SYNTHETIC"
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class SpillEvolutionStep(BaseModel):
    step_index: int
    from_observation_id: str
    to_observation_id: str
    from_platform: str
    to_platform: str
    from_time: datetime
    to_time: datetime
    delta_time_hours: float
    from_area_km2: float
    to_area_km2: float
    delta_area_km2: float
    area_growth_pct: float
    expansion_rate_km2_per_hr: float
    centroid_displacement_km: float
    displacement_bearing_deg: float
    drift_speed_kmh: float
    drift_speed_knots: float
    confidence_change: float
    direction_cardinal: str
    drift_consistency: str


class OriginIntegrationOut(BaseModel):
    origin_id: Optional[str] = None
    center_lat: float
    center_lon: float
    uncertainty_radius_km: float
    uncertainty_polygon_wkt: Optional[str] = None
    confidence: float
    estimation_method: str
    time_window_start: Optional[datetime] = None
    time_window_end: Optional[datetime] = None
    distance_to_first_observation_km: float
    provenance: str = "ESTIMATED"
    notes: Optional[str] = None


class DriftCorrelationOut(BaseModel):
    modelled_current_speed_knots: float
    modelled_current_direction_deg: float
    modelled_hindcast_separation_km: float
    angular_alignment_deg: float
    movement_agreement: str
    spatial_consistency: str
    temporal_alignment: str
    model_agreement_rating: str
    summary: str


class SatelliteSummaryOut(BaseModel):
    total_observations: int
    first_observation_time: Optional[datetime] = None
    latest_observation_time: Optional[datetime] = None
    earliest_area_km2: Optional[float] = None
    latest_area_km2: Optional[float] = None
    net_area_change_km2: Optional[float] = None
    net_area_growth_pct: Optional[float] = None
    total_centroid_displacement_km: Optional[float] = None
    average_confidence: float
    data_quality: str
    data_provenance: str = "DEMO / SYNTHETIC"
    classification: str = "SYNTHETIC"


class SatelliteAnalysisOut(BaseModel):
    incident_id: str
    summary: SatelliteSummaryOut
    observations: list[SatelliteObservationDetail]
    evolution_steps: list[SpillEvolutionStep]
    origin_integration: OriginIntegrationOut
    drift_correlation: DriftCorrelationOut
    limitations: list[str]
    provenance: str = "DEMO / SYNTHETIC"


# ── Phase 12: AI-Assisted Investigation & Explainability Schemas ──

class AIStatusOut(BaseModel):
    available: bool
    status: str  # "ONLINE" | "STANDBY - DETERMINISTIC FALLBACK" | "UNAVAILABLE"
    model: str
    detail: str
    deterministic_fallback_ready: bool = True


class AIQuestionRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500, description="Investigator query between 3 and 500 characters")
    vessel_id: Optional[str] = Field(None, description="Optional target candidate vessel context")


class AIResponseOut(BaseModel):
    available: bool
    status: str  # "ONLINE" | "STANDBY - DETERMINISTIC FALLBACK"
    mode: str    # "summary" | "vessel" | "timeline" | "evidence" | "question"
    response: str
    summary: Optional[str] = None
    key_findings: list[str] = []
    evidence_explanation: list[str] = []
    warnings: list[str] = []
    limitations: list[str] = []
    provenance_notices: list[str] = []
    suggested_next_steps: list[str] = []
    context_summary: Optional[dict[str, Any]] = None
    error: Optional[str] = None


