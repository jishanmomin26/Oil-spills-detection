import React, { useState } from "react";
import { useIncidentStore } from "../../store/useIncidentStore";
import type { AttributionWeights } from "../../store/useIncidentStore";

export const AttributionPanel: React.FC = () => {
  const {
    rankedAttributions,
    isAttributionsLoading,
    attributionsError,
    attributionWeights,
    setAttributionWeights,
    resetAttributionWeights,
    selectedVesselId,
    setSelectedVessel,
    fetchAttributions,
  } = useIncidentStore();

  const [showWeightsConfig, setShowWeightsConfig] = useState(false);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  // Local weights state for smooth slider adjustments
  const [localWeights, setLocalWeights] = useState<AttributionWeights>(attributionWeights);

  const handleWeightChange = (key: keyof AttributionWeights, value: number) => {
    const updated = { ...localWeights, [key]: value };
    setLocalWeights(updated);
    setAttributionWeights(updated);
  };

  const handleResetWeights = () => {
    resetAttributionWeights();
    setLocalWeights({
      spatial: 0.30,
      temporal: 0.25,
      trajectory: 0.20,
      behaviour: 0.15,
      quality: 0.10,
    });
  };

  const getRelevanceStyle = (level: string) => {
    switch (level) {
      case "High relevance":
        return {
          bg: "rgba(244,63,94,0.15)",
          border: "rgba(244,63,94,0.4)",
          text: "#f87171",
        };
      case "Medium relevance":
        return {
          bg: "rgba(245,158,11,0.15)",
          border: "rgba(245,158,11,0.4)",
          text: "#fbbf24",
        };
      case "Low relevance":
        return {
          bg: "rgba(148,163,184,0.15)",
          border: "rgba(148,163,184,0.4)",
          text: "#94a3b8",
        };
      default:
        return {
          bg: "rgba(113,113,122,0.15)",
          border: "rgba(113,113,122,0.4)",
          text: "#a1a1aa",
        };
    }
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 75) return "#f43f5e";
    if (score >= 50) return "#f59e0b";
    if (score >= 25) return "#38bdf8";
    return "#71717a";
  };

  const totalRawWeight =
    localWeights.spatial +
    localWeights.temporal +
    localWeights.trajectory +
    localWeights.behaviour +
    localWeights.quality;

  return (
    <div
      style={{
        width: "100%",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        padding: "16px",
        color: "#e4e4e7",
        fontSize: "13px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#38bdf8",
          marginBottom: "14px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>⚖</span>
          <h2
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            Vessel Attribution (Phase 9)
          </h2>
        </div>
        <button
          onClick={() => setShowWeightsConfig(!showWeightsConfig)}
          style={{
            fontSize: "12px",
            padding: "5px 10px",
            background: showWeightsConfig ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "4px",
            color: showWeightsConfig ? "#38bdf8" : "#a1a1aa",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          {showWeightsConfig ? "Hide Weights" : "Adjust Weights"}
        </button>
      </div>

      {/* Weights Configuration Panel */}
      {showWeightsConfig && (
        <div
          style={{
            background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#38bdf8",
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              Investigator Evidence Weights
            </span>
            <button
              onClick={handleResetWeights}
              style={{
                fontSize: "9px",
                padding: "2px 6px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "3px",
                color: "#94a3b8",
                cursor: "pointer",
              }}
            >
              Reset to Standard
            </button>
          </div>

          {/* 5 sliders */}
          {[
            { key: "spatial", label: "Spatial Proximity", color: "#38bdf8" },
            { key: "temporal", label: "Temporal Coincidence", color: "#a78bfa" },
            { key: "trajectory", label: "Trajectory Corridor", color: "#34d399" },
            { key: "behaviour", label: "Kinematics & Behaviour", color: "#fbbf24" },
            { key: "quality", label: "AIS Data Quality", color: "#60a5fa" },
          ].map(({ key, label, color }) => {
            const k = key as keyof AttributionWeights;
            const rawVal = localWeights[k];
            const pct = totalRawWeight > 0 ? Math.round((rawVal / totalRawWeight) * 100) : 0;
            return (
              <div key={k} style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    marginBottom: "2px",
                  }}
                >
                  <span style={{ color }}>{label}</span>
                  <span style={{ color: "#e2e8f0" }}>{pct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={rawVal}
                  onChange={(e) => handleWeightChange(k, parseFloat(e.target.value))}
                  style={{
                    width: "100%",
                    height: "4px",
                    accentColor: color,
                    cursor: "pointer",
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {isAttributionsLoading && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#38bdf8",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          Calculating multi-criteria evidence attribution...
        </div>
      )}

      {/* Error state */}
      {attributionsError && (
        <div
          style={{
            padding: "10px",
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "6px",
            color: "#f87171",
            fontSize: "11px",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{attributionsError}</span>
          <button
            onClick={() => fetchAttributions()}
            style={{
              background: "transparent",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#f87171",
              borderRadius: "4px",
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: "10px",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isAttributionsLoading && rankedAttributions.length === 0 && !attributionsError && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: "#71717a",
            fontFamily: "monospace",
            fontSize: "11px",
          }}
        >
          No candidate vessels identified for attribution scoring.
        </div>
      )}

      {/* Ranked Candidate List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rankedAttributions.map((candidate, idx) => {
          const rank = candidate.rank ?? idx + 1;
          const isSelected = selectedVesselId === candidate.vessel_id;
          const isExpanded = expandedCandidateId === candidate.vessel_id;
          const relStyle = getRelevanceStyle(candidate.relevance_level);

          return (
            <div
              key={candidate.vessel_id}
              style={{
                background: isSelected
                  ? "rgba(56,189,248,0.08)"
                  : "rgba(255,255,255,0.03)",
                border: isSelected
                  ? "1px solid rgba(56,189,248,0.4)"
                  : "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "10px 12px",
                transition: "all 0.15s ease",
              }}
            >
              {/* Header: Rank + Name + Relevance */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: rank === 1 ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.06)",
                      border: rank === 1 ? "1px solid rgba(244,63,94,0.5)" : "1px solid rgba(255,255,255,0.15)",
                      color: rank === 1 ? "#f87171" : "#d4d4d8",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "monospace",
                    }}
                  >
                    #{rank}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: isSelected ? "#38bdf8" : "#f4f4f5",
                        lineHeight: 1.2,
                      }}
                    >
                      {candidate.vessel_name}
                    </div>
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#71717a",
                        fontFamily: "monospace",
                      }}
                    >
                      {candidate.vessel_type || "Vessel"} · MMSI: {candidate.mmsi}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    padding: "2px 8px",
                    background: relStyle.bg,
                    border: `1px solid ${relStyle.border}`,
                    borderRadius: "4px",
                    color: relStyle.text,
                    fontSize: "10px",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {candidate.relevance_level}
                </span>
              </div>

              {/* Overall Evidence Score Bar */}
              <div style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    marginBottom: "3px",
                  }}
                >
                  <span style={{ color: "#a1a1aa" }}>Evidence Score</span>
                  <span
                    style={{
                      color: getScoreBarColor(candidate.overall_score),
                      fontWeight: 700,
                      fontSize: "11px",
                    }}
                  >
                    {candidate.overall_score.toFixed(1)} / 100
                  </span>
                </div>
                <div
                  style={{
                    height: "5px",
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, candidate.overall_score))}%`,
                      background: getScoreBarColor(candidate.overall_score),
                      borderRadius: "3px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* 5-Category Mini Scores Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "4px",
                  marginBottom: "8px",
                }}
              >
                {[
                  { label: "Spat", val: candidate.category_scores?.spatial ?? candidate.spatial_score, color: "#38bdf8" },
                  { label: "Temp", val: candidate.category_scores?.temporal ?? candidate.temporal_score, color: "#a78bfa" },
                  { label: "Traj", val: candidate.category_scores?.trajectory ?? candidate.trajectory_score, color: "#34d399" },
                  { label: "Beh", val: candidate.category_scores?.behaviour ?? candidate.behaviour_score, color: "#fbbf24" },
                  { label: "Qual", val: candidate.category_scores?.quality ?? (candidate.confidence * 100), color: "#60a5fa" },
                ].map((cat, ci) => (
                  <div
                    key={ci}
                    style={{
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "4px",
                      padding: "4px 2px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "8px", color: "#71717a", fontFamily: "monospace" }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: cat.color, fontFamily: "monospace" }}>
                      {cat.val?.toFixed(0) ?? "0"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setSelectedVessel(candidate.vessel_id)}
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    background: isSelected ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.05)",
                    border: isSelected ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    color: isSelected ? "#38bdf8" : "#d4d4d8",
                    fontSize: "10px",
                    fontFamily: "monospace",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {isSelected ? "Selected in SOC" : "Select Vessel"}
                </button>
                <button
                  onClick={() => setExpandedCandidateId(isExpanded ? null : candidate.vessel_id)}
                  style={{
                    padding: "4px 8px",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    color: "#a1a1aa",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  {isExpanded ? "▲ Hide Evidence" : "▼ Evidence Details"}
                </button>
              </div>

              {/* Expanded Evidence Breakdown */}
              {isExpanded && (
                <div
                  style={{
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    fontSize: "10px",
                  }}
                >
                  {/* Closest Approach */}
                  {candidate.closest_approach_km != null && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "3px 0",
                        color: "#94a3b8",
                        fontFamily: "monospace",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        marginBottom: "6px",
                      }}
                    >
                      <span>Closest Approach to Origin:</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                        {candidate.closest_approach_km.toFixed(1)} km
                      </span>
                    </div>
                  )}

                  {/* Supporting Evidence (+) */}
                  {candidate.supporting_evidence?.length > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div
                        style={{
                          color: "#34d399",
                          fontWeight: 700,
                          fontSize: "9px",
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          marginBottom: "4px",
                        }}
                      >
                        Supporting Evidence (+)
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {candidate.supporting_evidence.map((ev, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "3px 6px",
                              background: "rgba(16,185,129,0.08)",
                              borderLeft: "2px solid #10b981",
                              color: "#d1fae5",
                              fontSize: "10px",
                              lineHeight: 1.3,
                            }}
                          >
                            {ev}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contradictory / Limiting Evidence (-) */}
                  {candidate.contradictory_evidence?.length > 0 && (
                    <div>
                      <div
                        style={{
                          color: "#fb923c",
                          fontWeight: 700,
                          fontSize: "9px",
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          marginBottom: "4px",
                        }}
                      >
                        Limiting / Contradictory Factors (-)
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {candidate.contradictory_evidence.map((ev, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "3px 6px",
                              background: "rgba(249,115,22,0.08)",
                              borderLeft: "2px solid #f97316",
                              color: "#ffedd5",
                              fontSize: "10px",
                              lineHeight: 1.3,
                            }}
                          >
                            {ev}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Statutory Analytical Disclaimer */}
      <div
        style={{
          marginTop: "14px",
          padding: "8px 10px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "6px",
          fontSize: "9px",
          color: "#71717a",
          lineHeight: 1.4,
          fontStyle: "italic",
        }}
      >
        ⚖ Evidence is analytical and should be interpreted with supporting satellite, AIS and environmental evidence.
      </div>
    </div>
  );
};
