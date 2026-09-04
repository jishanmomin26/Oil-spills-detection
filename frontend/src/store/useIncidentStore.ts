import { create } from 'zustand';

// ── Types matching backend Pydantic schemas exactly ──

export interface IncidentDetail {
    id: string;
    name: string;
    description?: string;
    status: string;
    region?: string;
    created_at?: string;
    updated_at?: string;
    spills: SpillOut[];
    observations: any[];
}

export interface SpillOut {
    id: string;
    incident_id: string;
    observation_id?: string;
    geometry_wkt?: string;
    centroid_wkt?: string;
    area_km2?: number;
    perimeter_km?: number;
    length_km?: number;
    width_km?: number;
    aspect_ratio?: number;
    orientation_deg?: number;
    compactness?: number;
    estimated_age_hours?: number;
    confidence?: number;
    detection_method?: string;
    oil_probability?: number;
    low_wind_probability?: number;
    ship_wake_probability?: number;
    rain_artifact_probability?: number;
    biological_film_probability?: number;
    estimated_severity?: string;
}

export interface OriginEstimateOut {
    id: string;
    center_lat: number;
    center_lon: number;
    uncertainty_radius_km: number;
    ellipse_wkt?: string;
    probability?: number;
    time_window_start?: string;
    time_window_end?: string;
    forward_validation_distance_km?: number;
    spatial_overlap_pct?: number;
    trajectory_similarity_score?: number;
}

export interface DriftParticleOut {
    particle_index: number;
    timestamp?: string;
    lat: number;
    lon: number;
}

export interface DriftSimulationOut {
    id: string;
    simulation_type: string;
    start_time?: string;
    end_time?: string;
    start_location_wkt?: string;
    wind_drift_coefficient?: number;
    num_particles?: number;
    particles: DriftParticleOut[];
}

export interface VesselOut {
    id: string;
    mmsi: string;
    name: string;
    vessel_type?: string;
    flag_state?: string;
    length_m?: number;
    width_m?: number;
    destination?: string;
    is_candidate: boolean;
}

export interface AISPointOut {
    timestamp?: string;
    lat: number;
    lon: number;
    speed_knots?: number;
    course_deg?: number;
    heading_deg?: number;
    is_reconstructed?: boolean;
    reconstruction_method?: string | null;
    gap_duration_hrs?: number;
}

export interface VesselTrackOut {
    id: string;
    vessel_id: string;
    start_time?: string;
    end_time?: string;
    points: AISPointOut[];
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

export interface AisReconstructionStatsOut {
    total_vessels: number;
    vessels_with_gaps: number;
    total_points: number;
    reconstructed_points: number;
    overall_confidence: number;
}

export interface WeatherOut {
    id: string;
    timestamp?: string;
    location_wkt?: string;
    wind_speed_ms?: number;
    wind_direction_deg?: number;
    temperature_c?: number;
    wave_height_m?: number;
    source?: string;
}

export interface OceanCurrentOut {
    id: string;
    timestamp?: string;
    location_wkt?: string;
    speed_ms?: number;
    direction_deg?: number;
    depth_m?: number;
    source?: string;
}

// ── Store ──

const API_BASE = 'http://localhost:8000/api';

export interface ForecastOut {
    id: string;
    incident_id: string;
    predicted_lat: number;
    predicted_lon: number;
    forecast_time: string;
    affected_zone_wkt?: string;
    confidence: number;
    uncertainty_radius_km: number;
}

export type LayerKey = 'vessels' | 'tracks' | 'spill' | 'origin' | 'hindcast' | 'forecast' | 'wind' | 'current';

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
    vessels: true,
    tracks: false,
    spill: true,
    origin: true,
    hindcast: true,
    forecast: true,
    wind: false,
    current: false,
};

interface IncidentState {
    incident: IncidentDetail | null;
    spills: SpillOut[];
    origin: OriginEstimateOut | null;
    drift: DriftSimulationOut[];
    vessels: VesselOut[];
    tracks: VesselTrackOut[];
    filtering: FilteringFunnelOut | null;
    weather: WeatherOut[];
    currents: OceanCurrentOut[];
    forecast: ForecastOut | null;
    reconstruction: AisReconstructionStatsOut | null;

    isLoading: boolean;
    error: string | null;

    currentTimestamp: number | null;
    minTimestamp: number | null;
    maxTimestamp: number | null;
    isPlaying: boolean;

    // Map UI state
    selectedVesselId: string | null;
    visibleLayers: Record<LayerKey, boolean>;
    mapMode: '2d' | '3d';

    fetchIncidentData: (incidentId: string) => Promise<void>;
    setCurrentTimestamp: (ts: number) => void;
    togglePlayback: () => void;
    setSelectedVessel: (id: string | null) => void;
    toggleLayer: (key: LayerKey) => void;
    setMapMode: (mode: '2d' | '3d') => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
    incident: null,
    spills: [],
    origin: null,
    drift: [],
    vessels: [],
    tracks: [],
    filtering: null,
    weather: [],
    currents: [],
    forecast: null,
    reconstruction: null,

