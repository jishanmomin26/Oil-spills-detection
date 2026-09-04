import React, { useMemo, useState, useCallback, useEffect } from "react";
import Map from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { _GlobeView as GlobeView } from "@deck.gl/core";
import {
  GeoJsonLayer,
  ScatterplotLayer,
  PathLayer,
  LineLayer,
  IconLayer,
  TextLayer,
  SolidPolygonLayer,
} from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import "maplibre-gl/dist/maplibre-gl.css";
import { parse } from "wellknown";
import { useIncidentStore } from "../../store/useIncidentStore";
import type { AISPointOut } from "../../store/useIncidentStore";

// ── Shared color palette for 2D + 3D visual consistency ──────────────────────
const COLORS = {
  ocean: "#061325",       // Deep marine navy — unambiguously water
  land: "#172b22",        // Terrestrial dark sage/forest — unambiguously land
  landLight: "#1e382b",   // Slightly lighter for vegetation
  coastline: "#10b981",   // Glowing emerald accent for coastlines
  border: "#334155",      // Clean slate for country borders
  waterway: "#0a1e33",    // Marine navy for rivers
  labelText: "#f8fafc",   // Crisp silver-white text
  labelHalo: "#091a2a",   // Navy halo behind labels
  // RGBA arrays for deck.gl
  oceanRGBA: [6, 19, 37, 255] as [number, number, number, number],
  landRGBA: [23, 43, 34, 255] as [number, number, number, number],
  coastlineRGBA: [16, 185, 129, 230] as [number, number, number, number],
  borderRGBA: [51, 65, 85, 200] as [number, number, number, number],
};

// ── Custom 2D MapLibre basemap — Deep navy ocean, green-gray land ────────────
const MAP_STYLE_2D: any = {
  version: 8,
  name: "OceanTrace Maritime",
  sources: {
    ne_110m_land: {
      type: "geojson",
      data: "/data/geography/natural-earth/ne_110m_admin_0_countries.geojson",
    },
    ne_50m_land: {
      type: "geojson",
      data: "/data/geography/natural-earth/ne_50m_admin_0_countries.geojson",
    },
    ne_110m_coast: {
      type: "geojson",
      data: "/data/geography/natural-earth/ne_110m_coastline.geojson",
    },
    ne_50m_coast: {
      type: "geojson",
      data: "/data/geography/natural-earth/ne_50m_coastline.geojson",
    },
  },
  layers: [
    // 1. Ocean background
    {
      id: "background",
      type: "background",
      paint: { "background-color": COLORS.ocean },
    },
    // 2. Land (Global / Low Zoom)
    {
      id: "land-110m",
      type: "fill",
      source: "ne_110m_land",
      maxzoom: 3,
      paint: { "fill-color": COLORS.land },
    },
    // 2. Land (Regional / Medium Zoom)
    {
      id: "land-50m",
      type: "fill",
      source: "ne_50m_land",
      minzoom: 3,
      paint: { "fill-color": COLORS.land },
    },
    // 3. Coastline (Global)
    {
      id: "coastline-110m",
      type: "line",
      source: "ne_110m_coast",
      maxzoom: 3,
      paint: {
        "line-color": COLORS.coastline,
        "line-width": 1.8,
      },
    },
    // 3. Coastline (Regional)
    {
      id: "coastline-50m",
      type: "line",
      source: "ne_50m_coast",
      minzoom: 3,
      paint: {
        "line-color": COLORS.coastline,
        "line-width": 2.4,
      },
    },
    // 4. Country Borders (Global)
    {
      id: "borders-110m",
      type: "line",
      source: "ne_110m_land",
      maxzoom: 3,
      paint: {
        "line-color": COLORS.border,
        "line-width": 0.5,
        "line-dasharray": [3, 2],
      },
    },
    // 4. Country Borders (Regional)
    {
      id: "borders-50m",
      type: "line",
      source: "ne_50m_land",
      minzoom: 3,
      paint: {
        "line-color": COLORS.border,
        "line-width": 0.8,
        "line-dasharray": [3, 2],
      },
    },
  ],
};

// ── Utilities ─────────────────────────────────────────────────────────────────

const wktToGeoJSON = (
  wkt: string | undefined | null,
  props: Record<string, any> = {},
) => {
  if (!wkt) return null;
  try {
    const geometry = parse(wkt);
    if (!geometry) return null;
    return { type: "Feature" as const, geometry, properties: props };
  } catch {
    return null;
  }
};

const degToRad = (d: number) => (d * Math.PI) / 180;

const bearingOffset = (
  lon: number,
  lat: number,
  bearingDeg: number,
  lenDeg: number,
): [number, number] => [
  lon + lenDeg * Math.sin(degToRad(bearingDeg)),
  lat + lenDeg * Math.cos(degToRad(bearingDeg)),
];

// ── Professional Cartographic Label Spacing Helper ────────────────────────────
const formatCartographicLabel = (name: string, category?: string) => {
  if (!name) return "";
  const upper = name.toUpperCase();
  if (upper.includes("(") || upper.includes("/")) {
    return upper;
  }
  if (category === "ocean") {
    // E.g. "I N D I A N   O C E A N"
    return upper
      .split(" ")
      .map((w) => w.split("").join(" "))
      .join("    ");
  }
  if (category === "sea") {
    // E.g. "A R A B I A N   S E A"
    return upper
      .split(" ")
      .map((w) => w.split("").join(" "))
      .join("   ");
  }
  if (category === "gulf" || category === "strait") {
    return upper
      .split(" ")
      .map((w) => w.split("").join(" "))
      .join("  ");
  }
  return upper;
};

