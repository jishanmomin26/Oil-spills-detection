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

// ── Phase 8 & 9 Types ──

export interface BehaviourEventOut {
    id?: string;
    timestamp?: string;
    event_type: string;
    latitude: number;
    longitude: number;
    measured_value?: number;
    threshold?: number;
    unit?: string;
    severity?: string;
    description?: string;
}

export interface VesselBehaviourProfileOut {
    vessel_id: string;
    vessel_name: string;
    mmsi: string;
    incident_id: string;
    speed_profile: {
        average_speed_knots: number;
        min_speed_knots: number;
        max_speed_knots: number;
        median_speed_knots: number;
        variance_knots: number;
        active_duration_hours: number;
        stationary_duration_hours: number;
        low_speed_duration_hours: number;
        speed_drop_events_count: number;
        speed_increase_events_count: number;
    };
    course_profile: {
        circular_mean_heading_deg: number;
        heading_consistency: number;
        heading_variance: number;
        turn_events_count: number;
        sharp_turns_count: number;
        zigzag_detected: boolean;
    };
    spill_interaction: {
        closest_approach_distance_km: number | null;
        closest_approach_timestamp: string | null;
        entered_spill_zone: boolean;
        entry_timestamp: string | null;
        exit_timestamp: string | null;
        dwell_time_inside_spill_hours: number;
        approach_bearing_deg: number | null;
        departure_bearing_deg: number | null;
    };
    behaviour_events: BehaviourEventOut[];
    data_quality: {
        total_points: number;
        reconstructed_points: number;
        coverage_ratio: number;
        max_gap_hours: number;
    };
}

export interface AttributionWeights {
    spatial: number;
    temporal: number;
    trajectory: number;
    behaviour: number;
    quality: number;
}

export interface VesselAttributionOut {
    id: string;
    vessel_id: string;
    vessel_name: string;
    vessel_type?: string;
    mmsi: string;
    overall_score: number;
    relevance_level: string;
    rank?: number;
    category_scores: {
        spatial: number;
        temporal: number;
        trajectory: number;
        behaviour: number;
        quality: number;
    };
    spatial_score: number;
    temporal_score: number;
    trajectory_score: number;
    behaviour_score: number;
    drift_score: number;
    confidence: number;
    weights: {
        spatial: number;
        temporal: number;
        trajectory: number;
        behaviour: number;
        quality: number;
    };
    closest_approach_km?: number | null;
    closest_approach_time?: string | null;
    entered_spill_zone?: boolean;
    supporting_evidence: string[];
    contradictory_evidence: string[];
    missing_evidence: string[];
    disclaimer: string;
}

// ── Phase 10: Unified Investigation Timeline & Correlation Types ──

export interface TimelineEventOut {
    event_id: string;
    timestamp: string;
    event_type: string;
    source: string;
    vessel_id?: string | null;
    vessel_name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    description: string;
    severity?: string | null;
    related_phase: string;
    evidence_reference?: string | null;
    data_label: 'OBSERVED' | 'ESTIMATED' | 'MODELLED' | 'FORECAST' | string;
    metadata?: Record<string, any>;
}

export interface CorrelationRelationshipOut {
    from_event_id: string;
    to_event_id: string;
    relationship_type: string;
    description: string;
    temporal_delta_hours?: number | null;
    spatial_distance_km?: number | null;
}

export interface CorrelationChainOut {
    correlation_id: string;
    vessel_id: string;
    vessel_name: string;
    chain_type: string;
    event_ids: string[];
    start_timestamp: string;
    end_timestamp: string;
    correlation_strength: number;
    relationships: CorrelationRelationshipOut[];
    evidence_references: string[];
    limitations: string[];
}

export interface UnifiedTimelineOut {
    incident_id: string;
    total_events: number;
    events: TimelineEventOut[];
    correlations: CorrelationChainOut[];
    filter_categories: string[];
}

// ── Phase 11: Satellite & Spill Evolution Types ──

export interface SatelliteObservationDetail {
    id: string;
    platform: string;
    sensor: string;
    acquisition_time: string;
    resolution_m?: number;
    bounds_wkt?: string;
    bounds_bbox?: { min_lon: number; min_lat: number; max_lon: number; max_lat: number };
    spill_id?: string;
    spill_geometry_wkt?: string;
    centroid_lat?: number;
    centroid_lon?: number;
    stored_area_km2?: number;
    calculated_area_km2?: number;
    area_discrepancy_pct?: number;
    confidence: number;
    quality_rating: string;
    cloud_cover_pct?: number;
    processing_status: string;
    data_provenance: string;
    classification: string;
    notes?: string;
}

