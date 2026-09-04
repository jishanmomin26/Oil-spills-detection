import { useEffect } from "react";
import { useIncidentStore } from "../../store/useIncidentStore";

export const TimelineControl = () => {
  const {
    minTimestamp,
    maxTimestamp,
    currentTimestamp,
    setCurrentTimestamp,
    isPlaying,
    togglePlayback,
    playbackSpeed,
    setPlaybackSpeed,
  } = useIncidentStore();

  const speedMultiplier = playbackSpeed || 1;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && currentTimestamp !== null && maxTimestamp !== null) {
      interval = setInterval(() => {
        // Base step is 15 minutes, accelerated by playback speed
        const step = 15 * 60 * 1000 * speedMultiplier;
        const next = currentTimestamp + step;
        if (next >= maxTimestamp) {
          setCurrentTimestamp(maxTimestamp);
          togglePlayback();
        } else {
          setCurrentTimestamp(next);
        }
      }, 120);
    }
    return () => clearInterval(interval);
  }, [
    isPlaying,
    currentTimestamp,
    maxTimestamp,
    speedMultiplier,
    setCurrentTimestamp,
    togglePlayback,
  ]);

  if (!minTimestamp || !maxTimestamp || !currentTimestamp) return null;

  const progress =
    ((currentTimestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * 100;
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return d.toISOString().replace("T", " ").substring(0, 16) + " UTC";
  };

  const handleStep = (hours: number) => {
    const newTs = Math.min(
      Math.max(currentTimestamp + hours * 3600 * 1000, minTimestamp),
      maxTimestamp
    );
    setCurrentTimestamp(newTs);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "760px",
        padding: "14px 20px",
        background: "rgba(10, 15, 26, 0.85)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "14px",
        zIndex: 50,
        color: "#e4e4e7",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
      }}
    >
      {/* Upper bar: Play/Pause, Step buttons, Timestamp, and Speed Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "10px",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Step Back 1h */}
          <button
            onClick={() => handleStep(-1)}
            title="Step back 1 hour"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.06)",
              color: "#94a3b8",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            -1h
          </button>

          {/* Play / Pause button */}
          <button
            onClick={togglePlayback}
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: isPlaying
                ? "rgba(239,68,68,0.2)"
                : "rgba(14,165,233,0.25)",
              color: isPlaying ? "#f87171" : "#38bdf8",
              border: isPlaying
                ? "1px solid rgba(239,68,68,0.5)"
                : "1px solid rgba(14,165,233,0.5)",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          {/* Step Forward 1h */}
          <button
            onClick={() => handleStep(1)}
            title="Step forward 1 hour"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.06)",
              color: "#94a3b8",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +1h
          </button>

          {/* Current Time Display */}
          <div style={{ marginLeft: "6px" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "13px",
                fontWeight: 700,
                color: "#38bdf8",
                letterSpacing: "0.5px",
              }}
            >
              {fmt(currentTimestamp)}
            </div>
          </div>
        </div>

        {/* Speed Controls: 1x, 2x, 5x, 10x */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
            Speed:
          </span>
          {[1, 2, 5, 10].map((spd) => {
            const isSelected = speedMultiplier === spd;
            return (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                style={{
                  padding: "3px 8px",
                  borderRadius: "5px",
                  border: isSelected
                    ? "1px solid #38bdf8"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: isSelected
                    ? "rgba(56,189,248,0.25)"
                    : "rgba(255,255,255,0.04)",
                  color: isSelected ? "#38bdf8" : "#94a3b8",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {spd}x
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrubber track */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "6px",
          background: "#1e293b",
          borderRadius: "4px",
          marginTop: "6px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #0284c7, #38bdf8)",
            borderRadius: "4px",
            boxShadow: "0 0 8px rgba(56,189,248,0.5)",
          }}
        />
        <input
          type="range"
          min={minTimestamp}
          max={maxTimestamp}
          value={currentTimestamp}
          onChange={(e) => setCurrentTimestamp(Number(e.target.value))}
          style={{
            position: "absolute",
            top: "-4px",
            left: 0,
            width: "100%",
            height: "14px",
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </div>

      {/* Bounds Labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#64748b",
          marginTop: "6px",
        }}
      >
        <span>Start: {fmt(minTimestamp)}</span>
        <span>End: {fmt(maxTimestamp)}</span>
      </div>
    </div>
  );
};