// ── Ship SVG Icon Atlas ───────────────────────────────────────────────────────
// Triangle pointing UP (north), deck.gl rotates via getAngle
const ICON_SIZE = 64;
const SHIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 64 64"><polygon points="32,4 52,58 32,44 12,58" fill="white"/></svg>`;
const ICON_ATLAS = `data:image/svg+xml,${encodeURIComponent(SHIP_SVG)}`;
const ICON_MAPPING = {
  ship: {
    x: 0,
    y: 0,
    width: ICON_SIZE,
    height: ICON_SIZE,
    anchorY: ICON_SIZE / 2,
  },
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
  onRegisterFlyTo?: (
    fn: (lon: number, lat: number, zoom: number) => void,
  ) => void;
  onRegisterResetView?: (fn: () => void) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const InvestigationMap = ({
  onRegisterFlyTo,
  onRegisterResetView,
}: InvestigationMapProps) => {
  const {
    spills,
    origin,
    vessels,
    tracks,
    drift,
    weather,
    currents,
    forecast,
    currentTimestamp,
    isLoading,
    visibleLayers,
    selectedVesselId,
    setSelectedVessel,
    mapMode,
    vesselIntelligence,
    vesselBehaviours,
    selectedBehaviourEvent,
    selectBehaviourEvent,
    selectedTimelineEventId,
    timelineEvents,
    satelliteAnalysis,
    selectedObservationId,
  } = useIncidentStore();

  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    object: any;
    layerType: string;
  } | null>(null);
  const [cursorCoord, setCursorCoord] = useState<[number, number] | null>(null);

  // Controlled view state for programmatic camera movement
  const centerLon = origin?.center_lon ?? 65.5;
  const centerLat = origin?.center_lat ?? 15.5;

  const defaultViewState = useMemo(
    () => ({
      longitude: centerLon,
      latitude: centerLat,
      zoom: 7,
      pitch: 0,
      bearing: 0,
      minZoom: 1,
      transitionDuration: 0,
    }),
    [centerLon, centerLat],
  );

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
    const m: Record<string, (typeof vessels)[0]> = {};
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
        const diff = Math.abs(
          new Date(pt.timestamp).getTime() - currentTimestamp,
        );
        if (diff < bestDiff && diff < VESSEL_SNAP_WINDOW) {
          bestDiff = diff;
          best = pt;
        }
      }
      if (!best) continue;
      const v = vesselById[track.vessel_id];
      results.push({
        position: [best.lon, best.lat],
        vessel_id: track.vessel_id,
        name: v?.name ?? "Unknown",
        vessel_type: v?.vessel_type ?? "Unknown",
        flag_state: v?.flag_state ?? "??",
        is_candidate: v?.is_candidate ?? false,
        is_reconstructed: best.is_reconstructed ?? false,
        speed: best.speed_knots ?? 0,
        heading: best.heading_deg ?? 0,
        course: best.course_deg ?? 0,
        timestamp: best.timestamp ?? "",
        gap_duration_hrs: best.gap_duration_hrs ?? 0,
      });
    }
    return results;
  }, [tracks, currentTimestamp, vesselById]);

  const trackSegments = useMemo((): TrackSegment[] => {
    const segments: TrackSegment[] = [];
    for (const track of tracks) {
      const sorted = [...track.points].sort(
        (a, b) =>
          new Date(a.timestamp ?? 0).getTime() -
          new Date(b.timestamp ?? 0).getTime(),
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
            segments.push({
              path: currentRun,
              vessel_id: track.vessel_id,
              is_candidate,
              is_reconstructed: currentIsRec,
            });
          }
          currentIsRec = isRec;
          currentRun = [
            [sorted[i - 1].lon, sorted[i - 1].lat],
            [p.lon, p.lat],
          ];
        }
      }
      if (currentRun.length >= 2) {
        segments.push({
          path: currentRun,
          vessel_id: track.vessel_id,
          is_candidate,
          is_reconstructed: currentIsRec,
        });
      }
    }
    return segments;
  }, [tracks, vesselById]);

  const DRIFT_TIME_WINDOW = 90 * 60 * 1000;

  const hindcastParticles = useMemo(() => {
    if (!currentTimestamp) return [];
    const sim = drift.find((d) => d.simulation_type === "HINDCAST");
    if (!sim) return [];
    return sim.particles
      .filter(
        (p) =>
          p.timestamp &&
          Math.abs(new Date(p.timestamp).getTime() - currentTimestamp) <=
            DRIFT_TIME_WINDOW,
      )
      .map((p) => ({
        position: [p.lon, p.lat] as [number, number],
        ts: p.timestamp,
      }));
  }, [drift, currentTimestamp]);

  const forecastParticles = useMemo(() => {
    if (!currentTimestamp) return [];
    const sim = drift.find((d) => d.simulation_type === "FORECAST");
    if (!sim) return [];
    return sim.particles
      .filter(
        (p) =>
          p.timestamp &&
          Math.abs(new Date(p.timestamp).getTime() - currentTimestamp) <=
            DRIFT_TIME_WINDOW,
      )
      .map((p) => ({
        position: [p.lon, p.lat] as [number, number],
        ts: p.timestamp,
      }));
  }, [drift, currentTimestamp]);

  const ENV_TIME_WINDOW = 3 * 60 * 60 * 1000;

  const windArrows = useMemo((): ArrowData[] => {
    if (!currentTimestamp) return [];
    const arrows: ArrowData[] = [];
    for (const w of weather) {
      if (!w.timestamp || !w.location_wkt) continue;
      if (
        Math.abs(new Date(w.timestamp).getTime() - currentTimestamp) >
        ENV_TIME_WINDOW
      )
        continue;
      const f = wktToGeoJSON(w.location_wkt);
      if (!f || f.geometry.type !== "Point") continue;
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
      if (
        Math.abs(new Date(c.timestamp).getTime() - currentTimestamp) >
        ENV_TIME_WINDOW
      )
        continue;
      const f = wktToGeoJSON(c.location_wkt);
      if (!f || f.geometry.type !== "Point") continue;
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const end = bearingOffset(lon, lat, c.direction_deg ?? 0, 0.12);
      arrows.push({ start: [lon, lat], end, magnitude: c.speed_ms ?? 0 });
    }
    return arrows;
  }, [currents, currentTimestamp]);

  // ── Interaction ───────────────────────────────────────────────────────────

  const makeHoverHandler = useCallback(
    (layerType: string) => (info: any) => {
      if (info.coordinate) setCursorCoord(info.coordinate);
      if (info.object) {
        setHoverInfo({ x: info.x, y: info.y, object: info.object, layerType });
      } else {
        setHoverInfo(null);
      }
    },
    [],
  );

  const onVesselClick = useCallback(
    (info: any) => {
      if (info.object) {
        const vid = info.object.vessel_id;
        setSelectedVessel(vid === selectedVesselId ? null : vid);
      }
    },
    [selectedVesselId, setSelectedVessel],
  );

  // ── Layer Definitions ─────────────────────────────────────────────────────

  // ── Spill Centroids & High-Contrast Visual Layers ─────────────────────────
  const spillCentroids = useMemo(() => {
    if (!spills.length) return [];
    return spills.map((s) => {
      let lon = 65.500;
      let lat = 15.590;
      const obs = satelliteAnalysis?.observations?.find(
        (o) => o.id === s.observation_id || o.spill_id === s.id
      );
      if (obs && obs.centroid_lon != null && obs.centroid_lat != null) {
        lon = obs.centroid_lon;
        lat = obs.centroid_lat;
      } else {
        const feat = wktToGeoJSON(s.geometry_wkt);
        if (feat && feat.geometry && (feat.geometry as any).coordinates) {
          const polyCoords = (feat.geometry as any).coordinates[0];
          if (Array.isArray(polyCoords) && polyCoords.length > 0) {
            const sum = polyCoords.reduce(
              (acc: [number, number], curr: [number, number]) => [acc[0] + curr[0], acc[1] + curr[1]],
              [0, 0]
            );
            lon = sum[0] / polyCoords.length;
            lat = sum[1] / polyCoords.length;
          }
        }
      }
      return {
        id: s.id,
        observation_id: s.observation_id,
        area_km2: s.area_km2 || 18.6,
        severity: s.estimated_severity || "CRITICAL",
        position: [lon, lat] as [number, number],
        isSelected: s.observation_id === selectedObservationId,
      };
    });
  }, [spills, satelliteAnalysis, selectedObservationId]);

  const spillLayers = useMemo(() => {
    if (!visibleLayers.spill || !spills.length) return [];
    const features = spills
      .map((s) => {
        const isSelected = s.observation_id === selectedObservationId;
        return wktToGeoJSON(s.geometry_wkt, {
          _type: "spill",
          spill_id: s.id,
          observation_id: s.observation_id,
          area_km2: s.area_km2,
          confidence: s.confidence,
          severity: s.estimated_severity,
          detection_method: s.detection_method,
          oil_probability: s.oil_probability,
          is_selected: isSelected,
        });
      })
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    if (!features.length) return [];

    return [
      // 1. Outer radiant glow halo (unmistakable boundary against deep ocean)
      new GeoJsonLayer({
        id: "spills-glow-layer",
        data: { type: "FeatureCollection", features },
        stroked: true,
        filled: false,
        getLineColor: [244, 63, 94, 90],
        lineWidthMinPixels: 7,
        pickable: false,
      }),
      // 2. High-contrast translucent crimson oil slick with crisp neon hazard boundary
      new GeoJsonLayer({
        id: "spills-layer",
        data: { type: "FeatureCollection", features },
        pickable: true,
        stroked: true,
        filled: true,
        getFillColor: (d: any) =>
          d.properties?.is_selected ? [239, 68, 68, 220] : [225, 29, 72, 175],
        getLineColor: (d: any) =>
          d.properties?.is_selected ? [255, 255, 255, 255] : [255, 99, 132, 255],
        lineWidthMinPixels: 3.5,
        getLineWidth: (d: any) => (d.properties?.is_selected ? 4 : 3),
        updateTriggers: {
          getFillColor: [selectedObservationId],
          getLineColor: [selectedObservationId],
          getLineWidth: [selectedObservationId],
        },
        onHover: makeHoverHandler("spill"),
      }),
      // 3. Pulsing centroid target pin
      new ScatterplotLayer({
        id: "spills-centroid-pin",
        data: spillCentroids,
        getPosition: (d: any) => d.position,
        getFillColor: (d: any) => d.isSelected ? [255, 255, 255, 255] : [239, 68, 68, 240],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 450,
        radiusMinPixels: 6,
        radiusMaxPixels: 10,
        pickable: false,
      }),
    ];
  }, [spills, selectedObservationId, visibleLayers.spill, makeHoverHandler, spillCentroids]);

  // High-visibility on-map Spill Metric Badge (immediate SIH visibility)
  const spillCalloutLayer = useMemo(() => {
    if (!visibleLayers.spill || !spillCentroids.length) return null;
    return new TextLayer({
      id: "spill-callout-badge",
      data: spillCentroids,
      getPosition: (d: any) => [d.position[0], d.position[1] + 0.06],
      getText: (d: any) => `▲ OIL SPILL: ${Number(d.area_km2).toFixed(1)} km² [${d.severity}]`,
      getSize: 12.5,
      getColor: [254, 202, 202, 255],
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontWeight: 700,
      sizeUnits: "pixels",
      background: true,
      getBackgroundColor: [15, 23, 42, 235],
      backgroundPadding: [8, 4],
      characterSet: "auto",
      updateTriggers: {
        getText: [selectedObservationId],
      },
    });
  }, [spillCentroids, visibleLayers.spill, selectedObservationId]);

  // Phase 11: Satellite Footprint Bounding Boxes
  const satelliteFootprintLayer = useMemo(() => {
    if (!satelliteAnalysis?.observations?.length) return null;
    const features = satelliteAnalysis.observations
      .map((obs) => {
        if (!obs.bounds_wkt) return null;
        const isSelected = obs.id === selectedObservationId;
        return wktToGeoJSON(obs.bounds_wkt, {
          _type: "satellite_footprint",
          id: obs.id,
          platform: obs.platform,
          sensor: obs.sensor,
          acquisition_time: obs.acquisition_time,
          is_selected: isSelected,
          data_provenance: obs.data_provenance,
        });
      })
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    if (!features.length) return null;

    return new GeoJsonLayer({
      id: "satellite-footprints",
      data: { type: "FeatureCollection", features },
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (d: any) =>
        d.properties?.is_selected ? [56, 189, 248, 24] : [56, 189, 248, 6],
      getLineColor: (d: any) =>
        d.properties?.is_selected ? [56, 189, 248, 240] : [100, 116, 139, 85],
      getLineWidth: (d: any) => (d.properties?.is_selected ? 2 : 1),
      lineWidthMinPixels: 1.5,
      updateTriggers: {
        getFillColor: [selectedObservationId],
        getLineColor: [selectedObservationId],
        getLineWidth: [selectedObservationId],
      },
      onHover: makeHoverHandler("satellite_footprint"),
    });
  }, [satelliteAnalysis, selectedObservationId, makeHoverHandler]);

  // Phase 11: Spill Centroid Displacement Trajectory & Observation Pins
  const spillCentroidEvolutionLayer = useMemo(() => {
    if (!satelliteAnalysis?.observations?.length) return null;

    const validCentroids = satelliteAnalysis.observations
      .filter((o) => o.centroid_lat != null && o.centroid_lon != null)
      .map((o) => ({
        id: o.id,
        platform: o.platform,
        area: o.stored_area_km2 || o.calculated_area_km2,
        time: o.acquisition_time,
        position: [o.centroid_lon!, o.centroid_lat!] as [number, number],
        is_selected: o.id === selectedObservationId,
      }));

    if (!validCentroids.length) return null;

    const pathCoords = validCentroids.map((c) => c.position);
    const layers: any[] = [];

    if (pathCoords.length >= 2) {
      layers.push(
        new PathLayer({
          id: "spill-centroid-trajectory",
          data: [{ path: pathCoords }],
          getPath: (d: any) => d.path,
          getColor: [251, 146, 60, 220],
          getWidth: 2.5,
          widthMinPixels: 2,
          pickable: false,
        })
      );
    }

    layers.push(
      new ScatterplotLayer({
        id: "spill-centroids-points",
        data: validCentroids,
        getPosition: (d: any) => d.position,
        getFillColor: (d: any) =>
          d.is_selected ? [255, 255, 255, 255] : [251, 146, 60, 240],
        getLineColor: (d: any) =>
          d.is_selected ? [244, 63, 94, 255] : [15, 23, 42, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: (d: any) => (d.is_selected ? 700 : 400),
        radiusMinPixels: 5,
        radiusMaxPixels: 12,
        pickable: true,
        updateTriggers: {
          getFillColor: [selectedObservationId],
          getRadius: [selectedObservationId],
        },
        onHover: makeHoverHandler("spill_centroid"),
      })
    );

    return layers;
  }, [satelliteAnalysis, selectedObservationId, makeHoverHandler]);

  const originLayer = useMemo(() => {
    if (!visibleLayers.origin || !origin?.ellipse_wkt) return null;
    const feature = wktToGeoJSON(origin.ellipse_wkt, {
      _type: "origin",
      probability: origin.probability,
      uncertainty_radius_km: origin.uncertainty_radius_km,
      time_window_start: origin.time_window_start,
      time_window_end: origin.time_window_end,
      forward_validation_distance_km: origin.forward_validation_distance_km,
      spatial_overlap_pct: origin.spatial_overlap_pct,
    });
    if (!feature) return null;
    return new GeoJsonLayer({
      id: "origin-layer",
      data: { type: "FeatureCollection", features: [feature] },
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: [16, 185, 129, 65],
      getLineColor: [16, 185, 129, 240],
      lineWidthMinPixels: 2.5,
      onHover: makeHoverHandler("origin"),
    });
  }, [origin, visibleLayers.origin, makeHoverHandler]);

  const originCalloutLayer = useMemo(() => {
    if (!visibleLayers.origin || !origin || origin.center_lon == null || origin.center_lat == null) return null;
    return new TextLayer({
      id: "origin-callout-badge",
      data: [{
        position: [origin.center_lon, origin.center_lat - 0.05] as [number, number],
        radius: origin.uncertainty_radius_km || 8.4,
      }],
      getPosition: (d: any) => d.position,
      getText: (d: any) => `⦿ ESTIMATED ORIGIN (±${Number(d.radius).toFixed(1)} km)`,
      getSize: 11.5,
      getColor: [167, 243, 208, 255],
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontWeight: 700,
      sizeUnits: "pixels",
      background: true,
      getBackgroundColor: [6, 78, 59, 230],
      backgroundPadding: [6, 3],
      characterSet: "auto",
    });
  }, [origin, visibleLayers.origin]);

  const forecastZoneLayer = useMemo(() => {
    if (!visibleLayers.forecast || !forecast?.affected_zone_wkt) return null;
    const geometry = parse(forecast.affected_zone_wkt);
    if (!geometry) return null;
    return new GeoJsonLayer({
      id: "forecast-zone",
      data: {
        type: "Feature",
        geometry,
        properties: {
          _type: "forecast",
          confidence: forecast.confidence,
          uncertainty_radius_km: forecast.uncertainty_radius_km,
          forecast_time: forecast.forecast_time,
        },
      },
      filled: true,
      stroked: true,
      getFillColor: [56, 189, 248, 35],
      getLineColor: [56, 189, 248, 180],
      lineWidthMinPixels: 2,
      pickable: true,
      onHover: makeHoverHandler("forecast"),
    });
  }, [forecast, visibleLayers.forecast, makeHoverHandler]);

  const observedTracksLayer = useMemo(() => {
    const observed = trackSegments.filter(
      (s) =>
        !s.is_reconstructed &&
        (visibleLayers.tracks || s.vessel_id === selectedVesselId),
    );
    if (!observed.length) return null;
    return new PathLayer<TrackSegment>({
      id: "tracks-observed",
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
      widthUnits: "pixels",
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
    const recs = trackSegments.filter(
      (s) =>
        s.is_reconstructed &&
        (visibleLayers.tracks || s.vessel_id === selectedVesselId),
    );
    if (!recs.length) return null;
    return new PathLayer<TrackSegment>({
      id: "tracks-reconstructed",
      data: recs,
      getPath: (d) => d.path,
      getColor: (d) =>
        d.vessel_id === selectedVesselId
          ? [251, 191, 36, 255]
          : [251, 191, 36, 60],
      getWidth: 2,
      widthUnits: "pixels",
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
    const pts: { position: [number, number]; vessel_id: string }[] = [];
    for (const track of tracks) {
      if (!visibleLayers.tracks && track.vessel_id !== selectedVesselId)
        continue;
      for (const p of track.points) {
        if (!p.is_reconstructed || !p.timestamp) continue;
        if (Math.abs(new Date(p.timestamp).getTime() - currentTimestamp) > WIN)
          continue;
        pts.push({ position: [p.lon, p.lat], vessel_id: track.vessel_id });
      }
    }
    if (!pts.length) return null;
    return new ScatterplotLayer({
      id: "reconstructed-ais-dots",
      data: pts,
      getPosition: (d: any) => d.position,
      getFillColor: (d: any) =>
        d.vessel_id === selectedVesselId
          ? [251, 191, 36, 255]
          : [251, 191, 36, 120],
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
      id: "hindcast-particles",
      data: hindcastParticles,
      getPosition: (d: any) => d.position,
      getFillColor: [245, 158, 11, 120],
      getRadius: 400,
      radiusMinPixels: 2,
      radiusMaxPixels: 5,
      pickable: true,
      onHover: makeHoverHandler("hindcast"),
    });
  }, [hindcastParticles, visibleLayers.hindcast, makeHoverHandler]);

  const forecastParticlesLayer = useMemo(() => {
    if (!visibleLayers.forecast || !forecastParticles.length) return null;
    return new ScatterplotLayer({
      id: "forecast-particles",
      data: forecastParticles,
      getPosition: (d: any) => d.position,
      getFillColor: [34, 211, 238, 120],
      getRadius: 400,
      radiusMinPixels: 2,
      radiusMaxPixels: 5,
      pickable: true,
      onHover: makeHoverHandler("forecast_particle"),
    });
  }, [forecastParticles, visibleLayers.forecast, makeHoverHandler]);

  const windLayer = useMemo(() => {
    if (!visibleLayers.wind || !windArrows.length) return null;
    return new LineLayer({
      id: "wind-vectors",
      data: windArrows,
      getSourcePosition: (d: ArrowData) => d.start,
      getTargetPosition: (d: ArrowData) => d.end,
      getColor: (d: ArrowData) =>
        [100, 180, 255, Math.min(220, 80 + d.magnitude * 18)] as [
          number,
          number,
          number,
          number,
        ],
      getWidth: 2,
      widthUnits: "pixels",
      widthMinPixels: 1,
    });
  }, [windArrows, visibleLayers.wind]);

  const currentVectorLayer = useMemo(() => {
    if (!visibleLayers.current || !currentArrows.length) return null;
    return new LineLayer({
      id: "current-vectors",
      data: currentArrows,
      getSourcePosition: (d: ArrowData) => d.start,
      getTargetPosition: (d: ArrowData) => d.end,
      getColor: (d: ArrowData) =>
        [16, 185, 129, Math.min(220, 80 + d.magnitude * 600)] as [
          number,
          number,
          number,
          number,
        ],
      getWidth: 2,
      widthUnits: "pixels",
      widthMinPixels: 1,
    });
  }, [currentArrows, visibleLayers.current]);

  // Vessel heading-aware icon layer
  // mapMode in deps ensures a new layer instance is created on 2D<->3D switch,
  // preventing deck.gl from reusing a stale layer with wrong viewport projection.
  const vesselIconLayer = useMemo(() => {
    if (!visibleLayers.vessels || !activeVesselPoints.length) return null;
    // In 3D globe mode, IconLayer with billboard can have depth-fighting issues.
    // We use a ScatterplotLayer as a robust primary vessel indicator in 3D.
    if (mapMode === "3d") {
      return new ScatterplotLayer<ActiveVesselPoint>({
        id: "vessel-icons",
        data: activeVesselPoints,
        getPosition: (d) => d.position,
        getFillColor: (d) => {
          if (d.vessel_id === selectedVesselId) return [34, 211, 238, 255];
          if (selectedVesselId) return [120, 120, 140, 180];
          if (d.is_candidate) return [244, 63, 94, 255];
          return [160, 160, 185, 200];
        },
        getLineColor: (d) => {
          if (d.vessel_id === selectedVesselId) return [255, 255, 255, 255];
          if (d.is_candidate) return [255, 200, 200, 200];
          return [200, 200, 220, 120];
        },
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: (d) => (d.vessel_id === selectedVesselId ? 8000 : d.is_candidate ? 5000 : 3000),
        radiusMinPixels: 4,
        radiusMaxPixels: 20,
        pickable: true,
        onHover: makeHoverHandler("vessel"),
        onClick: onVesselClick,
        updateTriggers: {
          getFillColor: [selectedVesselId],
          getLineColor: [selectedVesselId],
          getRadius: [selectedVesselId],
        },
      });
    }
    return new IconLayer<ActiveVesselPoint>({
      id: "vessel-icons",
      data: activeVesselPoints,
      iconAtlas: ICON_ATLAS,
      iconMapping: ICON_MAPPING,
      getIcon: () => "ship",
      getPosition: (d) => d.position,
      getSize: (d) =>
        d.vessel_id === selectedVesselId ? 32 : d.is_candidate ? 20 : 10,
      getColor: (d) => {
        if (d.vessel_id === selectedVesselId) return [34, 211, 238, 255];
        if (selectedVesselId) return [100, 100, 110, 80];
        if (d.is_candidate) return [244, 63, 94, 255];
        return [160, 160, 185, 120];
      },
      getAngle: (d) => d.heading,
      billboard: true,
      sizeUnits: "pixels",
      pickable: true,
      onHover: makeHoverHandler("vessel"),
      onClick: onVesselClick,
      updateTriggers: {
        getSize: [selectedVesselId],
        getColor: [selectedVesselId],
      },
    });
  }, [
    activeVesselPoints,
    visibleLayers.vessels,
    selectedVesselId,
    mapMode,
    makeHoverHandler,
    onVesselClick,
  ]);

  // Selection ring around selected vessel
  const selectedRingLayer = useMemo(() => {
    if (!selectedVesselId || !activeVesselPoints.length) return null;
    const selPt = activeVesselPoints.find(
      (p) => p.vessel_id === selectedVesselId,
    );
    if (!selPt) return null;
    return new ScatterplotLayer({
      id: "selected-vessel-ring",
      data: [selPt],
      getPosition: (d: any) => d.position,
      getFillColor: [0, 0, 0, 0],
      getLineColor: [34, 211, 238, 255],
      stroked: true,
      filled: false,
      lineWidthMinPixels: 2,
      getRadius: 5000,
      radiusMinPixels: 20,
      radiusMaxPixels: 38,
    });
  }, [activeVesselPoints, selectedVesselId]);

  // Closest Point of Approach (CPA) Indicator Layer
  const cpaIndicatorLayer = useMemo(() => {
    if (!selectedVesselId || !origin) return null;
    const intel = vesselIntelligence[selectedVesselId];
    const prox = intel?.proximity;
    if (!prox || prox.closest_approach_lat == null || prox.closest_approach_lon == null) return null;

    const cpaPos: [number, number] = [prox.closest_approach_lon, prox.closest_approach_lat];
    const originPos: [number, number] = [origin.center_lon, origin.center_lat];

    return [
      new LineLayer({
        id: "cpa-line",
        data: [{ source: originPos, target: cpaPos, dist: prox.min_distance_km }],
        getSourcePosition: (d: any) => d.source,
        getTargetPosition: (d: any) => d.target,
        getColor: [244, 63, 94, 200],
        getWidth: 2,
        widthUnits: "pixels",
      }),
      new ScatterplotLayer({
        id: "cpa-marker",
        data: [{
          position: cpaPos,
          dist: prox.min_distance_km,
          time: prox.closest_approach_time,
          _type: "cpa"
        }],
        getPosition: (d: any) => d.position,
        getFillColor: [244, 63, 94, 220],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 600,
        radiusMinPixels: 6,
        radiusMaxPixels: 10,
        pickable: true,
        onHover: makeHoverHandler("cpa"),
      })
    ];
  }, [selectedVesselId, origin, vesselIntelligence, makeHoverHandler]);

  // Trajectory & Behaviour Events Layer (Phase 8 deterministic events + kinematic alerts)
  const trajectoryEventsLayer = useMemo(() => {
    if (!selectedVesselId) return null;
    const intel = vesselIntelligence[selectedVesselId];
    const beh = vesselBehaviours[selectedVesselId];

    const combined: any[] = [];

    // Phase 8 deterministic behaviour events
    if (beh?.behaviour_events?.length) {
      for (const e of beh.behaviour_events) {
        if (e.longitude != null && e.latitude != null) {
          combined.push({
            position: [e.longitude, e.latitude] as [number, number],
            ...e,
            explanation: e.description,
            _type: "trajectory_event",
          });
        }
      }
    }

    // Existing intelligence events (deduplicated)
    if (intel?.events?.length) {
      for (const e of intel.events) {
        if (e.lon != null && e.lat != null) {
          const exists = combined.some(
            (c) =>
              c.event_type === e.event_type &&
              Math.abs(c.position[0] - e.lon) < 0.01 &&
              Math.abs(c.position[1] - e.lat) < 0.01
          );
          if (!exists) {
            combined.push({
              position: [e.lon, e.lat] as [number, number],
              ...e,
              _type: "trajectory_event",
            });
          }
        }
      }
    }

    if (!combined.length) return null;

    return new ScatterplotLayer({
      id: "trajectory-events-layer",
      data: combined,
      getPosition: (d: any) => d.position,
      getFillColor: (d: any) => {
        if (d.event_type === "SPEED_DROP" || d.event_type === "STATIONARY_PERIOD" || d.event_type === "SUDDEN_STOP")
          return [244, 63, 94, 230];
        if (d.event_type === "SHARP_TURN" || d.event_type === "LOITERING")
          return [245, 158, 11, 230];
        if (d.event_type === "SPILL_ZONE_ENTRY" || d.event_type === "SPILL_ZONE_EXIT")
          return [168, 85, 247, 230];
        if (d.event_type === "CLOSE_APPROACH")
          return [34, 211, 238, 230];
        return [56, 189, 248, 230];
      },
      getLineColor: (d: any) => {
        const isSelected =
          selectedBehaviourEvent?.id === d.id ||
          (selectedBehaviourEvent?.timestamp === d.timestamp &&
            selectedBehaviourEvent?.event_type === d.event_type);
        return isSelected ? [255, 255, 255, 255] : [255, 255, 255, 160];
      },
      stroked: true,
      lineWidthMinPixels: 2,
      getRadius: (d: any) => {
        const isSelected =
          selectedBehaviourEvent?.id === d.id ||
          (selectedBehaviourEvent?.timestamp === d.timestamp &&
            selectedBehaviourEvent?.event_type === d.event_type);
        return isSelected ? 800 : 450;
      },
      radiusMinPixels: 6,
      radiusMaxPixels: 12,
      pickable: true,
      onClick: (info: any) => {
        if (info.object) {
          selectBehaviourEvent(info.object);
        }
      },
      onHover: makeHoverHandler("trajectory_event"),
      updateTriggers: {
        getRadius: [selectedBehaviourEvent],
        getLineColor: [selectedBehaviourEvent],
      },
    });
  }, [selectedVesselId, vesselIntelligence, vesselBehaviours, selectedBehaviourEvent, selectBehaviourEvent, makeHoverHandler]);

  // Highlight layer for the selected behaviour event
  const behaviourHighlightLayer = useMemo(() => {
    if (
      !selectedBehaviourEvent ||
      selectedBehaviourEvent.longitude == null ||
      selectedBehaviourEvent.latitude == null
    ) {
      return null;
    }
    const pos = [selectedBehaviourEvent.longitude, selectedBehaviourEvent.latitude] as [number, number];
    return [
      new ScatterplotLayer({
        id: "behaviour-selected-glow",
        data: [{ position: pos }],
        getPosition: (d: any) => d.position,
        getFillColor: [56, 189, 248, 40],
        getLineColor: [56, 189, 248, 220],
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 1800,
        radiusMinPixels: 16,
        radiusMaxPixels: 28,
        pickable: false,
      }),
      new ScatterplotLayer({
        id: "behaviour-selected-pin",
        data: [{ position: pos }],
        getPosition: (d: any) => d.position,
        getFillColor: [255, 255, 255, 255],
        getLineColor: [244, 63, 94, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 500,
        radiusMinPixels: 5,
        radiusMaxPixels: 9,
        pickable: false,
      }),
    ];
  }, [selectedBehaviourEvent]);

  // Phase 10: Selected Timeline Event Highlight Layer
  const timelineHighlightLayer = useMemo(() => {
    if (!selectedTimelineEventId || !timelineEvents.length) return null;
    const ev = timelineEvents.find((e) => e.event_id === selectedTimelineEventId);
    if (!ev || ev.latitude == null || ev.longitude == null) return null;
    const pos: [number, number] = [ev.longitude, ev.latitude];

    return [
      new ScatterplotLayer({
        id: "timeline-selected-pulse",
        data: [{ position: pos }],
        getPosition: (d: any) => d.position,
        getFillColor: [56, 189, 248, 40],
        getLineColor: [56, 189, 248, 255],
        filled: true,
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 3000,
        radiusMinPixels: 18,
        radiusMaxPixels: 34,
        pickable: false,
      }),
      new ScatterplotLayer({
        id: "timeline-selected-pin",
        data: [{ position: pos, ...ev }],
        getPosition: (d: any) => d.position,
        getFillColor: [56, 189, 248, 255],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        filled: true,
        lineWidthMinPixels: 2,
        getRadius: 800,
        radiusMinPixels: 6,
        radiusMaxPixels: 12,
        pickable: true,
        onHover: makeHoverHandler("timeline_event"),
      }),
    ];
  }, [selectedTimelineEventId, timelineEvents, makeHoverHandler]);

  const graticuleLayer = useMemo(() => {
    const paths = [];
    for (let lat = -80; lat <= 80; lat += 20) {
      const path = [];
      for (let lon = -180; lon <= 180; lon += 10) path.push([lon, lat]);
      paths.push(path);
    }
    for (let lon = -180; lon < 180; lon += 20) {
      const path = [];
      for (let lat = -80; lat <= 80; lat += 10) path.push([lon, lat]);
      paths.push(path);
    }
    return new PathLayer({
      id: 'graticule',
      data: paths,
      getPath: (d) => d,
      getColor: [255, 255, 255, 12],
      getWidth: 1,
      widthMinPixels: 1,
    });
  }, []);

  // ── 3D Globe: Ocean sphere (deep navy base fill) ───────────────────────────
  const globeOceanSphere = useMemo(() => {
    if (mapMode !== "3d") return null;
    const WORLD_POLYGON = [
      [-180, -85.051], [180, -85.051], [180, 85.051], [-180, 85.051], [-180, -85.051],
    ];
    return new SolidPolygonLayer({
      id: "globe-ocean-sphere",
      data: [{ polygon: WORLD_POLYGON }],
      getPolygon: (d: any) => d.polygon,
      getFillColor: COLORS.oceanRGBA,
      filled: true,
    });
  }, [mapMode]);

  // ── Geographic Data state for labels (Deck.gl TextLayer for guaranteed 2D+3D rendering) ──
  const [geoLabels, setGeoLabels] = useState<{ countries: any[]; oceans: any[] }>({
    countries: [],
    oceans: [],
  });

  useEffect(() => {
    Promise.all([
      fetch("/data/geography/natural-earth/country_label_points.geojson").then((r) => r.json()),
      fetch("/data/geography/natural-earth/ocean_labels.geojson").then((r) => r.json()),
    ])
      .then(([c, o]) => {
        setGeoLabels({
          countries: (c.features || []).map((f: any) => ({
            ...f.properties,
            position: f.geometry?.coordinates || [f.properties.longitude, f.properties.latitude],
          })),
          oceans: (o.features || []).map((f: any) => ({
            ...f.properties,
            position: f.geometry?.coordinates || [f.properties.longitude, f.properties.latitude],
          })),
        });
      })
      .catch((err) => console.warn("Could not load geographic labels GeoJSON:", err));
  }, []);

  const globeLandLayer = useMemo(() => {
    if (mapMode !== "3d") return null;
    return new GeoJsonLayer({
      id: "globe-land",
      data: '/data/geography/natural-earth/ne_110m_admin_0_countries.geojson',
      filled: true,
      stroked: true,
      getFillColor: COLORS.landRGBA,
      getLineColor: COLORS.borderRGBA,
      lineWidthMinPixels: 1,
      getLineWidth: 1,
    });
  }, [mapMode]);

  const globeCoastlineLayer = useMemo(() => {
    if (mapMode !== "3d") return null;
    return new GeoJsonLayer({
      id: "globe-coastlines",
      data: '/data/geography/natural-earth/ne_110m_coastline.geojson',
      filled: false,
      stroked: true,
      getLineColor: COLORS.coastlineRGBA,
      lineWidthMinPixels: 2.2,
      getLineWidth: 2.2,
    });
  }, [mapMode]);

  const countryLabelLayer = useMemo(() => {
    if (!geoLabels.countries.length) return null;
    const zoom = viewState?.zoom ?? defaultViewState.zoom;
    if (zoom < 2.0) return null;

    const visible = geoLabels.countries.filter((c: any) => {
      const minZ = c.minZoom ?? 2;
      const maxZ = c.maxZoom ?? 14;
      return zoom >= minZ && zoom <= maxZ;
    });

    if (!visible.length) return null;

    return new TextLayer({
      id: "maritime-country-labels",
      data: visible,
      getPosition: (d: any) => d.position || [d.longitude, d.latitude],
      getText: (d: any) => d.name,
      getSize: () => (zoom < 4 ? 10.5 : zoom > 7 ? 13.5 : 12),
      getColor: [248, 250, 252, 240], // Crisp high-contrast white #f8fafc
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontWeight: 700,
      sizeUnits: "pixels",
      background: true,
      getBackgroundColor: [15, 23, 42, 210], // Solid dark halo
      backgroundPadding: [5, 2.5],
      characterSet: "auto",
      updateTriggers: {
        getSize: [zoom],
      },
    });
  }, [viewState?.zoom, defaultViewState.zoom, geoLabels.countries]);

  const oceanLabelLayer = useMemo(() => {
    if (!geoLabels.oceans.length) return null;
    const zoom = viewState?.zoom ?? defaultViewState.zoom;

    const visible = geoLabels.oceans.filter((o: any) => {
      const minZ = o.minZoom ?? 0;
      const maxZ = o.maxZoom ?? 14;
      return zoom >= minZ && zoom <= maxZ;
    });
    if (!visible.length) return null;

    return new TextLayer({
      id: "maritime-ocean-labels",
      data: visible,
      getPosition: (d: any) => d.position || [d.longitude, d.latitude],
      getText: (d: any) => formatCartographicLabel(d.name, d.category),
      getSize: (d: any) => {
        const base = d.fontSize || 15;
        if (d.category === "ocean") {
          return zoom < 4 ? base + 4 : zoom > 8 ? base - 2 : base;
        }
        if (d.category === "sea") {
          return zoom < 4 ? base - 2 : zoom > 8 ? base + 2 : base;
        }
        return base;
      },
      getColor: (d: any) => {
        if (d.category === "ocean") {
          return [147, 197, 253, 230]; // Crisp ice blue #93c5fd
        }
        if (d.category === "sea") {
          return [186, 230, 253, 245]; // Bright light sky blue #bae6fd
        }
        return [224, 242, 254, 230]; // Soft cyan #e0f2fe
      },
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontWeight: 700,
      sizeUnits: "pixels",
      background: true,
      getBackgroundColor: [9, 26, 42, 160], // Dark navy halo for contrast
      backgroundPadding: [6, 3],
      characterSet: "auto",
      updateTriggers: {
        getSize: [zoom],
        getColor: [zoom],
      },
    });
  }, [viewState?.zoom, defaultViewState.zoom, geoLabels.oceans]);

  const vesselLabelLayer = useMemo(() => {
    if (!visibleLayers.vessels || !activeVesselPoints.length) return null;
    const zoom = viewState?.zoom ?? 0;
    // In 3D globe, always show candidate + selected labels to aid identification
    const labels = activeVesselPoints.filter(v => 
      v.vessel_id === selectedVesselId ||
      (v.is_candidate && (mapMode === "3d" || zoom > 5)) ||
      (zoom > 8.5)
    );
    if (!labels.length) return null;

    return new TextLayer({
      id: "vessel-labels",
      data: labels,
      getPosition: (d) => d.position,
      getText: (d) => d.name,
      getSize: (d) => d.vessel_id === selectedVesselId ? 13 : (d.is_candidate ? 12 : 10),
      getColor: (d) => d.vessel_id === selectedVesselId ? [34, 211, 238, 255] : (d.is_candidate ? [244, 63, 94, 220] : [160, 160, 185, 160]),
      getPixelOffset: [0, mapMode === "3d" ? 18 : 24],
      fontFamily: "'Inter', monospace",
      fontWeight: 'bold',
      background: true,
      getBackgroundColor: [9, 9, 11, 220],
      backgroundPadding: [4, 2],
      sizeUnits: "pixels",
      updateTriggers: {
        getSize: [selectedVesselId, mapMode],
        getColor: [selectedVesselId],
        getPixelOffset: [mapMode],
      }
    });
  }, [activeVesselPoints, visibleLayers.vessels, selectedVesselId, viewState?.zoom, mapMode]);

  // ── Layer Hierarchy (bottom to top): ────────────────────────────────────────
  // 1. Globe ocean sphere + basemap (3D only)
  // 2. Lat/Lon graticule grid
  // 3. Ocean text labels + Country labels
  // 4. Satellite footprints
  // 5. OIL SPILL (high priority — glow halo, fill, centroid, callout)
  // 6. Origin + uncertainty + callout
  // 7. Drift / Forecast
  // 8. Environmental vectors
  // 9. AIS tracks
  // 10. Vessel icons + labels
  // 11. Behaviour / Timeline highlights
  const allLayers = [
    // — Base Globe / Land-Ocean (3D only, null in 2D) —
    globeOceanSphere,
    globeLandLayer,
    globeCoastlineLayer,
    // — Grid & Geographic Labels —
    graticuleLayer,
    oceanLabelLayer,
    countryLabelLayer,
    // — Satellite Footprints —
    satelliteFootprintLayer,
    // — OIL SPILL (highest visual priority among investigation layers) —
    ...spillLayers,
    spillCalloutLayer,
    ...(spillCentroidEvolutionLayer || []),
    // — Origin & Uncertainty —
    originLayer,
    originCalloutLayer,
    // — Forecast Zone / Drift —
    forecastZoneLayer,
    hindcastLayer,
    forecastParticlesLayer,
    // — Environmental Vectors —
    windLayer,
    currentVectorLayer,
    // — Tracks (normal vessels low, then candidate/selected) —
    observedTracksLayer,
    reconstructedTracksLayer,
    reconstructedDotsLayer,
    // — Vessel Icons & Labels —
    vesselIconLayer,
    vesselLabelLayer,
    selectedRingLayer,
    // — Phase 7 & 8: Closest Approach & Trajectory Events —
    ...(cpaIndicatorLayer || []),
    trajectoryEventsLayer,
    ...(behaviourHighlightLayer || []),
    // — Phase 10: Selected Timeline Event Highlight —
    ...(timelineHighlightLayer || []),
  ].filter(Boolean);

  // ── Tooltip ───────────────────────────────────────────────────────────────

  const renderTooltip = () => {
    if (!hoverInfo?.object) return null;
    const { x, y, object: obj, layerType } = hoverInfo;
    const p = obj.properties ?? obj;

    const wrap: React.CSSProperties = {
      position: "fixed",
      left: Math.min(x + 14, window.innerWidth - 260),
      top: Math.max(y - 10, 4),
      zIndex: 9999,
      background: "rgba(9,9,11,0.95)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "8px",
      padding: "12px 14px",
      fontSize: "12px",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#e4e4e7",
      maxWidth: "250px",
      pointerEvents: "none",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    };

    const TT = ({
      label,
      v,
      accent,
    }: {
      label: string;
      v: any;
      accent?: string;
    }) => (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "14px",
          marginBottom: "4px",
        }}
      >
        <span style={{ color: "#71717a", fontSize: "11px" }}>{label}</span>
        <span
          style={{
            color: accent ?? "#d4d4d8",
            fontFamily: "monospace",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          {v ?? "—"}
        </span>
      </div>
    );
    const Sep = () => (
      <div
        style={{
          height: "1px",
          background: "rgba(255,255,255,0.07)",
          margin: "6px 0",
        }}
      />
    );

    if (layerType === "spill")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#71717a",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            OIL SPILL DETECTION
          </div>
          <Sep />
          <TT label="Area" v={`${(p.area_km2 ?? 0).toFixed(2)} km²`} />
          <TT
            label="Detection Confidence"
            v={`${((p.confidence ?? 0) * 100).toFixed(1)}%`}
            accent="#34d399"
          />
          <TT
            label="Severity"
            v={p.severity}
            accent={p.severity === "HIGH" ? "#f87171" : undefined}
          />
          <TT
            label="Oil Probability"
            v={`${((p.oil_probability ?? 0) * 100).toFixed(1)}%`}
          />
          <TT label="Detection Method" v={p.detection_method} />
          <Sep />
          <div
            style={{ fontSize: "9px", color: "#fbbf24", fontFamily: "monospace" }}
          >
            PROVENANCE: DEMO / SYNTHETIC
          </div>
        </div>
      );

    if (layerType === "satellite_footprint")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#38bdf8",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            SATELLITE SENSOR FOOTPRINT
          </div>
          <Sep />
          <TT label="Platform" v={p.platform} accent="#38bdf8" />
          <TT label="Sensor" v={p.sensor} />
          <TT
            label="Acquisition"
            v={p.acquisition_time ? String(p.acquisition_time).replace("T", " ").substring(0, 16) + " UTC" : "—"}
          />
          <Sep />
          <div style={{ fontSize: "9px", color: "#fbbf24", fontFamily: "monospace" }}>
            PROVENANCE: {p.data_provenance || "DEMO / SYNTHETIC"}
          </div>
        </div>
      );

    if (layerType === "spill_centroid")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#fb923c",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            SPILL CENTROID OBSERVATION
          </div>
          <Sep />
          <TT label="Pass / Platform" v={p.platform} accent="#fb923c" />
          <TT label="Spill Area" v={p.area ? `${Number(p.area).toFixed(1)} km²` : "—"} />
          <TT
            label="Timestamp"
            v={p.time ? String(p.time).replace("T", " ").substring(0, 16) + " UTC" : "—"}
          />
          <Sep />
          <div style={{ fontSize: "9px", color: "#fbbf24", fontFamily: "monospace" }}>
            PROVENANCE: DEMO / SYNTHETIC
          </div>
        </div>
      );

    if (layerType === "cpa")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#f87171",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            CLOSEST APPROACH TO ORIGIN
          </div>
          <Sep />
          <TT
            label="Min Distance"
            v={`${(p.dist ?? 0).toFixed(2)} km`}
            accent="#f87171"
          />
          <TT
            label="Timestamp"
            v={
              p.time
                ? String(p.time).replace("T", " ").substring(0, 16) + " UTC"
                : "—"
            }
          />
        </div>
      );

    if (layerType === "trajectory_event")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#fbbf24",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            BEHAVIOUR EVENT: {String(p.event_type || "").replace(/_/g, " ")}
          </div>
          <Sep />
          <div
            style={{
              fontSize: "11px",
              color: "#e4e4e7",
              marginBottom: "6px",
              lineHeight: 1.3,
            }}
          >
            {p.description || p.explanation}
          </div>
          {p.measured_value != null && (
            <TT
              label="Measured Value"
              v={`${p.measured_value.toFixed(1)} ${p.unit ?? ""}`}
              accent="#38bdf8"
            />
          )}
          {p.threshold != null && (
            <TT
              label="Threshold"
              v={`${p.threshold.toFixed(1)} ${p.unit ?? ""}`}
            />
          )}
          {p.severity && (
            <TT
              label="Severity"
              v={p.severity}
              accent={p.severity === "HIGH" ? "#f87171" : p.severity === "MEDIUM" ? "#fbbf24" : "#38bdf8"}
            />
          )}
          <TT
            label="Timestamp"
            v={
              p.timestamp
                ? String(p.timestamp).replace("T", " ").substring(0, 16) + " UTC"
                : "—"
            }
          />
        </div>
      );

    if (layerType === "timeline_event")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#38bdf8",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            TIMELINE EVENT: {String(p.event_type || "").replace(/_/g, " ")}
          </div>
          <Sep />
          <TT
            label="Timestamp"
            v={
              p.timestamp
                ? String(p.timestamp).replace("T", " ").substring(0, 16) + " UTC"
                : "—"
            }
          />
          <TT label="Provenance" v={p.data_label || "OBSERVED"} accent="#38bdf8" />
          {p.vessel_name && <TT label="Vessel" v={p.vessel_name} />}
          <Sep />
          <div
            style={{
              fontSize: "11px",
              color: "#e4e4e7",
              lineHeight: 1.3,
            }}
          >
            {p.description}
          </div>
        </div>
      );

    if (layerType === "origin")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#71717a",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            PROBABLE ORIGIN ZONE
          </div>
          <Sep />
          <TT
            label="Origin Probability"
            v={`${((p.probability ?? 0) * 100).toFixed(1)}%`}
            accent="#34d399"
          />
          <TT
            label="Uncertainty Radius"
            v={`${(p.uncertainty_radius_km ?? 0).toFixed(1)} km`}
          />
          <TT
            label="Time Window Start"
            v={p.time_window_start?.substring(11, 16) + " UTC"}
          />
          <TT
            label="Time Window End"
            v={p.time_window_end?.substring(11, 16) + " UTC"}
          />
          <TT
            label="Validation Distance"
            v={
              p.forward_validation_distance_km
                ? `${p.forward_validation_distance_km.toFixed(1)} km`
                : "—"
            }
          />
          <TT
            label="Spatial Overlap"
            v={
              p.spatial_overlap_pct
                ? `${p.spatial_overlap_pct.toFixed(1)}%`
                : "—"
            }
          />
        </div>
      );

    if (layerType === "vessel")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#71717a",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            VESSEL
          </div>
          <div
            style={{
              fontWeight: 700,
              color: obj.is_candidate ? "#f87171" : "#e4e4e7",
              fontSize: "13px",
              marginBottom: "8px",
            }}
          >
            {obj.name}
          </div>
          <Sep />
          <TT label="Type" v={obj.vessel_type} />
          <TT label="Flag" v={obj.flag_state} />
          <TT label="Speed" v={`${(obj.speed ?? 0).toFixed(1)} kn`} />
          <TT label="Heading" v={`${(obj.heading ?? 0).toFixed(1)}°`} />
          <TT
            label="Position"
            v={`${(obj.position?.[1] ?? 0).toFixed(4)}°N ${(obj.position?.[0] ?? 0).toFixed(4)}°E`}
          />
          <TT
            label="AIS Timestamp"
            v={obj.timestamp ? obj.timestamp.substring(11, 16) + " UTC" : "—"}
          />
          <Sep />
          <TT
            label="AIS Status"
            v={obj.is_reconstructed ? "RECONSTRUCTED" : "OBSERVED"}
            accent={obj.is_reconstructed ? "#fbbf24" : "#34d399"}
          />
          {(obj.gap_duration_hrs ?? 0) > 0 && (
            <TT
              label="Gap Duration"
              v={`${obj.gap_duration_hrs.toFixed(1)} hrs`}
              accent="#fbbf24"
            />
          )}
          <TT
            label="Investigation Priority"
            v={obj.is_candidate ? "HIGH CANDIDATE" : "Normal"}
            accent={obj.is_candidate ? "#f87171" : undefined}
          />
          <Sep />
          <div style={{ fontSize: "9px", color: "#52525b" }}>
            Click to select • see full details
          </div>
        </div>
      );

    if (layerType === "hindcast")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#f59e0b",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            HINDCAST DRIFT PARTICLE
          </div>
          <TT
            label="Simulation Type"
            v="HINDCAST (Backward)"
            accent="#f59e0b"
          />
          <TT label="Method" v="Lagrangian Particle" />
          <TT
            label="Position"
            v={
              obj.position
                ? `${obj.position[1].toFixed(4)}°N ${obj.position[0].toFixed(4)}°E`
                : "—"
            }
          />
          <Sep />
          <div
            style={{ fontSize: "9px", color: "#3f3f46", fontStyle: "italic" }}
          >
            SIMULATED DEMO DATA
          </div>
        </div>
      );

    if (layerType === "forecast" || layerType === "forecast_particle")
      return (
        <div style={wrap}>
          <div
            style={{
              fontSize: "9px",
              color: "#38bdf8",
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            FORECAST DRIFT
          </div>
          <TT label="Simulation Type" v="FORECAST (Forward)" accent="#38bdf8" />
          {p.confidence != null && (
            <TT label="Confidence" v={`${(p.confidence * 100).toFixed(0)}%`} />
          )}
          {p.forecast_time && (
            <TT
              label="Target Time"
              v={p.forecast_time.substring(11, 16) + " UTC"}
            />
          )}
          <Sep />
          <div
            style={{ fontSize: "9px", color: "#3f3f46", fontStyle: "italic" }}
          >
            MODELLED DEMO DATA
          </div>
        </div>
      );

    return null;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading || viewState === null) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "3px solid rgba(34,211,238,0.2)",
            borderTop: "3px solid #22d3ee",
            borderRadius: "50%",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <div
          style={{
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#52525b",
            letterSpacing: "2px",
          }}
        >
          LOADING SPATIAL DATA...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const deckProps = {
    viewState,
    onViewStateChange: ({ viewState: vs }: any) => setViewState(vs),
    controller: true,
    layers: allLayers,
    onHover: (info: any) => {
      if (info.coordinate) setCursorCoord(info.coordinate);
      if (!info.object) setHoverInfo(null);
    },
    style: { position: "absolute" as const, inset: "0" },
  };

  const Compass = () => (
    <div style={{
      position: 'absolute',
      top: '14px',
      left: '14px',
      width: '44px',
      height: '44px',
      background: 'rgba(9,9,11,0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      pointerEvents: 'none',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      transform: `rotateX(${viewState?.pitch ?? 0}deg)`,
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        transform: `rotate(${-(viewState?.bearing ?? 0)}deg)`,
        transition: 'transform 0.1s ease-out'
      }}>
        <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', color: '#ef4444', fontSize: '10px', fontWeight: 'bold' }}>N</div>
        <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', color: '#a1a1aa', fontSize: '10px' }}>S</div>
        <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa', fontSize: '10px' }}>E</div>
        <div style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa', fontSize: '10px' }}>W</div>
      </div>
    </div>
  );

  const CoordinatesOverlay = () => {
    let lat = 0, lon = 0;
    if (hoverInfo && hoverInfo.object && (hoverInfo.layerType === "vessel" || hoverInfo.layerType === "hindcast" || hoverInfo.layerType === "forecast_particle")) {
      lon = hoverInfo.object.position?.[0] ?? 0;
      lat = hoverInfo.object.position?.[1] ?? 0;
    } else if (cursorCoord) {
      lon = cursorCoord[0];
      lat = cursorCoord[1];
    } else {
      return null;
    }
    
    return (
      <div style={{
        position: 'absolute',
        bottom: '80px', // Above timeline
        right: '14px',
        padding: '4px 8px',
        background: 'rgba(9,9,11,0.8)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#a1a1aa',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        {lat.toFixed(4)}°N {lon.toFixed(4)}°E
      </div>
    );
  };

  if (mapMode === "3d") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#0b132b",
        }}
      >
        <Compass />
        <CoordinatesOverlay />
        {/* key={mapMode} ensures DeckGL is unmounted/remounted on mode switch,
            preventing stale WebGL state and layer projection corruption */}
        <DeckGL key="globe-3d" {...deckProps} views={new GlobeView({ id: "globe", controller: true })}>
          {/* Globe renders on WebGL canvas directly, no MapLibre child */}
        </DeckGL>
        {renderTooltip()}
        {/* Globe mode indicator */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "3px 12px",
            background: "rgba(9,9,11,0.7)",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: "20px",
            fontSize: "10px",
            fontFamily: "monospace",
            color: "#22d3ee",
            letterSpacing: "1px",
            pointerEvents: "none",
            zIndex: 10
          }}
        >
          3D GLOBE MODE — DRAG TO ROTATE
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Compass />
      <CoordinatesOverlay />
      {/* key={mapMode} ensures DeckGL is remounted on mode switch, preventing
          WebGL canvas state corruption that causes vessels to disappear */}
      <DeckGL key="map-2d" {...deckProps}>
        <Map mapStyle={MAP_STYLE_2D} />
      </DeckGL>
      {renderTooltip()}
    </div>
  );
};
