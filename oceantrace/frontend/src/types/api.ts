export interface IncidentSummary {
    id: string;
    name: string;
    status: string;
    region: string;
    created_at: string;
}

export interface IncidentDetail extends IncidentSummary {
    description?: string;
    latitude: number;
    longitude: number;
}

export interface SpillOut {
    id: string;
    timestamp: string;
    geometry_wkt: string;
    area_sqkm: number;
    confidence_score: number;
    is_lookalike: boolean;
}

export interface OriginEstimateOut {
    id: string;
    geometry_wkt: string;
    timestamp_start: string;
    timestamp_end: string;
    confidence: number;
}

export interface DriftSimulationOut {
    id: string;
    simulation_type: string;
    status: string;
    particles: DriftParticleOut[];
}

export interface DriftParticleOut {
    id: string;
    timestamp: string;
    geometry_wkt: string;
    probability_weight: number;
    status: string;
}

export interface VesselOut {
    id: string;
    mmsi: string;
    name: string;
    vessel_type: string;
    flag: string;
    is_candidate: boolean;
}

export interface VesselTrackOut {
    id: string;
    vessel_id: string;
    timestamp_start: string;
    timestamp_end: string;
    points: AISPointOut[];
}

export interface AISPointOut {
    id: string;
    timestamp: string;
    geometry_wkt: string;
    speed_knots: number;
    heading_degrees: number;
    is_interpolated: boolean;
}

export interface FilteringFunnelOut {
    total_vessels: number;
    spatial_candidates: number;
    temporal_candidates: number;
    trajectory_candidates: number;
    behaviour_candidates: number;
    final_candidates: number;
    details: any[];
}
