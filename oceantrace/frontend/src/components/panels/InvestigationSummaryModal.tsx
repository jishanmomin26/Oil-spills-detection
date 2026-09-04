/**
 * InvestigationSummaryModal.tsx
 * Phase 14: Final Investigation Summary — a comprehensive dossier
 * combining ALL deterministic analytical outputs from Phases 1–12.
 */

import React from "react";
import { useIncidentStore } from "../../store/useIncidentStore";

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 9000,
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modal: {
    width: "min(900px, 92vw)", maxHeight: "88vh",
    background: "#0f172a", border: "1px solid rgba(56,189,248,0.25)",
    borderRadius: "16px", display: "flex", flexDirection: "column" as const,
    boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(56,189,248,0.08)",
    overflow: "hidden",
  },
  header: {
    padding: "20px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  body: {
    flex: 1, overflowY: "auto" as const, padding: "24px 28px 32px",
    fontSize: "13.5px", lineHeight: "1.65", color: "#e2e8f0",
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "11px", fontWeight: 700, letterSpacing: "1.5px",
    textTransform: "uppercase" as const, color: "#38bdf8", marginBottom: "10px",
    borderBottom: "1px solid rgba(56,189,248,0.15)", paddingBottom: "6px",
  },
  row: {
    display: "flex", justifyContent: "space-between", marginBottom: "5px",
  },
  label: { color: "#94a3b8", fontSize: "12.5px" },
  value: { color: "#f1f5f9", fontFamily: "monospace", fontSize: "12.5px", fontWeight: 600 },
  badge: {
    display: "inline-block", padding: "2px 8px", borderRadius: "4px",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px",
  },
  disclaimer: {
    marginTop: "20px", padding: "14px 16px",
    background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
    borderRadius: "8px", fontSize: "11.5px", lineHeight: "1.6", color: "#fbbf24",
  },
  closeBtn: {
    padding: "6px 16px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px",
    color: "#94a3b8", cursor: "pointer", fontSize: "12px",
  },
};

const Row = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div style={S.row}>
    <span style={S.label}>{label}</span>
    <span style={{ ...S.value, color: accent || S.value.color }}>{value}</span>
  </div>
);

const Badge = ({ text, color, bg }: { text: string; color: string; bg: string }) => (
  <span style={{ ...S.badge, color, background: bg }}>{text}</span>
);

