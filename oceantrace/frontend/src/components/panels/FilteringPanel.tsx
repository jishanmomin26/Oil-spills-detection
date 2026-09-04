import { useState } from "react";
import { useIncidentStore } from "../../store/useIncidentStore";

const ALL_VESSEL_TYPES = ["tanker", "cargo", "container", "fishing", "passenger", "tug", "service", "other"];

export const FilteringPanel = () => {
  const {
    filtering,
    vessels,
    spills,
    applyFilters,
    selectedVesselId,
    setSelectedVessel
  } = useIncidentStore();

  const [activeTab, setActiveTab] = useState<"filters" | "funnel">("filters");

  // Local filter states
  const [maxDistance, setMaxDistance] = useState<number>(100);
  const [useDistanceFilter, setUseDistanceFilter] = useState<boolean>(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["tanker", "cargo"]);
  const [minSpeed, setMinSpeed] = useState<string>("");
  const [maxSpeed, setMaxSpeed] = useState<string>("");
  const [mustEncounterSpill, setMustEncounterSpill] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  if (!filtering) return null;

  const candidates = vessels.filter((v) => v.is_candidate);
  const spill = spills.length > 0 ? spills[0] : null;

  const handleToggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const filters: Record<string, any> = {};
      if (useDistanceFilter) {
        filters.max_distance_km = maxDistance;
      }
      if (selectedTypes.length > 0) {
        filters.vessel_types = selectedTypes.join(",");
      }
      if (minSpeed !== "") {
        filters.min_speed = parseFloat(minSpeed);
      }
      if (maxSpeed !== "") {
        filters.max_speed = parseFloat(maxSpeed);
      }
      if (mustEncounterSpill) {
        filters.must_encounter_spill = true;
      }
      await applyFilters(filters);
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = async () => {
    setUseDistanceFilter(false);
    setMaxDistance(150);
    setSelectedTypes([]);
    setMinSpeed("");
    setMaxSpeed("");
    setMustEncounterSpill(false);
    setIsApplying(true);
    try {
      await applyFilters({});
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        background: "rgba(10, 15, 26, 0.85)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        padding: "16px",
        color: "#e4e4e7",
        fontSize: "14px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#22d3ee" }}>
          <span style={{ fontSize: "15px" }}>⚙</span>
          <h2
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "#38bdf8",
            }}
          >
            AIS Filtering & Funnel
          </h2>
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "6px",
            padding: "2px",
            gap: "2px",
          }}
        >
          <button
            onClick={() => setActiveTab("filters")}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "none",
              background: activeTab === "filters" ? "rgba(56,189,248,0.25)" : "transparent",
              color: activeTab === "filters" ? "#38bdf8" : "#94a3b8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Filters
          </button>
          <button
            onClick={() => setActiveTab("funnel")}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "none",
              background: activeTab === "funnel" ? "rgba(56,189,248,0.25)" : "transparent",
              color: activeTab === "funnel" ? "#38bdf8" : "#94a3b8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Funnel ({candidates.length})
          </button>
        </div>
      </div>

      {/* Spill Summary Alert */}
      {spill && (
        <div
          style={{
            marginBottom: "14px",
            padding: "10px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: "6px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ color: "#f87171", fontWeight: 700, fontSize: "14px" }}>
              ⚠ Spill Zone Monitored
            </span>
            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
              Area: {(spill.area_km2 ?? 0).toFixed(1)} km² | Conf: {((spill.confidence ?? 0) * 100).toFixed(0)}%
            </div>
          </div>
          <span
            style={{
              fontSize: "13px",
              fontFamily: "monospace",
              background: "rgba(239,68,68,0.2)",
              color: "#fca5a5",
              padding: "4px 10px",
              borderRadius: "4px",
              fontWeight: 700,
            }}
          >
            {candidates.length} Matched
          </span>
        </div>
      )}

      {/* TAB CONTENT: FILTERS */}
      {activeTab === "filters" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Max Distance Filter */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={useDistanceFilter}
                  onChange={(e) => setUseDistanceFilter(e.target.checked)}
                  style={{ accentColor: "#38bdf8" }}
                />
                <span style={{ fontSize: "13px", color: "#cbd5e1" }}>Max Distance to Origin</span>
              </label>
              <span style={{ fontFamily: "monospace", fontSize: "13px", color: useDistanceFilter ? "#38bdf8" : "#64748b" }}>
                {useDistanceFilter ? `${maxDistance} km` : "Disabled"}
              </span>
            </div>
            {useDistanceFilter && (
              <input
                type="range"
                min={10}
                max={300}
                step={5}
                value={maxDistance}
                onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "#38bdf8",
                  cursor: "pointer",
                }}
              />
            )}
          </div>

          {/* Vessel Type Multi-select */}
          <div>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "8px" }}>
              Vessel Types {selectedTypes.length > 0 && `(${selectedTypes.length} selected)`}:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {ALL_VESSEL_TYPES.map((type) => {
                const isSelected = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => handleToggleType(type)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "4px",
                      border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                      background: isSelected ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.03)",
                      color: isSelected ? "#e0f2fe" : "#94a3b8",
                      fontSize: "13px",
                      textTransform: "capitalize",
                      cursor: "pointer",
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed Filters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                Min Speed (kn)
              </label>
              <input
                type="number"
                placeholder="e.g. 2.0"
                value={minSpeed}
                onChange={(e) => setMinSpeed(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "5px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.3)",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontFamily: "monospace",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>
                Max Speed (kn)
              </label>
              <input
                type="number"
                placeholder="e.g. 25.0"
                value={maxSpeed}
                onChange={(e) => setMaxSpeed(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "5px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.3)",
                  color: "#e2e8f0",
                  fontSize: "13px",
                  fontFamily: "monospace",
                }}
              />
            </div>
          </div>

          {/* Spill Zone Encounter Checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginTop: "2px" }}>
            <input
              type="checkbox"
              checked={mustEncounterSpill}
              onChange={(e) => setMustEncounterSpill(e.target.checked)}
              style={{ accentColor: "#f43f5e" }}
            />
            <span style={{ fontSize: "13px", color: mustEncounterSpill ? "#fda4af" : "#94a3b8" }}>
              Require direct encounter with spill zone
            </span>
          </label>

          {/* Filter Action Buttons */}
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              onClick={handleApply}
              disabled={isApplying}
              style={{
                flex: 2,
                padding: "10px 12px",
                borderRadius: "6px",
                border: "none",
                background: "linear-gradient(135deg, #0284c7, #0ea5e9)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(14,165,233,0.35)",
              }}
            >
              {isApplying ? "Filtering..." : "Apply Filters"}
            </button>
            <button
              onClick={handleReset}
              disabled={isApplying}
              style={{
                flex: 1,
                padding: "10px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "#94a3b8",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: FUNNEL */}
      {activeTab === "funnel" && (
        <div>
          <div style={{ marginBottom: "14px" }}>
            <FunnelStep
              label="Total Monitored"
              count={filtering.total_vessels}
              max={filtering.total_vessels}
            />
            <FunnelStep
              label="Spatial Filter"
              count={filtering.spatial_candidates}
              max={filtering.total_vessels}
            />
            <FunnelStep
              label="Temporal Filter"
              count={filtering.temporal_candidates}
              max={filtering.total_vessels}
            />
            <FunnelStep
              label="Trajectory Match"
              count={filtering.trajectory_candidates}
              max={filtering.total_vessels}
            />
            <FunnelStep
              label="Behaviour Final"
              count={filtering.behaviour_candidates}
              max={filtering.total_vessels}
              highlight
            />
          </div>

          {/* Matched Vessels List */}
          <div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "12px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "10px",
              }}
            >
              Filtered Candidates ({candidates.length})
            </div>
            <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {candidates.map((c) => {
                const isSelected = c.id === selectedVesselId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedVessel(c.id)}
                    style={{
                      padding: "10px 12px",
                      background: isSelected ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
                      border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                      <span style={{ fontFamily: "monospace", color: isSelected ? "#38bdf8" : "#f1f5f9", fontWeight: 700, fontSize: "14px" }}>
                        {c.name}
                      </span>
                      <span style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase" }}>
                        {c.vessel_type}
                      </span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#64748b" }}>
                      MMSI: {c.mmsi} | Flag: {c.flag_state}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FunnelStep = ({
  label,
  count,
  max,
  highlight = false,
}: {
  label: string;
  count: number;
  max: number;
  highlight?: boolean;
}) => {
  const pct = max > 0 ? Math.max((count / max) * 100, 3) : 0;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "13px",
          marginBottom: "5px",
        }}
      >
        <span
          style={{
            color: highlight ? "#38bdf8" : "#94a3b8",
            fontWeight: highlight ? 700 : 500,
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: "monospace", color: "#e2e8f0", fontWeight: 700 }}>
          {count}
        </span>
      </div>
      <div
        style={{
          height: "6px",
          background: "#1e293b",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: highlight ? "linear-gradient(90deg, #0284c7, #38bdf8)" : "#475569",
            borderRadius: "4px",
            boxShadow: highlight ? "0 0 6px rgba(56,189,248,0.5)" : "none",
          }}
        />
      </div>
    </div>
  );
};
