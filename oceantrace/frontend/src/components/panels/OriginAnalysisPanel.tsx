import { useIncidentStore } from "../../store/useIncidentStore";

export const OriginAnalysisPanel = () => {
  const { origin, drift } = useIncidentStore();

  if (!origin) return null;

  // Check if there's a hindcast drift simulation (backward) and forecast (forward validation)
  const hasHindcast = drift.some((d) => d.simulation_type === "HINDCAST");
  const hasForecast = drift.some(
    (d) =>
      d.simulation_type === "FORECAST" ||
      d.simulation_type === "FORWARD_VALIDATION",
  );

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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#10b981",
          marginBottom: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "12px",
        }}
      >
        <span style={{ fontSize: "16px" }}>&#8853;</span>
        <h2
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
          }}
        >
          Origin & Drift Engine
        </h2>
      </div>

      {/* Drift Simulation Status */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            color: "#a1a1aa",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "8px",
          }}
        >
          Simulation Engine
        </div>
        <div style={{ display: "flex", gap: "8px", fontSize: "11px" }}>
          <div
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              background: hasHindcast
                ? "rgba(16,185,129,0.1)"
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${hasHindcast ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
              color: hasHindcast ? "#34d399" : "#a1a1aa",
            }}
          >
            Backward (Hindcast)
          </div>
          <div
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              background: hasForecast
                ? "rgba(59,130,246,0.1)"
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${hasForecast ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.1)"}`,
              color: hasForecast ? "#60a5fa" : "#a1a1aa",
            }}
          >
            Forward Validation
          </div>
        </div>
      </div>

      {/* Uncertainty Propagation */}
      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            color: "#a1a1aa",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "10px",
          }}
        >
          Uncertainty Propagation
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <InfoBox
            label="Origin Prob"
            value={`${((origin.probability ?? 0) * 100).toFixed(1)}%`}
            highlight
          />
          <InfoBox
            label="Uncertainty Radius"
            value={`${(origin.uncertainty_radius_km ?? 0).toFixed(1)} km`}
          />
          <InfoBox
            label="Time Window Start"
            value={
              origin.time_window_start
                ? origin.time_window_start.substring(11, 16) + " UTC"
                : "N/A"
            }
          />
          <InfoBox
            label="Time Window End"
            value={
              origin.time_window_end
                ? origin.time_window_end.substring(11, 16) + " UTC"
                : "N/A"
            }
          />
        </div>
      </div>

      {/* Forward Validation Results */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            color: "#a1a1aa",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "10px",
          }}
        >
          Forward Validation Metrics
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              padding: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                marginBottom: "4px",
              }}
            >
              <span style={{ color: "#d4d4d8" }}>
                Spatial Overlap (Sim vs Obs)
              </span>
              <span style={{ fontFamily: "monospace", color: "#34d399" }}>
                {(origin.spatial_overlap_pct ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                marginBottom: "4px",
              }}
            >
              <span style={{ color: "#d4d4d8" }}>Trajectory Similarity</span>
              <span style={{ fontFamily: "monospace", color: "#34d399" }}>
                {(origin.trajectory_similarity_score ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                marginBottom: "4px",
              }}
            >
              <span style={{ color: "#d4d4d8" }}>Distance Error (Center)</span>
              <span style={{ fontFamily: "monospace", color: "#38bdf8" }}>
                {(origin.forward_validation_distance_km ?? 0).toFixed(1)} km
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoBox = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) => (
  <div
    style={{
      padding: "8px",
      background: highlight ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${highlight ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    }}
  >
    <div
      style={{ fontSize: "10px", color: "#a1a1aa", textTransform: "uppercase" }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: "13px",
        fontWeight: 600,
        color: highlight ? "#34d399" : "#e4e4e7",
        fontFamily: "monospace",
      }}
    >
      {value}
    </div>
  </div>
);