export interface SpillEvolutionStep {
    step_index: number;
    from_observation_id: string;
    to_observation_id: string;
    from_platform: string;
    to_platform: string;
    from_time: string;
    to_time: string;
    delta_time_hours: number;
    from_area_km2: number;
    to_area_km2: number;
    delta_area_km2: number;
    area_growth_pct: number;
    expansion_rate_km2_per_hr: number;
    centroid_displacement_km: number;
    displacement_bearing_deg: number;
    drift_speed_kmh: number;
    drift_speed_knots: number;
    confidence_change: number;
    direction_cardinal: string;
    drift_consistency: string;
}

export interface OriginIntegrationOut {
    origin_id?: string;
    center_lat: number;
    center_lon: number;
    uncertainty_radius_km: number;
    uncertainty_polygon_wkt?: string;
    confidence: number;
    estimation_method: string;
    time_window_start?: string;
    time_window_end?: string;
    distance_to_first_observation_km: number;
    provenance: string;
    notes?: string;
}

export interface DriftCorrelationOut {
    modelled_current_speed_knots: number;
    modelled_current_direction_deg: number;
    modelled_hindcast_separation_km: number;
    angular_alignment_deg: number;
    movement_agreement: string;
    spatial_consistency: string;
    temporal_alignment: string;
    model_agreement_rating: string;
    summary: string;
}

export interface SatelliteSummaryOut {
    total_observations: number;
    first_observation_time?: string;
    latest_observation_time?: string;
    earliest_area_km2?: number;
    latest_area_km2?: number;
    net_area_change_km2?: number;
    net_area_growth_pct?: number;
    total_centroid_displacement_km?: number;
    average_confidence: number;
    data_quality: string;
    data_provenance: string;
    classification: string;
}

export interface SatelliteAnalysisOut {
    incident_id: string;
    summary: SatelliteSummaryOut;
    observations: SatelliteObservationDetail[];
    evolution_steps: SpillEvolutionStep[];
    origin_integration: OriginIntegrationOut;
    drift_correlation: DriftCorrelationOut;
    limitations: string[];
    provenance: string;
}

// ── Phase 12: AI-Assisted Investigation & Explainability ──

export interface AIStatusOut {
    available: boolean;
    status: string;
    model: string;
    detail: string;
    deterministic_fallback_ready: boolean;
}

export interface AIResponseOut {
    available: boolean;
    status: string;
    mode: string;
    response: string;
    summary?: string;
    key_findings: string[];
    evidence_explanation: string[];
    warnings: string[];
    limitations: string[];
    provenance_notices: string[];
    suggested_next_steps: string[];
    context_summary?: Record<string, any>;
    error?: string;
}

