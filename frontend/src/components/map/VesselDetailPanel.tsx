import React from 'react';
import { useIncidentStore } from '../../store/useIncidentStore';

export const VesselDetailPanel = () => {
    const { selectedVesselId, setSelectedVessel, vessels, tracks, currentTimestamp } = useIncidentStore();

    if (!selectedVesselId) return null;

    const vessel = vessels.find(v => v.id === selectedVesselId);
    const track = tracks.find(t => t.vessel_id === selectedVesselId);

    if (!vessel) return null;

    // Find the closest AIS point to current timeline
    const SNAP_WIN = 2 * 60 * 60 * 1000;
    let currentPoint = null;
    let minDiff = Infinity;
    if (track && currentTimestamp) {
        for (const pt of track.points) {
            if (!pt.timestamp) continue;
            const diff = Math.abs(new Date(pt.timestamp).getTime() - currentTimestamp);
            if (diff < minDiff && diff < SNAP_WIN) { minDiff = diff; currentPoint = pt; }
        }
    }

    // Compute track stats
    const totalPoints = track?.points.length ?? 0;
    const recPoints = track?.points.filter(p => p.is_reconstructed).length ?? 0;
    const obsPoints = totalPoints - recPoints;
    const trackConf = totalPoints > 0 ? (obsPoints / totalPoints) : 0;

    // Compute max gap
    let maxGap = 0;
    if (track) {
        for (const pt of track.points) {
            if ((pt.gap_duration_hrs ?? 0) > maxGap) maxGap = pt.gap_duration_hrs ?? 0;
        }
    }

    const InfoRow = ({ label, value, accent }: { label: string; value: any; accent?: string }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', color: '#71717a' }}>{label}</span>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: accent ?? '#d4d4d8', fontWeight: 600, textAlign: 'right' }}>{value ?? '—'}</span>
        </div>
    );

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <div style={{ fontSize: '9px', color: '#52525b', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'monospace', margin: '12px 0 6px 0' }}>
            {children}
        </div>
    );

    const barColor = trackConf > 0.85 ? '#34d399' : trackConf > 0.6 ? '#fbbf24' : '#f87171';

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '280px',
            height: '100%',
            background: 'rgba(9,9,11,0.92)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            fontSize: '12px',
            color: '#e4e4e7',
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px',
            }}>
                <div>
                    <div style={{ fontSize: '9px', color: '#52525b', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '4px' }}>
                        Selected Vessel
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: vessel.is_candidate ? '#f87171' : '#e4e4e7', lineHeight: 1.2 }}>
                        {vessel.name}
                    </div>
                    {vessel.is_candidate && (
                        <div style={{ marginTop: '4px', display: 'inline-block', padding: '2px 8px', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '4px', fontSize: '9px', color: '#f87171', letterSpacing: '1px', fontFamily: 'monospace' }}>
                            HIGH PRIORITY CANDIDATE
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setSelectedVessel(null)}
                    style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#a1a1aa', cursor: 'pointer', fontSize: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >✕</button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
                <SectionTitle>Vessel Identity</SectionTitle>
                <InfoRow label="MMSI" value={vessel.mmsi} />
                <InfoRow label="Type" value={vessel.vessel_type} />
                <InfoRow label="Flag State" value={vessel.flag_state} />
                <InfoRow label="Length" value={vessel.length_m ? `${vessel.length_m} m` : '—'} />
                <InfoRow label="Width" value={vessel.width_m ? `${vessel.width_m} m` : '—'} />
                <InfoRow label="Destination" value={vessel.destination} />

                {currentPoint && (
                    <>
                        <SectionTitle>Current AIS State</SectionTitle>
                        <InfoRow label="Position (Lat)" value={currentPoint.lat.toFixed(5) + '°'} />
                        <InfoRow label="Position (Lon)" value={currentPoint.lon.toFixed(5) + '°'} />
                        <InfoRow label="Speed" value={`${(currentPoint.speed_knots ?? 0).toFixed(1)} kn`} />
                        <InfoRow label="Course" value={`${(currentPoint.course_deg ?? 0).toFixed(1)}°`} />
                        <InfoRow label="Heading" value={`${(currentPoint.heading_deg ?? 0).toFixed(1)}°`} />
                        <InfoRow
                            label="AIS Status"
                            value={currentPoint.is_reconstructed ? 'RECONSTRUCTED' : 'OBSERVED'}
                            accent={currentPoint.is_reconstructed ? '#fbbf24' : '#34d399'}
                        />
                        {(currentPoint.gap_duration_hrs ?? 0) > 0 && (
                            <InfoRow label="Gap Duration" value={`${(currentPoint.gap_duration_hrs ?? 0).toFixed(1)} hrs`} accent="#fbbf24" />
                        )}
                        <InfoRow label="Timestamp" value={currentPoint.timestamp ? currentPoint.timestamp.substring(0, 16).replace('T', ' ') + ' UTC' : '—'} />
                    </>
                )}

                <SectionTitle>Track Quality</SectionTitle>

                {/* Confidence bar */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#71717a' }}>Track Confidence</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: barColor, fontWeight: 700 }}>
                            {(trackConf * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div style={{ height: '4px', background: '#27272a', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: `${trackConf * 100}%`, background: barColor, borderRadius: '2px', transition: 'width 0.3s' }} />
                    </div>
                </div>

                <InfoRow label="Total AIS Points" value={totalPoints} />
                <InfoRow label="Observed Points" value={obsPoints} accent="#34d399" />
                <InfoRow label="Reconstructed Points" value={recPoints} accent={recPoints > 0 ? '#fbbf24' : undefined} />
                <InfoRow label="Max Gap Duration" value={maxGap > 0 ? `${maxGap.toFixed(1)} hrs` : 'None'} accent={maxGap > 0 ? '#fbbf24' : undefined} />
                {track?.start_time && <InfoRow label="Track Start" value={track.start_time.substring(0, 16).replace('T', ' ') + ' UTC'} />}
                {track?.end_time && <InfoRow label="Track End" value={track.end_time.substring(0, 16).replace('T', ' ') + ' UTC'} />}

                <div style={{ marginTop: '14px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', color: '#52525b', fontStyle: 'italic', lineHeight: 1.5 }}>
                    Track confidence = observed/total AIS points. Reconstructed points indicate AIS transmission gaps filled by linear interpolation. [SIMULATED / DEMO DATA]
                </div>
            </div>
        </div>
    );
};
