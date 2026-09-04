import React from 'react';
import { useIncidentStore } from '../../store/useIncidentStore';

interface SatelliteEvidencePanelProps {
  onFlyTo?: (coord: [number, number], zoom?: number) => void;
}

export const SatelliteEvidencePanel: React.FC<SatelliteEvidencePanelProps> = ({ onFlyTo }) => {
  const {
    satelliteAnalysis,
    selectedObservationId,
    setSelectedObservationId,
    isSatelliteLoading,
    satelliteError,
    fetchSatelliteAnalysis,
    incident,
  } = useIncidentStore();

  if (isSatelliteLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
        <div style={{ fontSize: '20px', marginBottom: '8px' }}>🛰️</div>
        <div>Loading multi-temporal satellite analysis...</div>
      </div>
    );
  }

  if (satelliteError || !satelliteAnalysis) {
    return (
      <div style={{ padding: '16px', color: '#f87171', fontSize: '13px' }}>
        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Satellite Analysis Unavailable</div>
        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px' }}>
          {satelliteError || 'No satellite data returned for this incident.'}
        </div>
        {incident && (
          <button
            onClick={() => fetchSatelliteAnalysis(incident.id)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Retry Satellite Fetch
          </button>
        )}
      </div>
    );
  }

  const { summary, observations, evolution_steps, origin_integration, drift_correlation, limitations } =
    satelliteAnalysis;

  const handleObservationClick = (obs: any) => {
    setSelectedObservationId(obs.id);
    if (onFlyTo && obs.centroid_lat && obs.centroid_lon) {
      onFlyTo([obs.centroid_lon, obs.centroid_lat], 10);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '16px',
        overflowY: 'auto',
        color: '#e2e8f0',
        fontSize: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── 1. Header & Provenance Badge ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🛰️</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
              Satellite Evidence
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              {summary.total_observations} Multi-temporal Satellite Passes
            </div>
          </div>
        </div>

        {/* PROVENANCE BADGE: DEMO / SYNTHETIC */}
        <div
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            color: '#fbbf24',
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}
        >
          {satelliteAnalysis.provenance}
        </div>
      </div>

      {/* ── 2. Executive Metrics Summary Grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Passes</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
            {summary.total_observations}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Latest Area</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f43f5e', marginTop: '2px' }}>
            {summary.latest_area_km2 != null ? `${summary.latest_area_km2.toFixed(1)} km²` : 'N/A'}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Net Expansion</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fb923c', marginTop: '2px' }}>
            {summary.net_area_change_km2 != null ? `+${summary.net_area_change_km2.toFixed(1)} km²` : 'N/A'}{' '}
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              ({summary.net_area_growth_pct != null ? `+${summary.net_area_growth_pct.toFixed(0)}%` : ''})
            </span>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Centroid Drift</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
            {summary.total_centroid_displacement_km != null
              ? `${summary.total_centroid_displacement_km.toFixed(1)} km`
              : 'N/A'}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Confidence</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#22d3ee', marginTop: '2px' }}>
            {(summary.average_confidence * 100).toFixed(0)}%
          </div>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Data Quality</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', marginTop: '2px' }}>
            {summary.data_quality}
          </div>
        </div>
      </div>

      {/* ── 3. Observation History List ── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: '#38bdf8',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🛰️</span>
          <span>Observation History</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {observations.map((obs, idx) => {
            const isSelected = obs.id === selectedObservationId;
            const timeStr = new Date(obs.acquisition_time).toUTCString().replace('GMT', 'UTC');

            return (
              <div
                key={obs.id}
                onClick={() => handleObservationClick(obs)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid rgba(56, 189, 248, 0.6)' : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 5px',
                        borderRadius: '3px',
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                        fontFamily: 'monospace',
                      }}
                    >
                      PASS {idx + 1}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: '#f1f5f9' }}>{obs.platform}</span>
                  </div>

                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                    }}
                  >
                    {obs.data_provenance}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px',
                    fontSize: '11px',
                    marginTop: '8px',
                    color: '#94a3b8',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b' }}>Sensor: </span>
                    <span style={{ color: '#cbd5e1' }}>{obs.sensor}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Area: </span>
                    <span style={{ color: '#f43f5e', fontWeight: 600 }}>
                      {obs.stored_area_km2 ? `${obs.stored_area_km2.toFixed(1)} km²` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Conf: </span>
                    <span style={{ color: '#22d3ee', fontWeight: 600 }}>{(obs.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '6px',
                    fontSize: '10px',
                    color: '#64748b',
                    fontFamily: 'monospace',
                  }}
                >
                  <span>{timeStr}</span>
                  <span style={{ color: isSelected ? '#38bdf8' : '#475569' }}>
                    {isSelected ? '● ACTIVE MAP FOCUS' : 'Click to inspect'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Spill Evolution Sequence ── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: '#fb923c',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>📈</span>
          <span>Spill Evolution & Displacement</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {evolution_steps.map((step) => (
            <div
              key={step.step_index}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '6px',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '11px', color: '#f8fafc' }}>
                  Step {step.step_index}: {step.from_platform} → {step.to_platform}
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                  Δt: {step.delta_time_hours} hrs
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '6px',
                  fontSize: '11px',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '8px',
                  borderRadius: '4px',
                  marginBottom: '6px',
                }}
              >
                <div>
                  <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase' }}>Area Change</div>
                  <div style={{ fontWeight: 700, color: step.delta_area_km2 >= 0 ? '#fb923c' : '#10b981' }}>
                    {step.delta_area_km2 >= 0 ? `+${step.delta_area_km2.toFixed(1)}` : step.delta_area_km2.toFixed(1)} km²
                    <span style={{ fontSize: '10px', marginLeft: '4px', color: '#94a3b8' }}>
                      ({step.area_growth_pct >= 0 ? `+${step.area_growth_pct.toFixed(0)}%` : `${step.area_growth_pct.toFixed(0)}%`})
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase' }}>Expansion Rate</div>
                  <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                    {step.expansion_rate_km2_per_hr.toFixed(2)} km²/hr
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase' }}>Displacement</div>
                  <div style={{ fontWeight: 700, color: '#e2e8f0' }}>
                    {step.centroid_displacement_km.toFixed(1)} km @ {step.displacement_bearing_deg.toFixed(0)}° ({step.direction_cardinal})
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '9px', textTransform: 'uppercase' }}>Drift Velocity</div>
                  <div style={{ fontWeight: 700, color: '#10b981' }}>
                    {step.drift_speed_knots.toFixed(2)} kts ({step.drift_speed_kmh.toFixed(1)} km/h)
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                • {step.drift_consistency}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Origin Integration & MetOcean Drift Correlation ── */}
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: '#10b981',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>🎯</span>
          <span>Origin & Drift Correlation</span>
        </div>

        <div
          style={{
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '6px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Estimated Release Origin</span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'monospace',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
              }}
            >
              {origin_integration.provenance}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px',
              fontSize: '11px',
              color: '#cbd5e1',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Coordinates: </span>
              <span style={{ fontFamily: 'monospace' }}>
                {origin_integration.center_lat.toFixed(4)}°N, {origin_integration.center_lon.toFixed(4)}°E
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Uncertainty Radius: </span>
              <span style={{ fontWeight: 700, color: '#34d399' }}>
                {origin_integration.uncertainty_radius_km.toFixed(1)} km
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Distance to Pass 1: </span>
              <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                {origin_integration.distance_to_first_observation_km.toFixed(2)} km
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Agreement Rating: </span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>
                {drift_correlation.model_agreement_rating}
              </span>
            </div>
          </div>

          <div
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              lineHeight: 1.4,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '6px',
            }}
          >
            {drift_correlation.summary}
          </div>
        </div>
      </div>

      {/* ── 6. Limitations & Synthetic Warning Notice ── */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '6px',
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: '#fbbf24',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>⚠️</span>
          <span>Investigative Limitations & Demo Disclosure</span>
        </div>

        <ul
          style={{
            margin: 0,
            paddingLeft: '16px',
            fontSize: '10px',
            color: '#94a3b8',
            lineHeight: 1.5,
          }}
        >
          {limitations.map((lim, i) => (
            <li key={i}>{lim}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