    isLoading: false,
    error: null,

    currentTimestamp: null,
    minTimestamp: null,
    maxTimestamp: null,
    isPlaying: false,

    selectedVesselId: null,
    visibleLayers: DEFAULT_LAYERS,
    mapMode: '2d',

    fetchIncidentData: async (incidentId: string) => {
        set({ isLoading: true, error: null });
        try {
            const urls = [
                `${API_BASE}/incidents/${incidentId}`,
                `${API_BASE}/incidents/${incidentId}/spills`,
                `${API_BASE}/incidents/${incidentId}/origin`,
                `${API_BASE}/incidents/${incidentId}/drift`,
                `${API_BASE}/incidents/${incidentId}/vessels`,
                `${API_BASE}/incidents/${incidentId}/vessels/tracks`,
                `${API_BASE}/incidents/${incidentId}/vessels/filtering`,
                `${API_BASE}/incidents/${incidentId}/weather`,
                `${API_BASE}/incidents/${incidentId}/currents`,
                `${API_BASE}/incidents/${incidentId}/forecast`,
                `${API_BASE}/incidents/${incidentId}/vessels/reconstruction`,
            ];

            const responses = await Promise.all(urls.map(u => fetch(u)));

            const incident: IncidentDetail = await responses[0].json();
            const spills: SpillOut[] = responses[1].ok ? await responses[1].json() : [];
            const origins: OriginEstimateOut[] = responses[2].ok ? await responses[2].json() : [];
            const drift: DriftSimulationOut[] = responses[3].ok ? await responses[3].json() : [];
            const vessels: VesselOut[] = responses[4].ok ? await responses[4].json() : [];
            const tracks: VesselTrackOut[] = responses[5].ok ? await responses[5].json() : [];
            const filtering: FilteringFunnelOut | null = responses[6].ok ? await responses[6].json() : null;
            const weather: WeatherOut[] = responses[7].ok ? await responses[7].json() : [];
            const currents: OceanCurrentOut[] = responses[8].ok ? await responses[8].json() : [];
            const forecast: ForecastOut | null = responses[9] && responses[9].ok ? await responses[9].json() : null;
            const reconstruction: AisReconstructionStatsOut | null = responses[10] && responses[10].ok ? await responses[10].json() : null;

            // Compute timeline bounds from actual data
            let minTime = Number.MAX_SAFE_INTEGER;
            let maxTime = Number.MIN_SAFE_INTEGER;

            // Use origin time window
            if (origins.length > 0 && origins[0].time_window_start) {
                const t = new Date(origins[0].time_window_start).getTime();
                if (t < minTime) minTime = t;
            }

            // Use drift simulation times
            for (const sim of drift) {
                if (sim.start_time) {
                    const t = new Date(sim.start_time).getTime();
                    if (t < minTime) minTime = t;
                }
                if (sim.end_time) {
                    const t = new Date(sim.end_time).getTime();
                    if (t > maxTime) maxTime = t;
                }
            }

            // Use track times
            for (const track of tracks) {
                if (track.start_time) {
                    const t = new Date(track.start_time).getTime();
                    if (t < minTime) minTime = t;
                }
                if (track.end_time) {
                    const t = new Date(track.end_time).getTime();
                    if (t > maxTime) maxTime = t;
                }
            }

            // Fallback
            if (minTime === Number.MAX_SAFE_INTEGER) minTime = new Date('2026-09-15T06:00:00Z').getTime();
            if (maxTime === Number.MIN_SAFE_INTEGER) maxTime = new Date('2026-09-19T06:00:00Z').getTime();

            // Set current time to spill detection time (mid-investigation)
            const midTime = Math.floor((minTime + maxTime) / 2);

            set({
                incident,
                spills,
                origin: origins.length > 0 ? origins[0] : null,
                drift,
                vessels,
                tracks,
                filtering,
                weather,
                currents,
                forecast,
                reconstruction,
                minTimestamp: minTime,
                maxTimestamp: maxTime,
                currentTimestamp: midTime,
                isLoading: false,
            });

        } catch (err: any) {
            console.error('Failed to fetch incident data:', err);
            set({ error: err.message || 'Network error', isLoading: false });
        }
    },

    setCurrentTimestamp: (ts: number) => set({ currentTimestamp: ts }),
    togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setSelectedVessel: (id: string | null) => set({ selectedVesselId: id }),
    toggleLayer: (key: LayerKey) => set((state) => ({
        visibleLayers: { ...state.visibleLayers, [key]: !state.visibleLayers[key] }
    })),
    setMapMode: (mode: '2d' | '3d') => set({ mapMode: mode }),
}));
