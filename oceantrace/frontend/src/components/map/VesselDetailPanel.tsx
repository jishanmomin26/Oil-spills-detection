import React, { useState } from "react";
import { useIncidentStore } from "../../store/useIncidentStore";

interface VesselDetailPanelProps {
  onFlyTo?: (lon: number, lat: number, zoom: number) => void;
}

export const VesselDetailPanel: React.FC<VesselDetailPanelProps> = ({ onFlyTo }) => {
  const {
    selectedVesselId,
    setSelectedVessel,
    vessels,
    tracks,
    currentTimestamp,
    vesselIntelligence,
    vesselBehaviours,
    selectedBehaviourEvent,
    selectBehaviourEvent,
  } = useIncidentStore();

  const [activeTab, setActiveTab] = useState<"overview" | "proximity" | "events" | "behaviour">("behaviour");

  if (!selectedVesselId) return null;

  const vessel = vessels.find((v) => v.id === selectedVesselId);
  const track = tracks.find((t) => t.vessel_id === selectedVesselId);
  const intel = vesselIntelligence[selectedVesselId];
  const behProfile = vesselBehaviours[selectedVesselId];

  if (!vessel) return null;

  // Find the closest AIS point to current timeline
  const SNAP_WIN = 2 * 60 * 60 * 1000;
  let currentPoint = null;
  let minDiff = Infinity;
  if (track && currentTimestamp) {
    for (const pt of track.points) {
      if (!pt.timestamp) continue;
      const diff = Math.abs(
        new Date(pt.timestamp).getTime() - currentTimestamp,
      );
      if (diff < minDiff && diff < SNAP_WIN) {
        minDiff = diff;
        currentPoint = pt;
      }
    }
  }

  // Compute track stats
  const totalPoints = track?.points.length ?? 0;
  const recPoints = track?.points.filter((p) => p.is_reconstructed).length ?? 0;
  const obsPoints = totalPoints - recPoints;
  const trackConf = totalPoints > 0 ? obsPoints / totalPoints : 0;

  let maxGap = 0;
  if (track) {
    for (const pt of track.points) {
      if ((pt.gap_duration_hrs ?? 0) > maxGap)
        maxGap = pt.gap_duration_hrs ?? 0;
    }
  }

  const InfoRow = ({
    label,
    value,
    accent,
  }: {
    label: string;
    value: any;
    accent?: string;
  }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        padding: "4px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ fontSize: "11px", color: "#94a3b8" }}>{label}</span>
      <span
        style={{
          fontSize: "11px",
          fontFamily: "monospace",
          color: accent ?? "#e2e8f0",
          fontWeight: 600,
          textAlign: "right",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        fontSize: "10px",
        color: "#64748b",
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        fontFamily: "monospace",
        fontWeight: 700,
        margin: "12px 0 6px 0",
      }}
    >
      {children}
    </div>
  );

  const barColor =
    trackConf > 0.85 ? "#34d399" : trackConf > 0.6 ? "#fbbf24" : "#f87171";

  const proximity = intel?.proximity;
  const encounter = intel?.encounter;
  const approach = intel?.approach_departure;
  const events = intel?.events || [];
  const routeDevs = intel?.route_deviations || [];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        fontSize: "12px",
        color: "#e4e4e7",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
          background: "rgba(10, 15, 26, 0.4)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "9px",
              color: "#64748b",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "monospace",
              marginBottom: "4px",
            }}
          >
            Vessel Intelligence
          </div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: vessel.is_candidate ? "#f87171" : "#e2e8f0",
              lineHeight: 1.2,
            }}
          >
            {vessel.name}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
            {vessel.is_candidate && (
              <span
                style={{
                  padding: "2px 6px",
                  background: "rgba(244,63,94,0.15)",
                  border: "1px solid rgba(244,63,94,0.35)",
                  borderRadius: "4px",
                  fontSize: "9px",
                  color: "#f87171",
                  letterSpacing: "0.5px",
                  fontFamily: "monospace",
                  fontWeight: 600,
                }}
              >
                CANDIDATE
              </span>
            )}
            <span
              style={{
                padding: "2px 6px",
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.3)",
                borderRadius: "4px",
                fontSize: "9px",
                color: "#38bdf8",
                textTransform: "uppercase",
                fontFamily: "monospace",
              }}
            >
              {vessel.vessel_type}
            </span>
          </div>
        </div>
        <button
          onClick={() => setSelectedVessel(null)}
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#a1a1aa",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "4px 16px",
          gap: "6px",
          background: "rgba(10, 15, 26, 0.2)",
        }}
      >
        <button
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "5px 8px",
            background: activeTab === "overview" ? "rgba(56,189,248,0.2)" : "transparent",
            border: "none",
            borderRadius: "4px",
            color: activeTab === "overview" ? "#38bdf8" : "#94a3b8",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("proximity")}
          style={{
            padding: "5px 8px",
            background: activeTab === "proximity" ? "rgba(56,189,248,0.2)" : "transparent",
            border: "none",
            borderRadius: "4px",
            color: activeTab === "proximity" ? "#38bdf8" : "#94a3b8",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Proximity & Spill
        </button>
        <button
          onClick={() => setActiveTab("events")}
          style={{
            padding: "5px 8px",
            background: activeTab === "events" ? "rgba(56,189,248,0.2)" : "transparent",
            border: "none",
            borderRadius: "4px",
            color: activeTab === "events" ? "#38bdf8" : "#94a3b8",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Events ({events.length + routeDevs.length})
        </button>
        <button
          onClick={() => setActiveTab("behaviour")}
          style={{
            padding: "5px 8px",
            background: activeTab === "behaviour" ? "rgba(56,189,248,0.2)" : "transparent",
            border: "none",
            borderRadius: "4px",
            color: activeTab === "behaviour" ? "#38bdf8" : "#94a3b8",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Behaviour ({behProfile?.behaviour_events?.length ?? 0})
        </button>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <>
            <SectionTitle>Vessel Identity</SectionTitle>
            <InfoRow label="MMSI" value={vessel.mmsi} />
            <InfoRow label="Flag State" value={vessel.flag_state} />
            <InfoRow
              label="Dimensions"
              value={
                vessel.length_m && vessel.width_m
                  ? `${vessel.length_m}m × ${vessel.width_m}m`
                  : "—"
              }
            />
            <InfoRow label="Destination" value={vessel.destination} />

            {currentPoint && (
              <>
                <SectionTitle>Current Position (Timeline)</SectionTitle>
                <InfoRow
                  label="Coordinates"
                  value={`${currentPoint.lat.toFixed(4)}°, ${currentPoint.lon.toFixed(4)}°`}
                />
                <InfoRow
                  label="Speed"
                  value={`${(currentPoint.speed_knots ?? 0).toFixed(1)} kn`}
                />
                <InfoRow
                  label="Course / Heading"
                  value={`${(currentPoint.course_deg ?? 0).toFixed(0)}° / ${(currentPoint.heading_deg ?? 0).toFixed(0)}°`}
                />
                <InfoRow
                  label="Status"
                  value={currentPoint.is_reconstructed ? "RECONSTRUCTED (GAP)" : "OBSERVED"}
                  accent={currentPoint.is_reconstructed ? "#fbbf24" : "#34d399"}
                />
              </>
            )}

            <SectionTitle>Track Quality</SectionTitle>
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Confidence
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: barColor,
                    fontWeight: 700,
                  }}
                >
                  {(trackConf * 100).toFixed(1)}%
                </span>
              </div>
              <div
                style={{
                  height: "4px",
                  background: "#1e293b",
                  borderRadius: "2px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${trackConf * 100}%`,
                    background: barColor,
                    borderRadius: "2px",
                  }}
                />
              </div>
            </div>

            <InfoRow label="Total AIS Points" value={totalPoints} />
            <InfoRow label="Observed Points" value={obsPoints} accent="#34d399" />
            <InfoRow
              label="Reconstructed Points"
              value={recPoints}
              accent={recPoints > 0 ? "#fbbf24" : undefined}
            />
            <InfoRow
              label="Max Gap Duration"
              value={maxGap > 0 ? `${maxGap.toFixed(1)} hrs` : "None"}
              accent={maxGap > 0 ? "#fbbf24" : undefined}
            />
          </>
        )}

        {/* TAB 2: PROXIMITY & SPILL ENCOUNTER */}
        {activeTab === "proximity" && (
          <>
            <SectionTitle>Closest Approach to Origin</SectionTitle>
            {proximity?.min_distance_km !== undefined && proximity.min_distance_km !== null ? (
              <>
                <InfoRow
                  label="Min Distance"
                  value={`${proximity.min_distance_km.toFixed(2)} km`}
                  accent={proximity.min_distance_km < 10 ? "#f87171" : "#38bdf8"}
                />
                <InfoRow
                  label="Time of CPA"
                  value={
                    proximity.closest_approach_time
                      ? String(proximity.closest_approach_time).replace("T", " ").substring(0, 16) + " UTC"
                      : "—"
                  }
                />
                <InfoRow
                  label="CPA Coordinates"
                  value={
                    proximity.closest_approach_lat !== null && proximity.closest_approach_lon !== null
                      ? `${proximity.closest_approach_lat.toFixed(4)}°, ${proximity.closest_approach_lon.toFixed(4)}°`
                      : "—"
                  }
                />
              </>
            ) : (
              <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "11px", padding: "6px 0" }}>
                Calculating proximity metrics...
              </div>
            )}

            <SectionTitle>Spill Zone Encounter</SectionTitle>
            {encounter ? (
              <>
                <InfoRow
                  label="Encounter Status"
                  value={encounter.entered_spill_zone ? "ENTERED ZONE" : "OUTSIDE ZONE"}
                  accent={encounter.entered_spill_zone ? "#f87171" : "#34d399"}
                />
                {encounter.entered_spill_zone && (
                  <>
                    <InfoRow
                      label="Encounter Duration"
                      value={`${encounter.encounter_duration_minutes.toFixed(0)} mins`}
                      accent="#fbbf24"
                    />
                    <InfoRow
                      label="Distance in Zone"
                      value={`${encounter.distance_travelled_inside_km.toFixed(2)} km`}
                    />
                    <InfoRow
                      label="Zone Entry Time"
                      value={
                        encounter.entry_time
                          ? String(encounter.entry_time).replace("T", " ").substring(0, 16) + " UTC"
                          : "—"
                      }
                    />
                    <InfoRow
                      label="Zone Exit Time"
                      value={
                        encounter.exit_time
                          ? String(encounter.exit_time).replace("T", " ").substring(0, 16) + " UTC"
                          : "—"
                      }
                    />
                  </>
                )}
              </>
            ) : (
              <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "11px", padding: "6px 0" }}>
                Analyzing encounter geometry...
              </div>
            )}

            <SectionTitle>Approach & Departure Vectors</SectionTitle>
            {approach ? (
              <>
                <InfoRow
                  label="Approach Bearing"
                  value={
                    approach.approach_direction_deg !== null
                      ? `${approach.approach_direction_deg.toFixed(1)}°`
                      : "—"
                  }
                />
                <InfoRow
                  label="Approach Speed"
                  value={
                    approach.approach_speed_knots !== null
                      ? `${approach.approach_speed_knots.toFixed(1)} kn`
                      : "—"
                  }
                />
                <InfoRow
                  label="Departure Bearing"
                  value={
                    approach.departure_direction_deg !== null
                      ? `${approach.departure_direction_deg.toFixed(1)}°`
                      : "—"
                  }
                />
                <InfoRow
                  label="Departure Speed"
                  value={
                    approach.departure_speed_knots !== null
                      ? `${approach.departure_speed_knots.toFixed(1)} kn`
                      : "—"
                  }
                />
              </>
            ) : (
              <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "11px", padding: "6px 0" }}>
                Calculating approach dynamics...
              </div>
            )}

            {/* Relevance Explanation */}
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                background: "rgba(56,189,248,0.06)",
                border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: "6px",
                fontSize: "11px",
                color: "#94a3b8",
                lineHeight: 1.4,
              }}
            >
              <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: "3px" }}>
                Deterministic Relevance:
              </div>
              {proximity?.min_distance_km !== undefined && proximity.min_distance_km < 15 ? (
                <span>
                  High spatial correlation. Vessel passed within{" "}
                  <strong style={{ color: "#f87171" }}>
                    {proximity.min_distance_km.toFixed(1)} km
                  </strong>{" "}
                  of estimated spill origin.{" "}
                  {encounter?.entered_spill_zone
                    ? `Direct encounter recorded with ${encounter.encounter_duration_minutes.toFixed(0)} min dwell time.`
                    : "Track passes near the perimeter of the detection zone."}
                </span>
              ) : (
                <span>
                  Distance to origin exceeds priority threshold. Low correlation with immediate discharge event.
                </span>
              )}
            </div>
          </>
        )}

        {/* TAB 3: TRAJECTORY EVENTS */}
        {activeTab === "events" && (
          <div>
            <SectionTitle>Detected Maneuvers & Events</SectionTitle>
            {events.length === 0 && routeDevs.length === 0 ? (
              <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "11px", padding: "8px 0" }}>
                No sharp turns, sudden stops, or route deviations detected. Vessel maintained standard transit.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {events.map((ev: any, idx: number) => {
                  const isTurn = ev.event_type === "SHARP_TURN";
                  const isStop = ev.event_type === "SUDDEN_STOP";
                  const badgeColor = isTurn ? "#f59e0b" : isStop ? "#ef4444" : "#38bdf8";
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: "6px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: `${badgeColor}20`,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}40`,
                          }}
                        >
                          {ev.event_type}
                        </span>
                        <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#64748b" }}>
                          {ev.timestamp ? String(ev.timestamp).replace("T", " ").substring(11, 16) + " UTC" : "—"}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#cbd5e1" }}>
                        {ev.explanation}
                      </div>
                    </div>
                  );
                })}

                {routeDevs.map((dev: any, idx: number) => (
                  <div
                    key={`dev-${idx}`}
                    style={{
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "9px",
                          fontFamily: "monospace",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(168,85,247,0.2)",
                          color: "#c084fc",
                          border: "1px solid rgba(168,85,247,0.4)",
                        }}
                      >
                        ROUTE DEVIATION
                      </span>
                      <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#64748b" }}>
                        {dev.timestamp ? String(dev.timestamp).replace("T", " ").substring(11, 16) + " UTC" : "—"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#cbd5e1" }}>
                      {dev.explanation}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DETERMINISTIC BEHAVIOUR ANALYSIS (PHASE 8) */}
        {activeTab === "behaviour" && (
          <div>
            {!behProfile ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                Loading deterministic behaviour profile...
              </div>
            ) : (
              <>
                {/* 1. KINEMATICS & SPEED PROFILE */}
                <SectionTitle>Kinematics & Speed Profile</SectionTitle>
                <InfoRow
                  label="Average / Median Speed"
                  value={`${(behProfile.speed_profile?.average_speed_knots ?? 0).toFixed(1)} / ${(behProfile.speed_profile?.median_speed_knots ?? 0).toFixed(1)} kn`}
                />
                <InfoRow
                  label="Min / Max Speed"
                  value={`${(behProfile.speed_profile?.min_speed_knots ?? 0).toFixed(1)} / ${(behProfile.speed_profile?.max_speed_knots ?? 0).toFixed(1)} kn`}
                />
                <InfoRow
                  label="Speed Variance"
                  value={`${(behProfile.speed_profile?.variance_knots ?? 0).toFixed(2)} kn²`}
                />
                <InfoRow
                  label="Active Transit Duration"
                  value={`${(behProfile.speed_profile?.active_duration_hours ?? 0).toFixed(1)} hrs`}
                  accent="#34d399"
                />
                <InfoRow
                  label="Stationary Duration"
                  value={`${(behProfile.speed_profile?.stationary_duration_hours ?? 0).toFixed(1)} hrs`}
                  accent={(behProfile.speed_profile?.stationary_duration_hours ?? 0) > 0 ? "#f87171" : undefined}
                />
                <InfoRow
                  label="Low-Speed Duration"
                  value={`${(behProfile.speed_profile?.low_speed_duration_hours ?? 0).toFixed(1)} hrs`}
                  accent={(behProfile.speed_profile?.low_speed_duration_hours ?? 0) > 0 ? "#fbbf24" : undefined}
                />
                <InfoRow
                  label="Speed Drop Events"
                  value={behProfile.speed_profile?.speed_drop_events_count ?? 0}
                  accent={(behProfile.speed_profile?.speed_drop_events_count ?? 0) > 0 ? "#fbbf24" : undefined}
                />
                <InfoRow
                  label="Speed Increase Events"
                  value={behProfile.speed_profile?.speed_increase_events_count ?? 0}
                />

                {/* 2. COURSE & HEADING PROFILE */}
                <SectionTitle>Course & Maneuvering Profile</SectionTitle>
                <InfoRow
                  label="Mean Heading (Circular)"
                  value={`${(behProfile.course_profile?.circular_mean_heading_deg ?? 0).toFixed(0)}°`}
                />
                <InfoRow
                  label="Heading Consistency"
                  value={`${((behProfile.course_profile?.heading_consistency ?? 0) * 100).toFixed(1)}%`}
                  accent={(behProfile.course_profile?.heading_consistency ?? 0) > 0.8 ? "#34d399" : "#fbbf24"}
                />
                <InfoRow
                  label="Turn Events Count"
                  value={behProfile.course_profile?.turn_events_count ?? 0}
                />
                <InfoRow
                  label="Sharp Turns (≥ 45°)"
                  value={behProfile.course_profile?.sharp_turns_count ?? 0}
                  accent={(behProfile.course_profile?.sharp_turns_count ?? 0) > 0 ? "#f87171" : undefined}
                />
                <InfoRow
                  label="Zigzag Trajectory Pattern"
                  value={behProfile.course_profile?.zigzag_detected ? "DETECTED" : "None"}
                  accent={behProfile.course_profile?.zigzag_detected ? "#fbbf24" : "#94a3b8"}
                />

                {/* 3. SPILL INTERACTION METRICS */}
                <SectionTitle>Spill & Origin Zone Interaction</SectionTitle>
                <InfoRow
                  label="Closest Approach Distance"
                  value={
                    behProfile.spill_interaction?.closest_approach_distance_km != null
                      ? `${behProfile.spill_interaction.closest_approach_distance_km.toFixed(2)} km`
                      : "—"
                  }
                  accent={
                    (behProfile.spill_interaction?.closest_approach_distance_km ?? 999) <= 8.4
                      ? "#f87171"
                      : "#38bdf8"
                  }
                />
                <InfoRow
                  label="Closest Approach Time"
                  value={
                    behProfile.spill_interaction?.closest_approach_timestamp
                      ? String(behProfile.spill_interaction.closest_approach_timestamp).replace("T", " ").substring(0, 16) + " UTC"
                      : "—"
                  }
                />
                <InfoRow
                  label="Spill Zone Delineation"
                  value={behProfile.spill_interaction?.entered_spill_zone ? "INTERSECTED" : "Outside"}
                  accent={behProfile.spill_interaction?.entered_spill_zone ? "#f87171" : "#94a3b8"}
                />
                <InfoRow
                  label="Spill-Zone Dwell Time"
                  value={`${(behProfile.spill_interaction?.dwell_time_inside_spill_hours ?? 0).toFixed(1)} hrs`}
                  accent={(behProfile.spill_interaction?.dwell_time_inside_spill_hours ?? 0) > 0 ? "#f87171" : undefined}
                />
                <InfoRow
                  label="Approach / Departure Bearing"
                  value={`${behProfile.spill_interaction?.approach_bearing_deg != null ? behProfile.spill_interaction.approach_bearing_deg.toFixed(0) + "°" : "—"} / ${behProfile.spill_interaction?.departure_bearing_deg != null ? behProfile.spill_interaction.departure_bearing_deg.toFixed(0) + "°" : "—"}`}
                />

                {/* 4. CHRONOLOGICAL BEHAVIOUR TIMELINE */}
                <SectionTitle>
                  Chronological Event Stream ({behProfile.behaviour_events?.length ?? 0})
                </SectionTitle>
                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "8px" }}>
                  Click an event to focus map view and inspect anomaly coordinates.
                </div>

                {(!behProfile.behaviour_events || behProfile.behaviour_events.length === 0) ? (
                  <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "6px", textAlign: "center", color: "#94a3b8", fontSize: "11px" }}>
                    No anomalous behaviour events detected along vessel track.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {behProfile.behaviour_events.map((ev, i) => {
                      const isEvSelected = selectedBehaviourEvent?.id === ev.id || (
                        selectedBehaviourEvent?.timestamp === ev.timestamp &&
                        selectedBehaviourEvent?.event_type === ev.event_type
                      );

                      let evColor = "#38bdf8";
                      if (ev.event_type === "SPEED_DROP" || ev.event_type === "STATIONARY_PERIOD") evColor = "#f43f5e";
                      else if (ev.event_type === "SHARP_TURN" || ev.event_type === "LOITERING") evColor = "#f59e0b";
                      else if (ev.event_type === "SPILL_ZONE_ENTRY" || ev.event_type === "SPILL_ZONE_EXIT") evColor = "#a855f7";
                      else if (ev.event_type === "CLOSE_APPROACH") evColor = "#22d3ee";

                      return (
                        <div
                          key={ev.id || `bev-${i}`}
                          onClick={() => {
                            selectBehaviourEvent(ev);
                            if (ev.latitude != null && ev.longitude != null) {
                              onFlyTo?.(ev.longitude, ev.latitude, 11);
                            }
                          }}
                          style={{
                            padding: "8px 10px",
                            background: isEvSelected ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.03)",
                            border: isEvSelected ? `1px solid ${evColor}` : "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span
                              style={{
                                fontSize: "9px",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: `${evColor}25`,
                                color: evColor,
                                border: `1px solid ${evColor}50`,
                              }}
                            >
                              {ev.event_type.replace(/_/g, " ")}
                            </span>
                            <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#64748b" }}>
                              {ev.timestamp ? String(ev.timestamp).replace("T", " ").substring(11, 16) + " UTC" : "—"}
                            </span>
                          </div>

                          <div style={{ fontSize: "11px", color: "#e2e8f0", lineHeight: 1.3, marginBottom: "4px" }}>
                            {ev.description}
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", fontFamily: "monospace", color: "#94a3b8" }}>
                            <span>
                              {ev.measured_value != null && ev.threshold != null ? (
                                <>Val: <strong style={{ color: "#e2e8f0" }}>{ev.measured_value.toFixed(1)}</strong> (Thresh: {ev.threshold.toFixed(1)} {ev.unit ?? ""})</>
                              ) : (
                                <>Coords: {ev.latitude?.toFixed(3)}°, {ev.longitude?.toFixed(3)}°</>
                              )}
                            </span>
                            {ev.severity && (
                              <span style={{ color: ev.severity === "HIGH" ? "#f87171" : ev.severity === "MEDIUM" ? "#fbbf24" : "#38bdf8", fontWeight: 700 }}>
                                {ev.severity}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
