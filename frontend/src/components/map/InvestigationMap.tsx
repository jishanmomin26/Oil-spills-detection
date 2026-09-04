import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Map from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { _GlobeView as GlobeView } from '@deck.gl/core';
import {
    GeoJsonLayer, ScatterplotLayer, PathLayer, LineLayer, IconLayer
} from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import 'maplibre-gl/dist/maplibre-gl.css';
import { parse } from 'wellknown';
import { useIncidentStore } from '../../store/useIncidentStore';
import type { AISPointOut } from '../../store/useIncidentStore';

const MAP_STYLE_2D = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// ── Utilities ─────────────────────────────────────────────────────────────────

const wktToGeoJSON = (wkt: string | undefined | null, props: Record<string, any> = {}) => {
    if (!wkt) return null;
    try {
        const geometry = parse(wkt);
        if (!geometry) return null;
        return { type: 'Feature' as const, geometry, properties: props };
    } catch { return null; }
};

const degToRad = (d: number) => (d * Math.PI) / 180;

const bearingOffset = (lon: number, lat: number, bearingDeg: number, lenDeg: number): [number, number] => [
    lon + lenDeg * Math.sin(degToRad(bearingDeg)),
    lat + lenDeg * Math.cos(degToRad(bearingDeg)),
];

// ── Ship SVG Icon Atlas ───────────────────────────────────────────────────────
// Triangle pointing UP (north), deck.gl rotates via getAngle
const ICON_SIZE = 64;
const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 64 64"><polygon points="32,4 52,58 32,44 12,58" fill="white"/></svg>`;
const ICON_ATLAS = `data:image/svg+xml,${encodeURIComponent(SHIP_SVG)}`;
const ICON_MAPPING = {
    ship: { x: 0, y: 0, width: ICON_SIZE, height: ICON_SIZE, anchorY: ICON_SIZE / 2 },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveVesselPoint {
    position: [number, number];
    vessel_id: string;
    name: string;
    vessel_type: string;
    flag_state: string;
    is_candidate: boolean;
    is_reconstructed: boolean;
    speed: number;
    heading: number;
    course: number;
    timestamp: string;
    gap_duration_hrs: number;
}

interface TrackSegment {
    path: [number, number][];
    vessel_id: string;
    is_candidate: boolean;
    is_reconstructed: boolean;
}

interface ArrowData {
    start: [number, number];
    end: [number, number];
    magnitude: number;
}

// ── Component Props ───────────────────────────────────────────────────────────

interface InvestigationMapProps {
    onRegisterFlyTo?: (fn: (lon: number, lat: number, zoom: number) => void) => void;
    onRegisterResetView?: (fn: () => void) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const InvestigationMap = ({ onRegisterFlyTo, onRegisterResetView }: InvestigationMapProps) => {
    const {
        spills, origin, vessels, tracks, drift, weather, currents, forecast,
        currentTimestamp, isLoading, visibleLayers, selectedVesselId,
        setSelectedVessel, mapMode,
    } = useIncidentStore();

    const [hoverInfo, setHoverInfo] = useState<{
        x: number; y: number; object: any; layerType: string;
    } | null>(null);

    // Controlled view state for programmatic camera movement
    const centerLon = origin?.center_lon ?? 65.5;
    const centerLat = origin?.center_lat ?? 15.5;

    const defaultViewState = useMemo(() => ({
        longitude: centerLon,
        latitude: centerLat,
        zoom: 7,
        pitch: 0,
        bearing: 0,
        minZoom: 1,
        transitionDuration: 0,
    }), [centerLon, centerLat]);

    const [viewState, setViewState] = useState<any>(null);

    // Initialize viewState on first mount (once origin is loaded)
    useEffect(() => {
        if (viewState === null && !isLoading) {
            setViewState(defaultViewState);
        }
    }, [isLoading, defaultViewState, viewState]);

    // Register flyTo so CommandCenter can trigger it
    useEffect(() => {
        const flyTo = (lon: number, lat: number, zoom: number) => {
            setViewState((prev: any) => ({
                ...(prev ?? defaultViewState),
                longitude: lon,
                latitude: lat,
                zoom,
                transitionDuration: 1200,
            }));
        };
        const resetView = () => {
            setViewState({ ...defaultViewState, transitionDuration: 800 });
        };
        onRegisterFlyTo?.(flyTo);
        onRegisterResetView?.(resetView);
    }, [defaultViewState, onRegisterFlyTo, onRegisterResetView]);

    // ── Data Processing ───────────────────────────────────────────────────────

    const vesselById = useMemo(() => {
        const m: Record<string, typeof vessels[0]> = {};
        for (const v of vessels) m[v.id] = v;
        return m;
    }, [vessels]);

    const VESSEL_SNAP_WINDOW = 2 * 60 * 60 * 1000;

    const activeVesselPoints = useMemo((): ActiveVesselPoint[] => {
        if (!tracks.length || !currentTimestamp) return [];
        const results: ActiveVesselPoint[] = [];
        for (const track of tracks) {
            let best: AISPointOut | null = null;
            let bestDiff = Infinity;
            for (const pt of track.points) {
                if (!pt.timestamp) continue;
                const diff = Math.abs(new Date(pt.timestamp).getTime() - currentTimestamp);
                if (diff < bestDiff && diff < VESSEL_SNAP_WINDOW) { bestDiff = diff; best = pt; }
            }
            if (!best) continue;
            const v = vesselById[track.vessel_id];
            results.push({
                position: [best.lon, best.lat],
                vessel_id: track.vessel_id,
                name: v?.name ?? 'Unknown',
                vessel_type: v?.vessel_type ?? 'Unknown',
                flag_state: v?.flag_state ?? '??',
                is_candidate: v?.is_candidate ?? false,
                is_reconstructed: best.is_reconstructed ?? false,
                speed: best.speed_knots ?? 0,
                heading: best.heading_deg ?? 0,
                course: best.course_deg ?? 0,
                timestamp: best.timestamp ?? '',
                gap_duration_hrs: best.gap_duration_hrs ?? 0,
            });
        }
        return results;
    }, [tracks, currentTimestamp, vesselById]);

    const trackSegments = useMemo((): TrackSegment[] => {
        const segments: TrackSegment[] = [];
        for (const track of tracks) {
            const sorted = [...track.points].sort(
                (a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime()
            );
            const v = vesselById[track.vessel_id];
            const is_candidate = v?.is_candidate ?? false;

            let currentRun: [number, number][] = [];
            let currentIsRec = false;

            for (let i = 0; i < sorted.length; i++) {
                const p = sorted[i];
                const isRec = p.is_reconstructed ?? false;

                if (i === 0) {
                    currentIsRec = isRec;
                    currentRun = [[p.lon, p.lat]];
                } else if (isRec === currentIsRec) {
                    currentRun.push([p.lon, p.lat]);
                } else {
                    currentRun.push([p.lon, p.lat]);
                    if (currentRun.length >= 2) {
                        segments.push({ path: currentRun, vessel_id: track.vessel_id, is_candidate, is_reconstructed: currentIsRec });
                    }
                    currentIsRec = isRec;
                    currentRun = [[sorted[i - 1].lon, sorted[i - 1].lat], [p.lon, p.lat]];
                }
            }
            if (currentRun.length >= 2) {
                segments.push({ path: currentRun, vessel_id: track.vessel_id, is_candidate, is_reconstructed: currentIsRec });
            }
        }
        return segments;
    }, [tracks, vesselById]);

    const DRIFT_TIME_WINDOW = 90 * 60 * 1000;

    const hindcastParticles = useMemo(() => {
        if (!currentTimestamp) return [];
        const sim = drift.find(d => d.simulation_type === 'HINDCAST');
        if (!sim) return [];
        return sim.particles
            .filter(p => p.timestamp && Math.abs(new Date(p.timestamp).getTime() - currentTimestamp) <= DRIFT_TIME_WINDOW)
            .map(p => ({ position: [p.lon, p.lat] as [number, number], ts: p.timestamp }));
    }, [drift, currentTimestamp]);

    const forecastParticles = useMemo(() => {
        if (!currentTimestamp) return [];
        const sim = drift.find(d => d.simulation_type === 'FORECAST');
        if (!sim) return [];
        return sim.particles
            .filter(p => p.timestamp && Math.abs(new Date(p.timestamp).getTime() - currentTimestamp) <= DRIFT_TIME_WINDOW)
            .map(p => ({ position: [p.lon, p.lat] as [number, number], ts: p.timestamp }));
    }, [drift, currentTimestamp]);

    const ENV_TIME_WINDOW = 3 * 60 * 60 * 1000;

    const windArrows = useMemo((): ArrowData[] => {
        if (!currentTimestamp) return [];
        const arrows: ArrowData[] = [];
        for (const w of weather) {
            if (!w.timestamp || !w.location_wkt) continue;
            if (Math.abs(new Date(w.timestamp).getTime() - currentTimestamp) > ENV_TIME_WINDOW) continue;
            const f = wktToGeoJSON(w.location_wkt);
            if (!f || f.geometry.type !== 'Point') continue;
            const [lon, lat] = f.geometry.coordinates as [number, number];
            const end = bearingOffset(lon, lat, w.wind_direction_deg ?? 0, 0.08);
            arrows.push({ start: [lon, lat], end, magnitude: w.wind_speed_ms ?? 0 });
        }
        return arrows;
    }, [weather, currentTimestamp]);

    const currentArrows = useMemo((): ArrowData[] => {
        if (!currentTimestamp) return [];
        const arrows: ArrowData[] = [];
        for (const c of currents) {
            if (!c.timestamp || !c.location_wkt) continue;
            if (Math.abs(new Date(c.timestamp).getTime() - currentTimestamp) > ENV_TIME_WINDOW) continue;
            const f = wktToGeoJSON(c.location_wkt);
            if (!f || f.geometry.type !== 'Point') continue;
            const [lon, lat] = f.geometry.coordinates as [number, number];
            const end = bearingOffset(lon, lat, c.direction_deg ?? 0, 0.12);
            arrows.push({ start: [lon, lat], end, magnitude: c.speed_ms ?? 0 });
        }
        return arrows;
    }, [currents, currentTimestamp]);

    // ── Interaction ───────────────────────────────────────────────────────────

    const makeHoverHandler = useCallback((layerType: string) => (info: any) => {
        if (info.object) {
            setHoverInfo({ x: info.x, y: info.y, object: info.object, layerType });
        } else {
            setHoverInfo(null);
        }
    }, []);

    const onVesselClick = useCallback((info: any) => {
        if (info.object) {
            const vid = info.object.vessel_id;
            setSelectedVessel(vid === selectedVesselId ? null : vid);
        }
    }, [selectedVesselId, setSelectedVessel]);

    // ── Layer Definitions ─────────────────────────────────────────────────────

    const spillLayer = useMemo(() => {
        if (!visibleLayers.spill || !spills.length) return null;
        const features = spills.map(s => wktToGeoJSON(s.geometry_wkt, {
            _type: 'spill', area_km2: s.area_km2, confidence: s.confidence,
            severity: s.estimated_severity, detection_method: s.detection_method,
            oil_probability: s.oil_probability,
        })).filter((f): f is NonNullable<typeof f> => Boolean(f));
        if (!features.length) return null;

        return new GeoJsonLayer({
            id: 'spills-layer',
            data: { type: 'FeatureCollection', features },
            pickable: true, stroked: true, filled: true,
            getFillColor: [220, 38, 38, 100],
            getLineColor: [255, 60, 60, 230],
            lineWidthMinPixels: 2,
            onHover: makeHoverHandler('spill'),
        });
    }, [spills, visibleLayers.spill, makeHoverHandler]);

    const originLayer = useMemo(() => {
        if (!visibleLayers.origin || !origin?.ellipse_wkt) return null;
        const feature = wktToGeoJSON(origin.ellipse_wkt, {
            _type: 'origin', probability: origin.probability,
            uncertainty_radius_km: origin.uncertainty_radius_km,
            time_window_start: origin.time_window_start,
            time_window_end: origin.time_window_end,
            forward_validation_distance_km: origin.forward_validation_distance_km,
            spatial_overlap_pct: origin.spatial_overlap_pct,
        });
        if (!feature) return null;
        return new GeoJsonLayer({
            id: 'origin-layer',
            data: { type: 'FeatureCollection', features: [feature] },
            pickable: true, stroked: true, filled: true,
            getFillColor: [16, 185, 129, 50],
            getLineColor: [16, 185, 129, 210],
            lineWidthMinPixels: 2,
            onHover: makeHoverHandler('origin'),
        });
    }, [origin, visibleLayers.origin, makeHoverHandler]);

    const forecastZoneLayer = useMemo(() => {
        if (!visibleLayers.forecast || !forecast?.affected_zone_wkt) return null;
        const geometry = parse(forecast.affected_zone_wkt);
        if (!geometry) return null;
        return new GeoJsonLayer({
            id: 'forecast-zone',
            data: {
                type: 'Feature', geometry,
                properties: { _type: 'forecast', confidence: forecast.confidence, uncertainty_radius_km: forecast.uncertainty_radius_km, forecast_time: forecast.forecast_time }
            },
            filled: true, stroked: true,
            getFillColor: [56, 189, 248, 35],
            getLineColor: [56, 189, 248, 180],
            lineWidthMinPixels: 2,
            pickable: true,
            onHover: makeHoverHandler('forecast'),
        });
    }, [forecast, visibleLayers.forecast, makeHoverHandler]);

    const observedTracksLayer = useMemo(() => {
        const observed = trackSegments.filter(s => !s.is_reconstructed && (visibleLayers.tracks || s.vessel_id === selectedVesselId));
        if (!observed.length) return null;
        return new PathLayer<TrackSegment>({
            id: 'tracks-observed',
            data: observed,
            getPath: (d) => d.path,
            getColor: (d) => {
                if (d.vessel_id === selectedVesselId) return [56, 189, 248, 255];
                if (d.is_candidate) return [244, 63, 94, 120];
                return [100, 100, 140, 40];
            },
            getWidth: (d) => {
                if (d.vessel_id === selectedVesselId) return 4;
                if (d.is_candidate) return 2;
                return 1.5;
            },
            widthUnits: 'pixels',
            widthMinPixels: 1,
            widthMaxPixels: 5,
            jointRounded: true,
            capRounded: true,
            updateTriggers: {
                getColor: [selectedVesselId],
                getWidth: [selectedVesselId],
            },
        });
    }, [trackSegments, visibleLayers.tracks, selectedVesselId]);

    // Reconstructed track segments — orange, thinner, dashed
    const reconstructedTracksLayer = useMemo(() => {
        const recs = trackSegments.filter(s => s.is_reconstructed && (visibleLayers.tracks || s.vessel_id === selectedVesselId));
        if (!recs.length) return null;
        return new PathLayer<TrackSegment>({
            id: 'tracks-reconstructed',
            data: recs,
            getPath: (d) => d.path,
            getColor: (d) => d.vessel_id === selectedVesselId
                ? [251, 191, 36, 255]
                : [251, 191, 36, 60],
            getWidth: 2,
            widthUnits: 'pixels',
            widthMinPixels: 1,
            widthMaxPixels: 3,
            // @ts-expect-error deck.gl types for PathStyleExtension are incomplete
            getDashArray: [4, 4],
            dashJustified: true,
            extensions: [new PathStyleExtension({ dash: true })],
            updateTriggers: { getColor: [selectedVesselId] },
        });
    }, [trackSegments, visibleLayers.tracks, selectedVesselId]);

    // Reconstructed AIS position dots (orange circles) at current time
    const reconstructedDotsLayer = useMemo(() => {
        if (!currentTimestamp) return null;
        const WIN = 2 * 60 * 60 * 1000;
        const pts: { position: [number, number], vessel_id: string }[] = [];
        for (const track of tracks) {
            if (!visibleLayers.tracks && track.vessel_id !== selectedVesselId) continue;
            for (const p of track.points) {
                if (!p.is_reconstructed || !p.timestamp) continue;
                if (Math.abs(new Date(p.timestamp).getTime() - currentTimestamp) > WIN) continue;
                pts.push({ position: [p.lon, p.lat], vessel_id: track.vessel_id });
            }
        }
        if (!pts.length) return null;
        return new ScatterplotLayer({
            id: 'reconstructed-ais-dots',
            data: pts,
            getPosition: (d: any) => d.position,
            getFillColor: (d: any) => d.vessel_id === selectedVesselId ? [251, 191, 36, 255] : [251, 191, 36, 120],
            getLineColor: [0, 0, 0, 180],
            stroked: true,
            lineWidthMinPixels: 1,
            getRadius: 800,
            radiusMinPixels: 3,
            radiusMaxPixels: 6,
            updateTriggers: { getFillColor: [selectedVesselId] },
        });
    }, [tracks, currentTimestamp, visibleLayers.tracks, selectedVesselId]);

    const hindcastLayer = useMemo(() => {
        if (!visibleLayers.hindcast || !hindcastParticles.length) return null;
        return new ScatterplotLayer({
            id: 'hindcast-particles',
            data: hindcastParticles,
            getPosition: (d: any) => d.position,
            getFillColor: [245, 158, 11, 120],
            getRadius: 400, radiusMinPixels: 2, radiusMaxPixels: 5,
            pickable: true, onHover: makeHoverHandler('hindcast'),
        });
    }, [hindcastParticles, visibleLayers.hindcast, makeHoverHandler]);

    const forecastParticlesLayer = useMemo(() => {
        if (!visibleLayers.forecast || !forecastParticles.length) return null;
        return new ScatterplotLayer({
            id: 'forecast-particles',
            data: forecastParticles,
            getPosition: (d: any) => d.position,
            getFillColor: [34, 211, 238, 120],
            getRadius: 400, radiusMinPixels: 2, radiusMaxPixels: 5,
            pickable: true, onHover: makeHoverHandler('forecast_particle'),
        });
    }, [forecastParticles, visibleLayers.forecast, makeHoverHandler]);

    const windLayer = useMemo(() => {
        if (!visibleLayers.wind || !windArrows.length) return null;
        return new LineLayer({
            id: 'wind-vectors',
            data: windArrows,
            getSourcePosition: (d: ArrowData) => d.start,
            getTargetPosition: (d: ArrowData) => d.end,
            getColor: (d: ArrowData) => [100, 180, 255, Math.min(220, 80 + d.magnitude * 18)] as [number, number, number, number],
            getWidth: 2, widthUnits: 'pixels', widthMinPixels: 1,
        });
    }, [windArrows, visibleLayers.wind]);

    const currentVectorLayer = useMemo(() => {
        if (!visibleLayers.current || !currentArrows.length) return null;
        return new LineLayer({
            id: 'current-vectors',
            data: currentArrows,
            getSourcePosition: (d: ArrowData) => d.start,
            getTargetPosition: (d: ArrowData) => d.end,
            getColor: (d: ArrowData) => [16, 185, 129, Math.min(220, 80 + d.magnitude * 600)] as [number, number, number, number],
            getWidth: 2, widthUnits: 'pixels', widthMinPixels: 1,
        });
    }, [currentArrows, visibleLayers.current]);

    // Vessel heading-aware icon layer
    const vesselIconLayer = useMemo(() => {
        if (!visibleLayers.vessels || !activeVesselPoints.length) return null;
        return new IconLayer<ActiveVesselPoint>({
            id: 'vessel-icons',
            data: activeVesselPoints,
            iconAtlas: ICON_ATLAS,
            iconMapping: ICON_MAPPING,
            getIcon: () => 'ship',
            getPosition: (d) => d.position,
            getSize: (d) => d.vessel_id === selectedVesselId ? 32 : (d.is_candidate ? 20 : 10),
            getColor: (d) => {
                if (d.vessel_id === selectedVesselId) return [34, 211, 238, 255];
                if (selectedVesselId) return [100, 100, 110, 80];
                if (d.is_candidate) return [244, 63, 94, 255];
                return [160, 160, 185, 120];
            },
            getAngle: (d) => d.heading,
            billboard: true,
            sizeUnits: 'pixels',
            pickable: true,
            onHover: makeHoverHandler('vessel'),
            onClick: onVesselClick,
            updateTriggers: {
                getSize: [selectedVesselId],
                getColor: [selectedVesselId],
            },
        });
    }, [activeVesselPoints, visibleLayers.vessels, selectedVesselId, makeHoverHandler, onVesselClick]);

    // Selection ring around selected vessel
    const selectedRingLayer = useMemo(() => {
        if (!selectedVesselId || !activeVesselPoints.length) return null;
        const selPt = activeVesselPoints.find(p => p.vessel_id === selectedVesselId);
        if (!selPt) return null;
        return new ScatterplotLayer({
            id: 'selected-vessel-ring',
            data: [selPt],
            getPosition: (d: any) => d.position,
            getFillColor: [0, 0, 0, 0],
            getLineColor: [34, 211, 238, 255],
            stroked: true, filled: false,
            lineWidthMinPixels: 2,
            getRadius: 5000, radiusMinPixels: 20, radiusMaxPixels: 38,
        });
    }, [activeVesselPoints, selectedVesselId]);

    const allLayers = [
        spillLayer, originLayer, forecastZoneLayer,
        observedTracksLayer, reconstructedTracksLayer,
        hindcastLayer, forecastParticlesLayer,
        windLayer, currentVectorLayer,
        reconstructedDotsLayer,
        vesselIconLayer, selectedRingLayer,
    ].filter(Boolean);

    // ── Tooltip ───────────────────────────────────────────────────────────────

    const renderTooltip = () => {
        if (!hoverInfo?.object) return null;
        const { x, y, object: obj, layerType } = hoverInfo;
        const p = obj.properties ?? obj;

        const wrap: React.CSSProperties = {
            position: 'fixed', left: Math.min(x + 14, window.innerWidth - 260), top: Math.max(y - 10, 4),
            zIndex: 9999, background: 'rgba(9,9,11,0.95)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
            padding: '12px 14px', fontSize: '12px',
            fontFamily: "'Inter', system-ui, sans-serif", color: '#e4e4e7',
            maxWidth: '250px', pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        };

        const TT = ({ label, v, accent }: { label: string; v: any; accent?: string }) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', marginBottom: '4px' }}>
                <span style={{ color: '#71717a', fontSize: '11px' }}>{label}</span>
                <span style={{ color: accent ?? '#d4d4d8', fontFamily: 'monospace', fontSize: '11px', fontWeight: 600 }}>{v ?? '—'}</span>
            </div>
        );
        const Sep = () => <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />;

        if (layerType === 'spill') return (
            <div style={wrap}>
                <div style={{ fontSize: '9px', color: '#71717a', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>OIL SPILL DETECTION</div>
                <Sep />
                <TT label="Area" v={`${(p.area_km2 ?? 0).toFixed(2)} km²`} />
                <TT label="Detection Confidence" v={`${((p.confidence ?? 0) * 100).toFixed(1)}%`} accent="#34d399" />
                <TT label="Severity" v={p.severity} accent={p.severity === 'HIGH' ? '#f87171' : undefined} />
                <TT label="Oil Probability" v={`${((p.oil_probability ?? 0) * 100).toFixed(1)}%`} />
                <TT label="Detection Method" v={p.detection_method} />
                <Sep />
                <div style={{ fontSize: '9px', color: '#3f3f46', fontStyle: 'italic' }}>RESULT CLASSIFICATION: SIMULATED DEMO DATA</div>
            </div>
        );

        if (layerType === 'origin') return (
            <div style={wrap}>
                <div style={{ fontSize: '9px', color: '#71717a', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>PROBABLE ORIGIN ZONE</div>
                <Sep />
                <TT label="Origin Probability" v={`${((p.probability ?? 0) * 100).toFixed(1)}%`} accent="#34d399" />
                <TT label="Uncertainty Radius" v={`${(p.uncertainty_radius_km ?? 0).toFixed(1)} km`} />
                <TT label="Time Window Start" v={p.time_window_start?.substring(11, 16) + ' UTC'} />
                <TT label="Time Window End" v={p.time_window_end?.substring(11, 16) + ' UTC'} />
                <TT label="Validation Distance" v={p.forward_validation_distance_km ? `${p.forward_validation_distance_km.toFixed(1)} km` : '—'} />
                <TT label="Spatial Overlap" v={p.spatial_overlap_pct ? `${p.spatial_overlap_pct.toFixed(1)}%` : '—'} />
            </div>
        );

        if (layerType === 'vessel') return (
            <div style={wrap}>
                <div style={{ fontSize: '9px', color: '#71717a', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>VESSEL</div>
                <div style={{ fontWeight: 700, color: obj.is_candidate ? '#f87171' : '#e4e4e7', fontSize: '13px', marginBottom: '8px' }}>{obj.name}</div>
                <Sep />
                <TT label="Type" v={obj.vessel_type} />
                <TT label="Flag" v={obj.flag_state} />
                <TT label="Speed" v={`${(obj.speed ?? 0).toFixed(1)} kn`} />
                <TT label="Heading" v={`${(obj.heading ?? 0).toFixed(1)}°`} />
                <TT label="Position" v={`${(obj.position?.[1] ?? 0).toFixed(4)}°N ${(obj.position?.[0] ?? 0).toFixed(4)}°E`} />
                <TT label="AIS Timestamp" v={obj.timestamp ? obj.timestamp.substring(11, 16) + ' UTC' : '—'} />
                <Sep />
                <TT label="AIS Status" v={obj.is_reconstructed ? 'RECONSTRUCTED' : 'OBSERVED'} accent={obj.is_reconstructed ? '#fbbf24' : '#34d399'} />
                {(obj.gap_duration_hrs ?? 0) > 0 && <TT label="Gap Duration" v={`${obj.gap_duration_hrs.toFixed(1)} hrs`} accent="#fbbf24" />}
                <TT label="Investigation Priority" v={obj.is_candidate ? 'HIGH CANDIDATE' : 'Normal'} accent={obj.is_candidate ? '#f87171' : undefined} />
                <Sep />
                <div style={{ fontSize: '9px', color: '#52525b' }}>Click to select • see full details</div>
            </div>
        );

        if (layerType === 'hindcast') return (
            <div style={wrap}>
                <div style={{ fontSize: '9px', color: '#f59e0b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>HINDCAST DRIFT PARTICLE</div>
                <TT label="Simulation Type" v="HINDCAST (Backward)" accent="#f59e0b" />
                <TT label="Method" v="Lagrangian Particle" />
                <TT label="Position" v={obj.position ? `${obj.position[1].toFixed(4)}°N ${obj.position[0].toFixed(4)}°E` : '—'} />
                <Sep />
                <div style={{ fontSize: '9px', color: '#3f3f46', fontStyle: 'italic' }}>SIMULATED DEMO DATA</div>
            </div>
        );

        if (layerType === 'forecast' || layerType === 'forecast_particle') return (
            <div style={wrap}>
                <div style={{ fontSize: '9px', color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>FORECAST DRIFT</div>
                <TT label="Simulation Type" v="FORECAST (Forward)" accent="#38bdf8" />
                {p.confidence != null && <TT label="Confidence" v={`${(p.confidence * 100).toFixed(0)}%`} />}
                {p.forecast_time && <TT label="Target Time" v={p.forecast_time.substring(11, 16) + ' UTC'} />}
                <Sep />
                <div style={{ fontSize: '9px', color: '#3f3f46', fontStyle: 'italic' }}>MODELLED DEMO DATA</div>
            </div>
        );

        return null;
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (isLoading || viewState === null) {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', flexDirection: 'column', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid rgba(34,211,238,0.2)', borderTop: '3px solid #22d3ee', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#52525b', letterSpacing: '2px' }}>LOADING SPATIAL DATA...</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    const deckProps = {
        viewState,
        onViewStateChange: ({ viewState: vs }: any) => setViewState(vs),
        controller: true,
        layers: allLayers,
        onHover: (info: any) => { if (!info.object) setHoverInfo(null); },
        style: { position: 'absolute' as const, inset: '0' },
    };

    if (mapMode === '3d') {
        return (
            <div style={{ width: '100%', height: '100%', position: 'relative', background: '#030712' }}>
                <DeckGL {...deckProps} views={new GlobeView({ id: 'globe' })}>
                    {/* Globe renders on WebGL canvas directly, no MapLibre */}
                </DeckGL>
                {renderTooltip()}
                {/* Globe mode indicator */}
                <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', padding: '3px 12px', background: 'rgba(9,9,11,0.7)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: '20px', fontSize: '10px', fontFamily: 'monospace', color: '#22d3ee', letterSpacing: '1px', pointerEvents: 'none' }}>
                    3D GLOBE MODE — DRAG TO ROTATE
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <DeckGL {...deckProps}>
                <Map mapStyle={MAP_STYLE_2D} />
            </DeckGL>
            {renderTooltip()}
        </div>
    );
};
