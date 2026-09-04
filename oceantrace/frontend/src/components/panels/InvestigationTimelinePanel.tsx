import React, { useState, useMemo } from 'react';
import { useIncidentStore, type TimelineEventOut, type CorrelationChainOut } from '../../store/useIncidentStore';

interface InvestigationTimelinePanelProps {
  onFlyTo?: (lon: number, lat: number, zoom: number) => void;
}

export const InvestigationTimelinePanel: React.FC<InvestigationTimelinePanelProps> = ({ onFlyTo }) => {
  const {
    incident,
    timelineEvents,
    timelineCorrelations,
    isTimelineLoading,
    timelineError,
    selectedTimelineEventId,
    selectTimelineEvent,
    activeTimelineCategory,
    setTimelineCategory,
    activeTimelineVesselId,
    setTimelineVesselId,
    currentTimestamp,
    vessels,
  } = useIncidentStore();

  const [activeTab, setActiveTab] = useState<'timeline' | 'correlations'>('timeline');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedCorrelationVesselId, setSelectedCorrelationVesselId] = useState<string | null>(null);

  const categories = ['ALL', 'SATELLITE', 'SPILL', 'AIS', 'BEHAVIOUR', 'ENVIRONMENTAL', 'ATTRIBUTION'];

  // Candidate vessels for selector
  const candidateVessels = useMemo(() => {
    return vessels.filter(v => v.is_candidate);
  }, [vessels]);

  // Selected correlation chain
  const activeChain: CorrelationChainOut | undefined = useMemo(() => {
    if (!timelineCorrelations || timelineCorrelations.length === 0) return undefined;
    if (selectedCorrelationVesselId) {
      return timelineCorrelations.find(c => c.vessel_id === selectedCorrelationVesselId) || timelineCorrelations[0];
    }
    return timelineCorrelations[0];
  }, [timelineCorrelations, selectedCorrelationVesselId]);

  // Provenance color helper
  const getProvenanceBadge = (label: string) => {
    switch (label) {
      case 'OBSERVED':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'ESTIMATED':
        return { bg: 'rgba(14, 165, 233, 0.15)', text: '#38bdf8', border: 'rgba(14, 165, 233, 0.3)' };
      case 'MODELLED':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
      case 'FORECAST':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { bg: 'rgba(113, 113, 122, 0.15)', text: '#a1a1aa', border: 'rgba(113, 113, 122, 0.3)' };
    }
  };

  const formatTs = (tsStr: string) => {
    try {
      const d = new Date(tsStr);
      return d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    } catch {
      return tsStr;
    }
  };

  const handleEventClick = (e: TimelineEventOut) => {
    selectTimelineEvent(e.event_id);
    if (e.latitude != null && e.longitude != null && onFlyTo) {
      onFlyTo(e.longitude, e.latitude, 11);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      color: '#e4e4e7',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: '14px',
    }}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '0.5px', color: '#38bdf8' }}>
              INVESTIGATION TIMELINE
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
              {incident?.id || 'ACTIVE INCIDENT'} • {timelineEvents.length} Events • {timelineCorrelations.length} Chains
            </div>
          </div>
          <span style={{
            fontSize: '12px',
            padding: '3px 10px',
            borderRadius: '4px',
            background: 'rgba(56, 189, 248, 0.1)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontFamily: 'monospace'
          }}>
            PHASE 10
          </span>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '6px' }}>
          <button
            onClick={() => setActiveTab('timeline')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'timeline' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              color: activeTab === 'timeline' ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Timeline ({timelineEvents.length})
          </button>
          <button
            onClick={() => setActiveTab('correlations')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'correlations' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
              color: activeTab === 'correlations' ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >
            Evidence Chains ({timelineCorrelations.length})
          </button>
        </div>
      </div>

      {/* ── Main Tab Content ───────────────────────────────────────── */}
      {isTimelineLoading ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>⏳</div>
          <div>Loading investigation timeline...</div>
        </div>
      ) : timelineError ? (
        <div style={{ padding: '16px', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)' }}>
          {timelineError}
        </div>
      ) : activeTab === 'timeline' ? (
        /* ── CHRONOLOGICAL STREAM TAB ── */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Category Filter Chips */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            background: 'rgba(9, 9, 11, 0.4)',
            flexShrink: 0
          }}>
            {categories.map(cat => {
              const isActive = activeTimelineCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setTimelineCategory(cat)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#38bdf8' : '#a1a1aa',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Vessel Filter Dropdown / All Button */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            background: 'rgba(9, 9, 11, 0.2)',
            flexShrink: 0
          }}>
            <span style={{ color: '#71717a', fontSize: '12px', whiteSpace: 'nowrap' }}>Filter Vessel:</span>
            <select
              value={activeTimelineVesselId || ''}
              onChange={(e) => setTimelineVesselId(e.target.value || null)}
              style={{
                flex: 1,
                background: 'rgba(20, 24, 39, 0.9)',
                color: '#e4e4e7',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '4px',
                padding: '5px 8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="">All Vessels ({timelineEvents.length} events)</option>
              {candidateVessels.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.mmsi})
                </option>
              ))}
            </select>
          </div>

          {/* Event Stream List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {timelineEvents.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#71717a' }}>
                No timeline events available for current filter selection.
              </div>
            ) : (
              timelineEvents.map((ev, idx) => {
                const isSelected = selectedTimelineEventId === ev.event_id;
                const isExpanded = expandedEventId === ev.event_id;
                const prov = getProvenanceBadge(ev.data_label);

                // Playback synchronization hint
                const evTsMs = new Date(ev.timestamp).getTime();
                const isPastPlayback = currentTimestamp ? evTsMs <= currentTimestamp : false;

                return (
                  <div
                    key={ev.event_id || idx}
                    onClick={() => handleEventClick(ev)}
                    style={{
                      background: isSelected ? 'rgba(56, 189, 248, 0.12)' : isPastPlayback ? 'rgba(20, 24, 39, 0.85)' : 'rgba(20, 24, 39, 0.45)',
                      border: isSelected ? '1px solid #38bdf8' : isPastPlayback ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                      boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
                    }}
                  >
                    {/* Event Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>
                          {formatTs(ev.timestamp)}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: prov.bg,
                          color: prov.text,
                          border: `1px solid ${prov.border}`,
                          fontWeight: 700,
                          fontFamily: 'monospace'
                        }}>
                          {ev.data_label}
                        </span>
                        {ev.vessel_name && (
                          <span style={{
                            fontSize: '12px',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.08)',
                            color: '#e2e8f0',
                            fontWeight: 600
                          }}>
                            {ev.vessel_name}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: ev.severity === 'HIGH' ? '#f87171' : ev.severity === 'MEDIUM' ? '#fbbf24' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        marginLeft: '6px',
                      }}>
                        {ev.severity || 'INFO'}
                      </span>
                    </div>

                    {/* Event Type & Description */}
                    <div style={{ fontWeight: 700, fontSize: '15px', color: isSelected ? '#38bdf8' : '#f1f5f9', marginBottom: '5px' }}>
                      {ev.event_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5, marginBottom: '6px' }}>
                      {ev.description}
                    </div>

                    {/* Footer Row: Coordinates Pin & Details Accordion Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {ev.latitude != null && ev.longitude != null ? (
                        <div
                          onClick={(evt) => {
                            evt.stopPropagation();
                            handleEventClick(ev);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#38bdf8',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                          }}
                        >
                          <span>📍</span>
                          <span>{ev.latitude.toFixed(3)}°N, {ev.longitude.toFixed(3)}°E</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>No coordinate pin</span>
                      )}

                      <button
                        onClick={(evt) => {
                          evt.stopPropagation();
                          setExpandedEventId(isExpanded ? null : ev.event_id);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        {isExpanded ? 'Hide ▲' : 'Details ▼'}
                      </button>
                    </div>

                    {/* Expandable Traceability Details */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#94a3b8',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}>
                        <div><strong style={{ color: '#cbd5e1' }}>Source Engine:</strong> {ev.source}</div>
                        <div><strong style={{ color: '#cbd5e1' }}>Analytical Phase:</strong> {ev.related_phase}</div>
                        {ev.evidence_reference && (
                          <div><strong style={{ color: '#cbd5e1' }}>Evidence Reference:</strong> {ev.evidence_reference}</div>
                        )}
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div>
                            <strong style={{ color: '#cbd5e1' }}>Parameters:</strong>
                            <pre style={{ margin: '2px 0 0 0', color: '#7dd3fc', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(ev.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                          Verified data record. Correlation implies mathematical-temporal concurrence without establishing legal liability.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ── EVIDENCE CORRELATIONS TAB ── */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {/* Candidate Vessel Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {candidateVessels.map(v => {
              const isSelected = activeChain?.vessel_id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedCorrelationVesselId(v.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 700 : 500,
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                    background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: isSelected ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  {v.name}
                </button>
              );
            })}
          </div>

          {activeChain ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Chain Overview Card */}
              <div style={{
                background: 'rgba(20, 24, 39, 0.7)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#f8fafc' }}>
                    {activeChain.vessel_name} Investigation Chain
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}>
                    Correlation Strength: {Math.round(activeChain.correlation_strength * 100)}%
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                  Spanned: {formatTs(activeChain.start_timestamp)} &rarr; {formatTs(activeChain.end_timestamp)} ({activeChain.event_ids.length} milestone events)
                </div>

                <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>
                  Note: Correlation strength reflects spatial-temporal presence and verified kinematic anomalies. It is strictly separate from the Phase 9 multi-criteria attribution score.
                </div>
              </div>

              {/* Sequential Milestone Flow */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: '#38bdf8', textTransform: 'uppercase' }}>
                  Deterministic Evidence Progression
                </div>

                {activeChain.relationships.map((rel, rIdx) => {
                  const fromEv = timelineEvents.find(e => e.event_id === rel.from_event_id);
                  const toEv = timelineEvents.find(e => e.event_id === rel.to_event_id);

                  return (
                    <div
                      key={rIdx}
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '11px' }}>
                          <span style={{ color: '#38bdf8' }}>{fromEv?.event_type.replace(/_/g, ' ') || 'Origin Event'}</span>
                          <span style={{ color: '#64748b' }}>&rarr;</span>
                          <span style={{ color: '#f1f5f9' }}>{toEv?.event_type.replace(/_/g, ' ') || 'Consequent'}</span>
                        </div>
                        {rel.temporal_delta_hours != null && (
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            +{rel.temporal_delta_hours}h
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '10px', color: '#cbd5e1' }}>
                        {rel.description}
                      </div>

                      {rel.spatial_distance_km != null && (
                        <div style={{ fontSize: '10px', color: '#38bdf8', fontFamily: 'monospace' }}>
                          Separation: {rel.spatial_distance_km} km
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Limitations Section */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '10px',
                color: '#fca5a5'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase' }}>
                  Identified Investigation Limitations:
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                  {activeChain.limitations.map((lim, lIdx) => (
                    <li key={lIdx} style={{ marginBottom: '2px' }}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#71717a' }}>
              No correlation chains synthesized for this incident.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
