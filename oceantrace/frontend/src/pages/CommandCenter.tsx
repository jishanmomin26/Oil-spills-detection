import { useEffect, useRef, useCallback, useState } from "react";
import { useIncidentStore } from "../store/useIncidentStore";
import { InvestigationMap } from "../components/map/InvestigationMap";
import { MapControls } from "../components/map/MapControls";
import { MapLegend } from "../components/map/MapLegend";
import { VesselDetailPanel } from "../components/map/VesselDetailPanel";
import { TimelineControl } from "../components/timeline/TimelineControl";
import { SpillAnalysisPanel } from "../components/panels/SpillAnalysisPanel";
import { OriginAnalysisPanel } from "../components/panels/OriginAnalysisPanel";
import { ForecastPanel } from "../components/panels/ForecastPanel";
import { FilteringPanel } from "../components/panels/FilteringPanel";
import { AisReconstructionPanel } from "../components/panels/AisReconstructionPanel";
import { AttributionPanel } from "../components/panels/AttributionPanel";
import { InvestigationTimelinePanel } from "../components/panels/InvestigationTimelinePanel";
import { SatelliteEvidencePanel } from "../components/panels/SatelliteEvidencePanel";
import { AiInvestigationPanel } from "../components/panels/AiInvestigationPanel";
import { InvestigationSummaryModal } from "../components/panels/InvestigationSummaryModal";

// ── Sidebar Tab Definitions ──
type SidebarTab = 'timeline' | 'satellite' | 'ai' | 'modules' | 'summary';

const SIDEBAR_TABS: { key: SidebarTab; icon: string; label: string }[] = [
  { key: 'timeline',  icon: '⏱', label: 'TIMELINE' },
  { key: 'satellite', icon: '🛰', label: 'SATELLITE' },
  { key: 'ai',        icon: '🤖', label: 'AI' },
  { key: 'modules',   icon: '📊', label: 'MODULES' },
  { key: 'summary',   icon: '📋', label: 'SUMMARY' },
];

