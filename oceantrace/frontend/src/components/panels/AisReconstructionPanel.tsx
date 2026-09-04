import { useIncidentStore } from "../../store/useIncidentStore";

export const AisReconstructionPanel = () => {
  const { reconstruction } = useIncidentStore();

  if (!reconstruction) return null;

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
          color: "#fbbf24",
          marginBottom: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "12px",
        }}
      >
        <span style={{ fontSize: "16px" }}>&#8767;</span>
        <h2
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
          }}
        >
          AIS Reconstruction
        </h2>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
          }}
        >
          <InfoBox label="Total Vessels" value={reconstruction.total_vessels} />
          <InfoBox
            label="Gaps Detected"
            value={reconstruction.vessels_with_gaps}
            highlight
          />
          <InfoBox label="Total Points" value={reconstruction.total_points} />
          <InfoBox
            label="Reconstructed"
            value={reconstruction.reconstructed_points}
            highlight
          />
        </div>
      </div>

      <div style={{ marginBottom: "8px", fontSize: "11px", color: "#a1a1aa" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span>Overall Track Confidence:</span>
          <span
            style={{
              color: "#fbbf24",
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
          >
            {(reconstruction.overall_confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div
          style={{
            height: "4px",
            background: "#27272a",
            borderRadius: "2px",
            overflow: "hidden",
            marginTop: "6px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${reconstruction.overall_confidence * 100}%`,
              background: "#fbbf24",
              borderRadius: "2px",
            }}
          />
        </div>
      </div>

      <div
        style={{
          fontSize: "10px",
          color: "#71717a",
          fontStyle: "italic",
          lineHeight: 1.4,
          marginTop: "16px",
        }}
      >
        Linear interpolation applied to vessels with detected AIS transmission
        gaps. Reconstructed points are highlighted in orange on the map.
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
      background: highlight ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${highlight ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
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
        color: highlight ? "#fbbf24" : "#e4e4e7",
        fontFamily: "monospace",
      }}
    >
      {value}
    </div>
  </div>
);