export const InvestigationSummaryModal = () => {
  const {
    isSummaryModalOpen, setSummaryModalOpen,
    incident, spills, origin, drift, vessels,
    rankedAttributions, satelliteAnalysis,
    timelineEvents, aiSummary,
  } = useIncidentStore();

  if (!isSummaryModalOpen) return null;

  const primarySpill = spills[0];
  // Candidates are determined by relevance_level or overall_score
  const candidates = rankedAttributions.filter(
    (a) => a.relevance_level === "HIGH" || a.relevance_level === "VERY_HIGH" || a.overall_score > 0.5
  );
  const totalObs = satelliteAnalysis?.summary?.total_observations ?? 0;
  const firstObs = satelliteAnalysis?.summary?.first_observation_time;
  const latestObs = satelliteAnalysis?.summary?.latest_observation_time;
  const areaChange = satelliteAnalysis?.summary?.net_area_change_km2;
  const centroidDisp = satelliteAnalysis?.summary?.total_centroid_displacement_km;
  const driftCorr = satelliteAnalysis?.drift_correlation;
  const limitations = satelliteAnalysis?.limitations || [];

  const keyTimelineEvents = (timelineEvents || []).slice(0, 8);

  return (
    <div style={S.overlay} onClick={() => setSummaryModalOpen(false)}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.5px" }}>
              INVESTIGATION SUMMARY DOSSIER
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace", marginTop: "2px" }}>
              {incident?.id || "—"} &nbsp;·&nbsp; Generated {new Date().toISOString().substring(0, 16)} UTC
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Badge text="SIMULATED / DEMO DATA" color="#fbbf24" bg="rgba(251,191,36,0.15)" />
            <button style={S.closeBtn} onClick={() => setSummaryModalOpen(false)}>✕ Close</button>
          </div>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* 1. Incident Overview */}
          <div style={S.section}>
            <div style={S.sectionTitle}>1 — INCIDENT OVERVIEW</div>
            <Row label="Incident ID" value={incident?.id || "—"} />
            <Row label="Name" value={incident?.name || "—"} />
            <Row label="Status" value={incident?.status?.replace("_", " ") || "—"} accent="#f87171" />
            <Row label="Region" value={incident?.region || "—"} />
            <Row label="Data Classification" value="SYNTHETIC / DEMONSTRATION" accent="#fbbf24" />
          </div>

          {/* 2. Oil Spill Detection */}
          <div style={S.section}>
            <div style={S.sectionTitle}>2 — OIL SPILL DETECTION</div>
            {primarySpill ? (
              <>
                <Row label="Spill Area" value={`${(primarySpill.area_km2 || 0).toFixed(2)} km²`} accent="#f87171" />
                <Row label="Detection Confidence" value={`${((primarySpill.confidence || 0) * 100).toFixed(1)}%`} />
                <Row label="Severity" value={primarySpill.estimated_severity || "—"} accent={primarySpill.estimated_severity === "HIGH" ? "#f87171" : "#fbbf24"} />
                <Row label="Oil Probability" value={`${((primarySpill.oil_probability || 0) * 100).toFixed(1)}%`} />
                <Row label="Detection Method" value={primarySpill.detection_method || "threshold_segmentation"} />
              </>
            ) : (
              <div style={{ color: "#64748b" }}>No spill data available.</div>
            )}
          </div>

          {/* 3. Origin Backtrack */}
          <div style={S.section}>
            <div style={S.sectionTitle}>3 — SPILL ORIGIN ESTIMATE</div>
            {origin ? (
              <>
                <Row label="Estimated Origin" value={`${origin.center_lat?.toFixed(4)}°N, ${origin.center_lon?.toFixed(4)}°E`} accent="#10b981" />
                <Row label="Uncertainty Radius" value={`±${(origin.uncertainty_radius_km || 0).toFixed(1)} km`} />
                <Row label="Probability" value={`${((origin.probability || 0) * 100).toFixed(1)}%`} />
                {origin.time_window_start && origin.time_window_end && (
                  <Row label="Time Window" value={`${origin.time_window_start.substring(0, 16)} → ${origin.time_window_end.substring(0, 16)} UTC`} />
                )}
              </>
            ) : (
              <div style={{ color: "#64748b" }}>Origin not estimated.</div>
            )}
          </div>

          {/* 4. Satellite Observations & Spill Evolution */}
          <div style={S.section}>
            <div style={S.sectionTitle}>4 — SATELLITE OBSERVATIONS & SPILL EVOLUTION</div>
            <Row label="Total Observations" value={String(totalObs)} />
            {firstObs && <Row label="First Observation" value={String(firstObs).substring(0, 16) + " UTC"} />}
            {latestObs && <Row label="Latest Observation" value={String(latestObs).substring(0, 16) + " UTC"} />}
            {areaChange != null && <Row label="Net Area Change" value={`${areaChange > 0 ? "+" : ""}${areaChange.toFixed(2)} km²`} accent={areaChange > 0 ? "#f87171" : "#10b981"} />}
            {centroidDisp != null && <Row label="Centroid Displacement" value={`${centroidDisp.toFixed(2)} km`} />}
            {driftCorr && (
              <>
                <Row label="Drift Direction" value={`${driftCorr.modelled_current_direction_deg?.toFixed(0)}°`} />
                <Row label="Drift Speed" value={`${driftCorr.modelled_current_speed_knots?.toFixed(2)} kn`} />
                <Row label="Movement Agreement" value={driftCorr.movement_agreement || "—"} />
              </>
            )}
          </div>

          {/* 5. Drift & Forecast */}
          <div style={S.section}>
            <div style={S.sectionTitle}>5 — DRIFT SIMULATIONS</div>
            <Row label="Simulations" value={String(drift.length)} />
            {drift.map((d, i) => (
              <Row key={i} label={`${d.simulation_type}`} value={`${d.start_time?.substring(0, 16) || "—"} → ${d.end_time?.substring(0, 16) || "—"}`} />
            ))}
          </div>

          {/* 6. Candidate Vessels & Attribution */}
          <div style={S.section}>
            <div style={S.sectionTitle}>6 — CANDIDATE VESSEL ATTRIBUTION</div>
            <Row label="Total Vessels Analysed" value={String(vessels.length)} />
            <Row label="Priority Candidates" value={String(candidates.length)} accent="#f87171" />
            <div style={{ marginTop: "10px" }}>
              {candidates.slice(0, 5).map((c, i) => {
                const vesselInfo = vessels.find((v) => v.id === c.vessel_id);
                return (
                  <div key={c.vessel_id} style={{
                    padding: "10px 12px", marginBottom: "6px",
                    background: i === 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${i === 0 ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: "8px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px" }}>
                        #{i + 1} {c.vessel_name}
                      </span>
                      <span style={{
                        fontFamily: "monospace", fontWeight: 700, fontSize: "14px",
                        color: c.overall_score > 0.7 ? "#f87171" : c.overall_score > 0.5 ? "#fbbf24" : "#94a3b8",
                      }}>
                        {(c.overall_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", display: "flex", gap: "12px", flexWrap: "wrap" as const }}>
                      <span>Spatial: {(c.spatial_score * 100).toFixed(0)}%</span>
                      <span>Temporal: {(c.temporal_score * 100).toFixed(0)}%</span>
                      <span>Trajectory: {(c.trajectory_score * 100).toFixed(0)}%</span>
                      <span>Behaviour: {(c.behaviour_score * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px" }}>
                      {c.vessel_type || vesselInfo?.vessel_type || "—"} · {vesselInfo?.flag_state || "—"} · MMSI: {c.mmsi}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 7. Key Timeline Milestones */}
          <div style={S.section}>
            <div style={S.sectionTitle}>7 — KEY TIMELINE MILESTONES</div>
            {keyTimelineEvents.length > 0 ? (
              keyTimelineEvents.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "6px", fontSize: "12px" }}>
                  <span style={{ color: "#64748b", fontFamily: "monospace", whiteSpace: "nowrap" as const, minWidth: "140px" }}>
                    {ev.timestamp?.substring(0, 16) || "—"}
                  </span>
                  <span style={{ color: "#e2e8f0" }}>
                    <Badge
                      text={ev.data_label || ev.source || "EVENT"}
                      color={ev.data_label === "OBSERVED" ? "#10b981" : ev.data_label === "ESTIMATED" ? "#38bdf8" : "#fbbf24"}
                      bg={ev.data_label === "OBSERVED" ? "rgba(16,185,129,0.15)" : ev.data_label === "ESTIMATED" ? "rgba(56,189,248,0.12)" : "rgba(251,191,36,0.12)"}
                    />
                    &nbsp;{ev.description || ev.event_type}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ color: "#64748b" }}>No timeline events available.</div>
            )}
          </div>

          {/* 8. AI Explanation (optional) */}
          <div style={S.section}>
            <div style={S.sectionTitle}>8 — AI INVESTIGATION EXPLANATION (OPTIONAL)</div>
            {aiSummary?.response ? (
              <div style={{ fontSize: "12.5px", lineHeight: "1.7", color: "#cbd5e1", whiteSpace: "pre-wrap" as const }}>
                {aiSummary.response}
              </div>
            ) : (
              <div style={{ color: "#64748b" }}>AI explanation not available. Deterministic evidence above remains authoritative.</div>
            )}
          </div>

          {/* 9. Limitations & Data Quality */}
          <div style={S.section}>
            <div style={S.sectionTitle}>9 — LIMITATIONS & DATA QUALITY WARNINGS</div>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#94a3b8", fontSize: "12px", lineHeight: "1.8" }}>
              <li>All demonstration data is <strong style={{ color: "#fbbf24" }}>SYNTHETIC / SIMULATED</strong> for SIH evaluation purposes.</li>
              <li>Spill detection is based on prototype threshold segmentation, not operational remote sensing.</li>
              <li>Origin backtracking uses simplified drift models — not operational Lagrangian particle tracking.</li>
              <li>AIS data is generated — real-world AIS coverage varies significantly by region.</li>
              <li>Attribution scores represent analytical correlation indicators, not forensic evidence.</li>
              {limitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>

          {/* 10. Legal Non-Causation Disclaimer */}
          <div style={S.disclaimer}>
            <strong>⚠ IMPORTANT — NON-CAUSATION DISCLAIMER</strong>
            <p style={{ margin: "8px 0 0" }}>
              OCEANTRACE AI provides evidentiary correlation based on spatial proximity, temporal alignment,
              trajectory analysis, and anomalous vessel behaviour. <strong>It does not establish legal liability
              or definitive causation.</strong> Determination of responsibility for marine pollution incidents
              remains subject to official maritime enforcement investigation under applicable national and
              international maritime law (MARPOL Annex I, UNCLOS).
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "10.5px", color: "#d97706" }}>
              This analysis is intended to support — not replace — qualified maritime investigators.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
