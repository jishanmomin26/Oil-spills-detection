import React, { useState } from "react";
import { useIncidentStore } from "../../store/useIncidentStore";
import type { LayerKey } from "../../store/useIncidentStore";

// Ocean quick-nav targets [lon, lat, zoom]
const OCEAN_REGIONS: {
  label: string;
  lon: number;
  lat: number;
  zoom: number;
}[] = [
  { label: "Indian", lon: 73.0, lat: 10.0, zoom: 4 },
  { label: "Atlantic", lon: -25.0, lat: 15.0, zoom: 3 },
  { label: "Pacific", lon: -160.0, lat: 5.0, zoom: 3 },
];

const LAYER_LABELS: { key: LayerKey; label: string; color: string }[] = [
  { key: "spill", label: "Oil Spill", color: "#f87171" },
  { key: "origin", label: "Origin Zone", color: "#34d399" },
  { key: "vessels", label: "Vessels", color: "#60a5fa" },
  { key: "tracks", label: "Vessel Tracks", color: "#818cf8" },
  { key: "hindcast", label: "Hindcast", color: "#f59e0b" },
  { key: "forecast", label: "Forecast", color: "#38bdf8" },
  { key: "wind", label: "Wind", color: "#93c5fd" },
  { key: "current", label: "Ocean Current", color: "#6ee7b7" },
];

interface MapControlsProps {
  onFlyTo?: (lon: number, lat: number, zoom: number) => void;
  onResetView?: () => void;
}

export const MapControls = ({ onFlyTo, onResetView }: MapControlsProps) => {
  const { mapMode, setMapMode, visibleLayers, toggleLayer } =
    useIncidentStore();
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);

  const btn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "32px",
    padding: "0 12px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    color: "#d4d4d8",
    cursor: "pointer",
    fontSize: "11px",
    fontFamily: "'Inter', system-ui, sans-serif",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
    transition: "background 0.15s, border-color 0.15s",
    userSelect: "none",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "14px",
        right: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        zIndex: 30,
        pointerEvents: "auto",
      }}
    >
      {/* 2D / 3D Toggle */}
      <div
        style={{
          display: "flex",
          background: "rgba(9,9,11,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          overflow: "hidden",
          backdropFilter: "blur(10px)",
        }}
      >
        {(["2d", "3d"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setMapMode(mode)}
            style={{
              ...btn,
              borderRadius: 0,
              border: "none",
              borderRight:
                mode === "2d" ? "1px solid rgba(255,255,255,0.1)" : "none",
              ...(mapMode === mode
                ? {
                    background: "rgba(34,211,238,0.18)",
                    color: "#22d3ee",
                    fontWeight: 700,
                  }
                : {}),
            }}
          >
            {mode === "2d" ? "2D INVESTIGATION" : "3D GLOBE"}
          </button>
        ))}
      </div>

      {/* Ocean Region Navigation */}
      <div
        style={{
          background: "rgba(9,9,11,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "8px",
          backdropFilter: "blur(10px)",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            color: "#52525b",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            fontFamily: "monospace",
            marginBottom: "2px",
          }}
        >
          Ocean Regions
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {OCEAN_REGIONS.map((r) => (
            <button
              key={r.label}
              style={btn}
              onClick={() => onFlyTo?.(r.lon, r.lat, r.zoom)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          style={{ ...btn, marginTop: "2px", width: "100%" }}
          onClick={onResetView}
        >
          ↩ Reset View
        </button>
      </div>

      {/* Layer Visibility Controls */}
      <div
        style={{
          background: "rgba(9,9,11,0.85)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          overflow: "hidden",
          backdropFilter: "blur(10px)",
        }}
      >
        <button
          style={{
            ...btn,
            width: "100%",
            borderRadius: 0,
            border: "none",
            borderBottom: layerPanelOpen
              ? "1px solid rgba(255,255,255,0.1)"
              : "none",
            justifyContent: "space-between",
            padding: "0 12px",
          }}
          onClick={() => setLayerPanelOpen((o) => !o)}
        >
          <span>☰ Layers</span>
          <span style={{ fontSize: "10px", color: "#52525b" }}>
            {layerPanelOpen ? "▲" : "▼"}
          </span>
        </button>
        {layerPanelOpen && (
          <div
            style={{
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {LAYER_LABELS.map(({ key, label, color }) => {
              const active = visibleLayers[key];
              return (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    padding: "3px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleLayer(key)}
                    style={{
                      accentColor: color,
                      width: "13px",
                      height: "13px",
                      cursor: "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      color: active ? "#d4d4d8" : "#52525b",
                      fontFamily: "'Inter', system-ui",
                      transition: "color 0.15s",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: active ? color : "#27272a",
                      transition: "background 0.15s",
                    }}
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