export const DEFAULT_ATTRIBUTION_WEIGHTS: AttributionWeights = {
    spatial: 0.30,
    temporal: 0.25,
    trajectory: 0.20,
    behaviour: 0.15,
    quality: 0.10,
};

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

    vesselIntelligence: Record<string, any>;
    vesselBehaviours: Record<string, VesselBehaviourProfileOut>;
    rankedAttributions: VesselAttributionOut[];
    attributionWeights: AttributionWeights;
    selectedBehaviourEvent: BehaviourEventOut | null;
    isAttributionsLoading: boolean;
    attributionsError: string | null;

    activeFilters: Record<string, any>;

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
    setPlaybackSpeed: (speed: number) => void;
    playbackSpeed: number;
    setSelectedVessel: (id: string | null) => void;
    toggleLayer: (key: LayerKey) => void;
    setMapMode: (mode: '2d' | '3d') => void;
    
    applyFilters: (filters: Record<string, any>) => Promise<void>;
    fetchVesselIntelligence: (vesselId: string) => Promise<void>;
    fetchVesselBehaviour: (vesselId: string) => Promise<void>;
    fetchAttributions: (customWeights?: Partial<AttributionWeights>) => Promise<void>;
    setAttributionWeights: (weights: AttributionWeights) => void;
    resetAttributionWeights: () => void;
    selectBehaviourEvent: (event: BehaviourEventOut | null) => void;

    // Phase 10 Unified Timeline
    timelineEvents: TimelineEventOut[];
    timelineCorrelations: CorrelationChainOut[];
    isTimelineLoading: boolean;
    timelineError: string | null;
    selectedTimelineEventId: string | null;
    activeTimelineCategory: string;
    activeTimelineVesselId: string | null;

    fetchUnifiedTimeline: (params?: { category?: string; vessel_id?: string; event_type?: string }) => Promise<void>;
    selectTimelineEvent: (eventId: string | null) => void;
    setTimelineCategory: (category: string) => void;
    setTimelineVesselId: (vesselId: string | null) => void;

    // Phase 11 Advanced Satellite & Spill Evolution
    satelliteAnalysis: SatelliteAnalysisOut | null;
    selectedObservationId: string | null;
    isSatelliteLoading: boolean;
    satelliteError: string | null;

    fetchSatelliteAnalysis: (customIncidentId?: string) => Promise<void>;
    setSelectedObservationId: (id: string | null) => void;

    // Phase 12 AI-Assisted Investigation & Explainability
    aiAvailable: boolean;
    aiStatus: string;
    aiModel: string;
    aiLoading: boolean;
    aiError: string | null;
    aiSummary: AIResponseOut | null;
    aiVesselExplanation: Record<string, AIResponseOut>;
    aiTimelineExplanation: AIResponseOut | null;
    aiEvidenceExplanation: AIResponseOut | null;
    aiQuestionResponse: AIResponseOut | null;
    aiActiveSubTab: 'summary' | 'vessel' | 'timeline' | 'evidence' | 'qa';

    isSummaryModalOpen: boolean;
    setSummaryModalOpen: (open: boolean) => void;
    resetDemoState: () => void;

    checkAiStatus: (customIncidentId?: string) => Promise<void>;
    fetchAiSummary: (customIncidentId?: string) => Promise<void>;
    fetchAiVesselExplanation: (vesselId: string, customIncidentId?: string) => Promise<void>;
    fetchAiTimelineExplanation: (customIncidentId?: string) => Promise<void>;
    fetchAiEvidenceExplanation: (customIncidentId?: string) => Promise<void>;
    askAiQuestion: (question: string, vesselId?: string, customIncidentId?: string) => Promise<void>;
    setAiActiveSubTab: (tab: 'summary' | 'vessel' | 'timeline' | 'evidence' | 'qa') => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
    isSummaryModalOpen: false,
    setSummaryModalOpen: (open: boolean) => set({ isSummaryModalOpen: open }),
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

    vesselIntelligence: {},
    vesselBehaviours: {},
    rankedAttributions: [],
    attributionWeights: DEFAULT_ATTRIBUTION_WEIGHTS,
    selectedBehaviourEvent: null,
    isAttributionsLoading: false,
    attributionsError: null,

    // Phase 10 Timeline initial state
    timelineEvents: [],
    timelineCorrelations: [],
    isTimelineLoading: false,
    timelineError: null,
    selectedTimelineEventId: null,
    activeTimelineCategory: 'ALL',
    activeTimelineVesselId: null,

    // Phase 11 Satellite initial state
    satelliteAnalysis: null,
    selectedObservationId: null,
    isSatelliteLoading: false,
    satelliteError: null,

    // Phase 12 AI initial state
    aiAvailable: false,
    aiStatus: 'STANDBY - DETERMINISTIC FALLBACK',
    aiModel: 'deterministic_rule_engine',
    aiLoading: false,
    aiError: null,
    aiSummary: null,
    aiVesselExplanation: {},
    aiTimelineExplanation: null,
    aiEvidenceExplanation: null,
    aiQuestionResponse: null,
    aiActiveSubTab: 'summary',

    activeFilters: {},

    currentTimestamp: null,
    minTimestamp: null,
    maxTimestamp: null,
    isPlaying: false,
    playbackSpeed: 1,

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

            // Trigger background fetch of attribution rankings for candidates
            useIncidentStore.getState().fetchAttributions();
            useIncidentStore.getState().fetchUnifiedTimeline();
            useIncidentStore.getState().fetchSatelliteAnalysis(incidentId);
            useIncidentStore.getState().checkAiStatus(incidentId);
            useIncidentStore.getState().fetchAiSummary(incidentId);

        } catch (err: any) {
            console.error('Failed to fetch incident data:', err);
            set({ error: err.message || 'Network error', isLoading: false });
        }
    },

    setCurrentTimestamp: (ts: number) => set({ currentTimestamp: ts }),
    togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
    setSelectedVessel: (id: string | null) => {
        set({ selectedVesselId: id, selectedBehaviourEvent: null });
        if (id) {
            useIncidentStore.getState().fetchVesselIntelligence(id);
            useIncidentStore.getState().fetchVesselBehaviour(id);
        }
    },
    toggleLayer: (key: LayerKey) => set((state) => ({
        visibleLayers: { ...state.visibleLayers, [key]: !state.visibleLayers[key] }
    })),
    setMapMode: (mode: '2d' | '3d') => set({ mapMode: mode }),

    applyFilters: async (filters: Record<string, any>) => {
        const state = useIncidentStore.getState();
        const incidentId = state.incident?.id;
        if (!incidentId) return;

        set({ activeFilters: filters });
        
        try {
            const params = new URLSearchParams();
            if (filters.max_distance_km) params.append('max_distance_km', filters.max_distance_km);
            if (filters.min_speed) params.append('min_speed', filters.min_speed);
            if (filters.max_speed) params.append('max_speed', filters.max_speed);
            if (filters.vessel_types) params.append('vessel_types', filters.vessel_types);
            if (filters.must_encounter_spill) params.append('must_encounter_spill', 'true');
            if (filters.min_time) params.append('min_time', filters.min_time);
            if (filters.max_time) params.append('max_time', filters.max_time);

            const res = await fetch(`${API_BASE}/incidents/${incidentId}/vessels/filter?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                set({ filtering: data });
                
                const matchedIds = new Set(data.matched_vessels.map((v: any) => v.id));
                const updatedVessels = state.vessels.map(v => ({
                    ...v,
                    is_candidate: matchedIds.has(v.id)
                }));
                set({ vessels: updatedVessels });
            }
        } catch (err) {
            console.error('Filtering failed:', err);
        }
    },

    fetchVesselIntelligence: async (vesselId: string) => {
        const state = useIncidentStore.getState();
        const incidentId = state.incident?.id;
        if (!incidentId) return;

        try {
            const res = await fetch(`${API_BASE}/incidents/${incidentId}/vessels/${vesselId}/intelligence`);
            if (res.ok) {
                const data = await res.json();
                set(state => ({
                    vesselIntelligence: {
                        ...state.vesselIntelligence,
                        [vesselId]: data
                    }
                }));
            }
        } catch (err) {
            console.error('Intelligence fetch failed:', err);
        }
    },

    fetchVesselBehaviour: async (vesselId: string) => {
        const state = useIncidentStore.getState();
        const incidentId = state.incident?.id;
        if (!incidentId) return;

        try {
            const res = await fetch(`${API_BASE}/incidents/${incidentId}/vessels/${vesselId}/behaviour`);
            if (res.ok) {
                const data: VesselBehaviourProfileOut = await res.json();
                set(state => ({
                    vesselBehaviours: {
                        ...state.vesselBehaviours,
                        [vesselId]: data
                    }
                }));
            }
        } catch (err) {
            console.error('Behaviour fetch failed:', err);
        }
    },

    fetchAttributions: async (customWeights?: Partial<AttributionWeights>) => {
        const state = useIncidentStore.getState();
        const incidentId = state.incident?.id;
        if (!incidentId) return;

        set({ isAttributionsLoading: true, attributionsError: null });

        try {
            const weights = { ...state.attributionWeights, ...customWeights };
            const params = new URLSearchParams({
                candidates_only: 'true',
                w_spatial: weights.spatial.toString(),
                w_temporal: weights.temporal.toString(),
                w_trajectory: weights.trajectory.toString(),
                w_behaviour: weights.behaviour.toString(),
                w_quality: weights.quality.toString(),
            });

            const res = await fetch(`${API_BASE}/incidents/${incidentId}/vessels/attribution?${params.toString()}`);
            if (res.ok) {
                const data: VesselAttributionOut[] = await res.json();
                set({
                    rankedAttributions: data,
                    attributionWeights: weights,
                    isAttributionsLoading: false,
                });
            } else {
                const errData = await res.json().catch(() => ({ detail: 'Failed to fetch attributions' }));
                set({ isAttributionsLoading: false, attributionsError: errData.detail || 'Attribution calculation failed' });
            }
        } catch (err: any) {
            console.error('Attribution fetch failed:', err);
            set({ isAttributionsLoading: false, attributionsError: err.message || 'Network error' });
        }
    },

    setAttributionWeights: (weights: AttributionWeights) => {
        set({ attributionWeights: weights });
        useIncidentStore.getState().fetchAttributions(weights);
    },

    resetAttributionWeights: () => {
        set({ attributionWeights: DEFAULT_ATTRIBUTION_WEIGHTS });
        useIncidentStore.getState().fetchAttributions(DEFAULT_ATTRIBUTION_WEIGHTS);
    },

    selectBehaviourEvent: (event: BehaviourEventOut | null) => {
        set({ selectedBehaviourEvent: event });
    },

    fetchUnifiedTimeline: async (customParams?: { category?: string; vessel_id?: string; event_type?: string }) => {
        const state = useIncidentStore.getState();
        const incidentId = state.incident?.id;
        if (!incidentId) return;

        set({ isTimelineLoading: true, timelineError: null });
        try {
            const params = new URLSearchParams();
            const cat = customParams?.category !== undefined ? customParams.category : state.activeTimelineCategory;
            const vId = customParams?.vessel_id !== undefined ? customParams.vessel_id : state.activeTimelineVesselId;
            const eType = customParams?.event_type;

            if (cat && cat !== 'ALL') params.append('category', cat);
            if (vId) params.append('vessel_id', vId);
            if (eType) params.append('event_type', eType);

            const res = await fetch(`${API_BASE}/incidents/${incidentId}/timeline?${params.toString()}`);
            if (res.ok) {
                const data: UnifiedTimelineOut = await res.json();
                set({
                    timelineEvents: data.events,
                    timelineCorrelations: data.correlations,
                    isTimelineLoading: false,
                });
            } else {
                set({ isTimelineLoading: false, timelineError: 'Failed to load timeline events' });
            }
        } catch (err: any) {
            console.error('Unified timeline fetch failed:', err);
            set({ isTimelineLoading: false, timelineError: err.message || 'Network error' });
        }
    },

    selectTimelineEvent: (id: string | null) => {
        set({ selectedTimelineEventId: id });
        if (id) {
            const ev = useIncidentStore.getState().timelineEvents.find(e => e.event_id === id);
            if (ev?.vessel_id) {
                set({ selectedVesselId: ev.vessel_id });
            }
        }
    },

    setTimelineCategory: (cat: string) => {
        set({ activeTimelineCategory: cat });
        useIncidentStore.getState().fetchUnifiedTimeline({ category: cat });
    },

    setTimelineVesselId: (vesselId: string | null) => {
        set({ activeTimelineVesselId: vesselId });
        useIncidentStore.getState().fetchUnifiedTimeline({ vessel_id: vesselId || undefined });
    },

    // Phase 11 Actions
    fetchSatelliteAnalysis: async (customIncidentId?: string) => {
        const id = customIncidentId || useIncidentStore.getState().incident?.id;
        if (!id) return;

        set({ isSatelliteLoading: true, satelliteError: null });
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/satellite`);
            if (res.ok) {
                const data: SatelliteAnalysisOut = await res.json();
                const currentSelected = useIncidentStore.getState().selectedObservationId;
                const validSelection = data.observations.some(o => o.id === currentSelected)
                    ? currentSelected
                    : (data.observations.length > 0 ? data.observations[0].id : null);

                set({
                    satelliteAnalysis: data,
                    isSatelliteLoading: false,
                    selectedObservationId: validSelection,
                });
            } else {
                set({ isSatelliteLoading: false, satelliteError: 'Failed to load satellite analysis' });
            }
        } catch (err: any) {
            console.error('Satellite analysis fetch failed:', err);
            set({ isSatelliteLoading: false, satelliteError: err.message || 'Network error' });
        }
    },

    setSelectedObservationId: (id: string | null) => set({ selectedObservationId: id }),

    // Phase 12 AI Actions
    setAiActiveSubTab: (tab) => set({ aiActiveSubTab: tab }),

    checkAiStatus: async (customIncidentId?: string) => {
        const id = customIncidentId || useIncidentStore.getState().incident?.id;
        if (!id) return;
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/ai/status`);
            if (res.ok) {
                const data: AIStatusOut = await res.json();
                set({
                    aiAvailable: data.available,
                    aiStatus: data.status,
                    aiModel: data.model,
                });
            }
        } catch (err) {
            console.error('AI status check failed:', err);
            set({ aiAvailable: false, aiStatus: 'STANDBY - DETERMINISTIC FALLBACK' });
        }
    },

    fetchAiSummary: async (customIncidentId?: string) => {
        const id = customIncidentId || useIncidentStore.getState().incident?.id;
        if (!id) return;
        set({ aiLoading: true, aiError: null });
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/ai/summary`, { method: 'POST' });
            if (res.ok) {
                const data: AIResponseOut = await res.json();
                set({ aiSummary: data, aiLoading: false, aiAvailable: data.available, aiStatus: data.status });
            } else {
                set({ aiLoading: false, aiError: 'Failed to load AI investigation summary' });
            }
        } catch (err: any) {
            console.error('AI summary fetch failed:', err);
            set({ aiLoading: false, aiError: err.message || 'Network error' });
        }
    },

    fetchAiVesselExplanation: async (vesselId: string, customIncidentId?: string) => {
        const id = customIncidentId || useIncidentStore.getState().incident?.id;
        if (!id || !vesselId) return;
        set({ aiLoading: true, aiError: null });
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/ai/vessel/${vesselId}`, { method: 'POST' });
            if (res.ok) {
                const data: AIResponseOut = await res.json();
                set((state) => ({
                    aiVesselExplanation: { ...state.aiVesselExplanation, [vesselId]: data },
                    aiLoading: false,
                    aiAvailable: data.available,
                    aiStatus: data.status,
                }));
            } else {
                set({ aiLoading: false, aiError: `Failed to load AI vessel dossier for ${vesselId}` });
            }
        } catch (err: any) {
            console.error('AI vessel explanation fetch failed:', err);
            set({ aiLoading: false, aiError: err.message || 'Network error' });
        }
    },

    fetchAiTimelineExplanation: async (customIncidentId?: string) => {
        const id = customIncidentId || useIncidentStore.getState().incident?.id;
        if (!id) return;
        set({ aiLoading: true, aiError: null });
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/ai/timeline`, { method: 'POST' });
            if (res.ok) {
                const data: AIResponseOut = await res.json();
                set({ aiTimelineExplanation: data, aiLoading: false, aiAvailable: data.available, aiStatus: data.status });
            } else {
                set({ aiLoading: false, aiError: 'Failed to load AI timeline explanation' });
            }
        } catch (err: any) {
            console.error('AI timeline explanation fetch failed:', err);
            set({ aiLoading: false, aiError: err.message || 'Network error' });
        }
    },

    fetchAiEvidenceExplanation: async (customIncidentId?: string) => {
        const id = customIncidentId || useIncidentStore.getState().incident?.id;
        if (!id) return;
        set({ aiLoading: true, aiError: null });
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/ai/evidence`, { method: 'POST' });
            if (res.ok) {
                const data: AIResponseOut = await res.json();
                set({ aiEvidenceExplanation: data, aiLoading: false, aiAvailable: data.available, aiStatus: data.status });
            } else {
                set({ aiLoading: false, aiError: 'Failed to load AI evidence explanation' });
            }
        } catch (err: any) {
            console.error('AI evidence explanation fetch failed:', err);
            set({ aiLoading: false, aiError: err.message || 'Network error' });
        }
    },

    askAiQuestion: async (question: string, vesselId?: string, customIncidentId?: string) => {
        const id = customIncidentId || useIncidentStore.getState().incident?.id;
        if (!id || !question.trim()) return;
        set({ aiLoading: true, aiError: null });
        try {
            const res = await fetch(`${API_BASE}/incidents/${id}/ai/question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question.trim(), vessel_id: vesselId || undefined }),
            });
            if (res.ok) {
                const data: AIResponseOut = await res.json();
                set({ aiQuestionResponse: data, aiLoading: false, aiAvailable: data.available, aiStatus: data.status });
            } else {
                const errData = await res.json().catch(() => ({}));
                set({ aiLoading: false, aiError: errData.detail || 'Question query failed' });
            }
        } catch (err: any) {
            console.error('AI question query failed:', err);
            set({ aiLoading: false, aiError: err.message || 'Network error' });
        }
    },

    resetDemoState: () => {
        const state = useIncidentStore.getState();
        const minTime = state.minTimestamp ?? new Date('2026-09-15T06:00:00Z').getTime();
        const maxTime = state.maxTimestamp ?? new Date('2026-09-19T06:00:00Z').getTime();
        const midTime = Math.floor((minTime + maxTime) / 2);

        set({
            selectedVesselId: null,
            selectedBehaviourEvent: null,
            selectedTimelineEventId: null,
            activeTimelineCategory: 'ALL',
            activeTimelineVesselId: null,
            selectedObservationId: null,
            currentTimestamp: midTime,
            isPlaying: false,
            playbackSpeed: 1,
            activeFilters: {},
            isSummaryModalOpen: false,
            aiQuestionResponse: null,
            aiActiveSubTab: 'summary',
        });

        // Refetch pristine demonstration incident data
        useIncidentStore.getState().fetchIncidentData("OCEANTRACE-DEMO-001");
    },
}));