export const CommandCenter = () => {
  const {
    fetchIncidentData,
    incident,
    isLoading,
    error,
    vessels,
    drift,
    tracks,
    selectedVesselId,
    setSummaryModalOpen,
    resetDemoState,
  } = useIncidentStore();

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('timeline');

  // ── Resizable Sidebar State & Persistence ──
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("oceantrace_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 380 && parsed <= 900) return parsed;
      }
    } catch {}
    if (typeof window !== "undefined" && window.innerWidth < 1440) return 460;
    return 480;
  });
  const [isDragging, setIsDragging] = useState(false);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(480);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + deltaX;
      const minW = window.innerWidth < 1400 ? 380 : 420;
      const maxW = Math.min(880, Math.floor(window.innerWidth * 0.62));
      const clamped = Math.max(minW, Math.min(maxW, newWidth));
      setSidebarWidth(clamped);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try {
          localStorage.setItem("oceantrace_sidebar_width", String(sidebarWidth));
        } catch {}
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [sidebarWidth]);

  // Responsive clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      setSidebarWidth((curr) => {
        const minW = window.innerWidth < 1400 ? 380 : 420;
        const maxW = Math.min(880, Math.floor(window.innerWidth * 0.62));
        return Math.max(minW, Math.min(maxW, curr));
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // We communicate flyTo/resetView imperatively via a shared ref that InvestigationMap can receive
  // Since InvestigationMap uses DeckGL's initialViewState (uncontrolled), we use a ref-based
  // approach: store a callback from InvestigationMap that CommandCenter can call
  const flyToRef = useRef<
    ((lon: number, lat: number, zoom: number) => void) | null
  >(null);
  const resetViewRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetchIncidentData("OCEANTRACE-DEMO-001");
  }, [fetchIncidentData]);

  const handleFlyTo = useCallback((lon: number, lat: number, zoom: number) => {
    flyToRef.current?.(lon, lat, zoom);
  }, []);

  const handleResetView = useCallback(() => {
    resetViewRef.current?.();
  }, []);

  if (error) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "#09090b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#ef4444",
          fontFamily: "monospace",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠</div>
        <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>SYSTEM ERROR</h2>
        <p style={{ color: "#a1a1aa" }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "24px",
            padding: "8px 16px",
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          REBOOT SYSTEM
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#09090b",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#e4e4e7",
      }}
    >
      {/* ── Investigation Summary Modal (Phase 14) ── */}
      <InvestigationSummaryModal />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        style={{
          height: "52px",
          background: "rgba(9,9,11,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          zIndex: 40,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              boxShadow: "0 0 12px rgba(34,211,238,0.4)",
            }}
          >
            ★
          </div>
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "2px",
                lineHeight: 1.2,
              }}
            >
              OCEANTRACE AI
            </div>
            <div
              style={{
                fontSize: "9px",
                color: "#22d3ee",
                letterSpacing: "1.5px",
                fontFamily: "monospace",
              }}
            >
              MARITIME INTELLIGENCE SOC
            </div>
          </div>
        </div>

        {incident && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "12px",
            }}
          >
            {/* Phase 15: Reset Demo button */}
            <button
              onClick={resetDemoState}
              title="Reset all filters, selections, and reload demo data"
              style={{
                padding: "4px 12px",
                background: "rgba(56,189,248,0.08)",
                border: "1px solid rgba(56,189,248,0.25)",
                borderRadius: "4px",
                color: "#38bdf8",
                fontFamily: "monospace",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(56,189,248,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(56,189,248,0.08)"; }}
            >
              ↻ RESET DEMO
            </button>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: "9px",
                  color: "#71717a",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Active Investigation
              </div>
              <div style={{ fontFamily: "monospace", color: "#d4d4d8" }}>
                {incident.id}
              </div>
            </div>
            <div
              style={{
                padding: "4px 10px",
                background: "rgba(239,68,68,0.15)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "4px",
                fontFamily: "monospace",
                fontSize: "11px",
              }}
            >
              {incident.status.replace("_", " ")}
            </div>
          </div>
        )}
      </header>

      {/* ── Stats Bar ──────────────────────────────────────────────── */}
      {!isLoading && incident && (
        <div
          style={{
            height: "30px",
            background: "rgba(9,9,11,0.7)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            padding: "0 20px",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#71717a",
            zIndex: 39,
            flexShrink: 0,
          }}
        >
          <span>
            Vessels: <span style={{ color: "#d4d4d8" }}>{vessels.length}</span>
          </span>
          <span>
            Tracks: <span style={{ color: "#d4d4d8" }}>{tracks.length}</span>
          </span>
          <span>
            Drift Sims: <span style={{ color: "#d4d4d8" }}>{drift.length}</span>
          </span>
          <span>
            Region:{" "}
            <span style={{ color: "#d4d4d8" }}>{incident.region ?? "N/A"}</span>
          </span>
          <span
            style={{
              marginLeft: "auto",
              color: "#fbbf24",
              fontSize: "10px",
              letterSpacing: "1px",
            }}
          >
            [SIMULATED / DEMO DATA]
          </span>
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "row", position: "relative", overflow: "hidden" }}>
        
        {/* Left Sidebar — Resizable (default 480px) with comfortable typography */}
        {!isLoading && (
          <aside
            style={{
              width: `${sidebarWidth}px`,
              flexShrink: 0,
              background: "rgba(9,9,11,0.96)",
              borderRight: "1px solid rgba(255,255,255,0.08)",
              zIndex: 20,
              pointerEvents: "auto",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              transition: isDragging ? "none" : "width 0.1s ease-out",
            }}
          >
            {/* Sidebar View Switcher Tabs + Width Controls */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(15, 23, 42, 0.85)",
              padding: "6px 8px",
              gap: "5px",
              flexShrink: 0,
            }}>
              {/* Primary navigation tabs */}
              <div style={{ display: "flex", gap: "4px" }}>
                {SIDEBAR_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSidebarTab(tab.key)}
                    style={{
                      flex: 1,
                      padding: "9px 4px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 700,
                      letterSpacing: "0.4px",
                      border: sidebarTab === tab.key ? "1px solid #38bdf8" : "1px solid transparent",
                      background: sidebarTab === tab.key ? "rgba(56, 189, 248, 0.22)" : "transparent",
                      color: sidebarTab === tab.key ? "#38bdf8" : "#94a3b8",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      transition: "all 0.15s ease",
                      boxShadow: sidebarTab === tab.key ? "0 0 12px rgba(56,189,248,0.15)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "13px" }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Quick width presets & indicator bar */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "2px 4px",
                fontSize: "11px",
                color: "#64748b",
                fontFamily: "monospace",
              }}>
                <span title="Drag sidebar border to resize">
                  PANEL WIDTH: <strong style={{ color: "#94a3b8" }}>{sidebarWidth}px</strong>
                </span>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    onClick={() => setSidebarWidth(440)}
                    title="Compact view (440px)"
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      borderRadius: "3px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: sidebarWidth === 440 ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.03)",
                      color: sidebarWidth === 440 ? "#38bdf8" : "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    440
                  </button>
                  <button
                    onClick={() => setSidebarWidth(520)}
                    title="Standard view (520px)"
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      borderRadius: "3px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: sidebarWidth === 520 ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.03)",
                      color: sidebarWidth === 520 ? "#38bdf8" : "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    520
                  </button>
                  <button
                    onClick={() => setSidebarWidth(680)}
                    title="Expanded inspection view (680px)"
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      borderRadius: "3px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: sidebarWidth === 680 ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.03)",
                      color: sidebarWidth === 680 ? "#38bdf8" : "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    680
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Contents */}
            {sidebarTab === 'timeline' && (
              <div style={{ flex: 1, overflow: "hidden" }}>
                <InvestigationTimelinePanel onFlyTo={handleFlyTo} />
              </div>
            )}
            {sidebarTab === 'satellite' && (
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <SatelliteEvidencePanel onFlyTo={(coord, zoom) => handleFlyTo(coord[0], coord[1], zoom || 10)} />
              </div>
            )}
            {sidebarTab === 'ai' && (
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <AiInvestigationPanel />
              </div>
            )}
            {sidebarTab === 'modules' && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "16px",
                  overflowY: "auto",
                }}
              >
                <SpillAnalysisPanel />
                <OriginAnalysisPanel />
                <ForecastPanel />
                <FilteringPanel />
                <AisReconstructionPanel />
                <AttributionPanel />
              </div>
            )}
            {sidebarTab === 'summary' && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  padding: "20px",
                  overflowY: "auto",
                }}
              >
                {/* Summary tab content — quick overview + open full dossier */}
                <div style={{
                  padding: "16px",
                  background: "rgba(56,189,248,0.05)",
                  border: "1px solid rgba(56,189,248,0.15)",
                  borderRadius: "10px",
                }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "1.5px", color: "#38bdf8", marginBottom: "12px" }}>
                    INVESTIGATION SUMMARY
                  </div>
                  <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#94a3b8" }}>
                    Open the full Investigation Dossier to review all deterministic
                    evidence, candidate attributions, satellite observations, and
                    AI-generated explanations compiled from Phases 1–12.
                  </div>
                  <button
                    onClick={() => setSummaryModalOpen(true)}
                    style={{
                      marginTop: "16px",
                      width: "100%",
                      padding: "10px",
                      background: "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(59,130,246,0.15))",
                      border: "1px solid rgba(56,189,248,0.3)",
                      borderRadius: "8px",
                      color: "#38bdf8",
                      fontWeight: 700,
                      fontSize: "12px",
                      letterSpacing: "1px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(56,189,248,0.25), rgba(59,130,246,0.25))"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(59,130,246,0.15))"; }}
                  >
                    📋 OPEN FULL INVESTIGATION DOSSIER
                  </button>
                </div>

                {/* Quick stats */}
                <div style={{
                  padding: "16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "10px",
                }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "1px", color: "#64748b", marginBottom: "10px" }}>
                    QUICK METRICS
                  </div>
                  <QuickMetricRow label="Vessels Analysed" value={String(vessels.length)} />
                  <QuickMetricRow label="AIS Tracks" value={String(tracks.length)} />
                  <QuickMetricRow label="Drift Simulations" value={String(drift.length)} />
                  <QuickMetricRow label="Region" value={incident?.region || "N/A"} />
                  <QuickMetricRow label="Status" value={incident?.status?.replace("_", " ") || "—"} accent="#f87171" />
                </div>

                {/* Reset Demo */}
                <button
                  onClick={resetDemoState}
                  style={{
                    padding: "10px",
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "8px",
                    color: "#f87171",
                    fontWeight: 700,
                    fontSize: "11px",
                    letterSpacing: "0.5px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                >
                  ↻ RESET DEMO STATE
                </button>
              </div>
            )}
          </aside>
        )}

        {/* ── Sidebar Resizer Drag Handle ── */}
        {!isLoading && (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={() => {
              // Cycle presets on double click: 460 -> 640 -> 800 -> 460
              setSidebarWidth((w) => (w < 520 ? 640 : w < 720 ? 800 : 460));
            }}
            title="Drag to resize sidebar (Double-click to cycle presets)"
            style={{
              width: "6px",
              flexShrink: 0,
              cursor: "col-resize",
              position: "relative",
              zIndex: 25,
              background: isDragging ? "#38bdf8" : "rgba(255,255,255,0.06)",
              transition: isDragging ? "none" : "background 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              if (!isDragging) e.currentTarget.style.background = "rgba(56,189,248,0.3)";
            }}
            onMouseLeave={(e) => {
              if (!isDragging) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
          >
            {/* Visual grip indicator */}
            <div
              style={{
                width: "2px",
                height: "32px",
                borderRadius: "1px",
                background: isDragging ? "#ffffff" : "rgba(255,255,255,0.3)",
              }}
            />
          </div>
        )}

        {/* Center Map Area */}
        <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <InvestigationMap
              onRegisterFlyTo={(fn) => {
                flyToRef.current = fn;
              }}
              onRegisterResetView={(fn) => {
                resetViewRef.current = fn;
              }}
            />
          </div>

          {!isLoading && (
            <>
              {/* Map Controls */}
              <div style={{ position: "absolute", top: "14px", right: "14px", zIndex: 30 }}>
                <MapControls onFlyTo={handleFlyTo} onResetView={handleResetView} />
              </div>

              {/* Legend & Timeline area */}
              <div style={{
                position: "absolute", 
                bottom: "24px", 
                left: "14px", 
                right: "14px", 
                zIndex: 30, 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "flex-end",
                pointerEvents: "none" // Allow clicking through to map
              }}>
                <div style={{ pointerEvents: "auto" }}>
                  <MapLegend />
                </div>
                <div style={{ pointerEvents: "auto", flex: 1, display: "flex", justifyContent: "center" }}>
                  <TimelineControl />
                </div>
                {/* Spacer to balance the legend for timeline centering, assuming legend is approx 180px */}
                <div style={{ width: "180px" }}></div>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar (Vessel Detail) */}
        {!isLoading && selectedVesselId && (
          <div
            style={{
              width: "340px",
              flexShrink: 0,
              background: "rgba(9,9,11,0.95)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              zIndex: 20,
              pointerEvents: "auto",
              display: "flex",
              flexDirection: "column",
              position: "relative"
            }}
          >
            <VesselDetailPanel onFlyTo={handleFlyTo} />
          </div>
        )}
      </main>
    </div>
  );
};

// ── Quick Metric Row component ──
const QuickMetricRow = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
    <span style={{ color: "#94a3b8", fontSize: "14px" }}>{label}</span>
    <span style={{ color: accent || "#f1f5f9", fontFamily: "monospace", fontSize: "14px", fontWeight: 600 }}>{value}</span>
  </div>
);
