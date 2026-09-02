import { useEffect, useRef, useCallback } from 'react';
import { useIncidentStore } from '../store/useIncidentStore';
import { InvestigationMap } from '../components/map/InvestigationMap';
import { MapControls } from '../components/map/MapControls';
import { MapLegend } from '../components/map/MapLegend';
import { VesselDetailPanel } from '../components/map/VesselDetailPanel';
import { TimelineControl } from '../components/timeline/TimelineControl';
import { FilteringPanel } from '../components/panels/FilteringPanel';
import { SpillAnalysisPanel } from '../components/panels/SpillAnalysisPanel';
import { OriginAnalysisPanel } from '../components/panels/OriginAnalysisPanel';
import { ForecastPanel } from '../components/panels/ForecastPanel';
import { AisReconstructionPanel } from '../components/panels/AisReconstructionPanel';

export const CommandCenter = () => {
    const {
        fetchIncidentData, incident, isLoading, error,
        vessels, drift, tracks, selectedVesselId,
    } = useIncidentStore();

    // We communicate flyTo/resetView imperatively via a shared ref that InvestigationMap can receive
    // Since InvestigationMap uses DeckGL's initialViewState (uncontrolled), we use a ref-based
    // approach: store a callback from InvestigationMap that CommandCenter can call
    const flyToRef = useRef<((lon: number, lat: number, zoom: number) => void) | null>(null);
    const resetViewRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        fetchIncidentData('OCEANTRACE-DEMO-001');
    }, [fetchIncidentData]);

    const handleFlyTo = useCallback((lon: number, lat: number, zoom: number) => {
        flyToRef.current?.(lon, lat, zoom);
    }, []);

    const handleResetView = useCallback(() => {
        resetViewRef.current?.();
    }, []);

    if (error) {
        return (
            <div style={{ width: '100%', height: '100vh', background: '#09090b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠</div>
                <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>SYSTEM ERROR</h2>
                <p style={{ color: '#a1a1aa' }}>{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    style={{ marginTop: '24px', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer' }}
                >
                    REBOOT SYSTEM
                </button>
            </div>
        );
    }

    return (
        <div style={{
            width: '100%', height: '100vh', background: '#09090b',
            display: 'flex', flexDirection: 'column', position: 'relative',
            overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif", color: '#e4e4e7',
        }}>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <header style={{
                height: '52px', background: 'rgba(9,9,11,0.92)', backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 20px', zIndex: 40, position: 'relative', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '6px',
                        background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', boxShadow: '0 0 12px rgba(34,211,238,0.4)',
                    }}>
                        ★
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '2px', lineHeight: 1.2 }}>OCEANTRACE AI</div>
                        <div style={{ fontSize: '9px', color: '#22d3ee', letterSpacing: '1.5px', fontFamily: 'monospace' }}>MARITIME INTELLIGENCE SOC</div>
                    </div>
                </div>

                {incident && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '9px', color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Investigation</div>
                            <div style={{ fontFamily: 'monospace', color: '#d4d4d8' }}>{incident.id}</div>
                        </div>
                        <div style={{
                            padding: '4px 10px',
                            background: 'rgba(239,68,68,0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px',
                        }}>
                            {incident.status.replace('_', ' ')}
                        </div>
                    </div>
                )}
            </header>

            {/* ── Stats Bar ──────────────────────────────────────────────── */}
            {!isLoading && incident && (
                <div style={{
                    height: '30px', background: 'rgba(9,9,11,0.7)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', gap: '24px',
                    padding: '0 20px', fontSize: '11px', fontFamily: 'monospace',
                    color: '#71717a', zIndex: 39, flexShrink: 0,
                }}>
                    <span>Vessels: <span style={{ color: '#d4d4d8' }}>{vessels.length}</span></span>
                    <span>Tracks: <span style={{ color: '#d4d4d8' }}>{tracks.length}</span></span>
                    <span>Drift Sims: <span style={{ color: '#d4d4d8' }}>{drift.length}</span></span>
                    <span>Region: <span style={{ color: '#d4d4d8' }}>{incident.region ?? 'N/A'}</span></span>
                    <span style={{ marginLeft: 'auto', color: '#fbbf24', fontSize: '10px', letterSpacing: '1px' }}>
                        [SIMULATED / DEMO DATA]
                    </span>
                </div>
            )}

            {/* ── Main Content ───────────────────────────────────────────── */}
            <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {/* Map fills entire area */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                    <InvestigationMap
                        onRegisterFlyTo={(fn) => { flyToRef.current = fn; }}
                        onRegisterResetView={(fn) => { resetViewRef.current = fn; }}
                    />
                </div>

                {/* UI Overlays (non-loading) */}
                {!isLoading && (
                    <>
                        {/* Left side panels */}
                        <div style={{
                            position: 'absolute', top: '14px', left: '14px', zIndex: 20,
                            pointerEvents: 'auto', display: 'flex', flexDirection: 'column',
                            gap: '0', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto',
                        }}>
                            <SpillAnalysisPanel />
                            <OriginAnalysisPanel />
                            <ForecastPanel />
                            <FilteringPanel />
                            <AisReconstructionPanel />
                        </div>

                        {/* Map Controls (always top-right) */}
                        <MapControls
                            onFlyTo={handleFlyTo}
                            onResetView={handleResetView}
                        />

                        {/* Legend (bottom-left above timeline) */}
                        <MapLegend />

                        {/* Vessel Detail Panel (right edge, full height) */}
                        {selectedVesselId && (
                            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 22, pointerEvents: 'auto' }}>
                                <VesselDetailPanel />
                            </div>
                        )}

                        {/* Timeline (bottom center) */}
                        <div style={{ pointerEvents: 'auto' }}>
                            <TimelineControl />
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};
