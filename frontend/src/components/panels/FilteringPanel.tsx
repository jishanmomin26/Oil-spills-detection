
import { useIncidentStore } from '../../store/useIncidentStore';

export const FilteringPanel = () => {
    const { filtering, vessels, spills } = useIncidentStore();

    if (!filtering) return null;

    const candidates = vessels.filter(v => v.is_candidate);
    const spill = spills.length > 0 ? spills[0] : null;

    return (
        <div style={{
            width: '300px',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
            color: '#e4e4e7',
            overflowY: 'auto',
            maxHeight: '80vh',
            fontSize: '13px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22d3ee', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>&#9733;</span>
                <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Intelligence Summary</h2>
            </div>

            {/* Spill Info */}
            {spill && (
                <div style={{ marginBottom: '16px', padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
                    <div style={{ color: '#f87171', fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>
                        &#9888; Confirmed Spill
                    </div>
                    <div style={{ fontSize: '11px', color: '#d4d4d8' }}>
                        <div>Confidence: {((spill.confidence ?? 0) * 100).toFixed(1)}%</div>
                        <div>Area: {(spill.area_km2 ?? 0).toFixed(2)} km²</div>
                        <div>Oil Prob: {((spill.oil_probability ?? 0) * 100).toFixed(1)}%</div>
                        <div>Method: {spill.detection_method ?? 'N/A'}</div>
                    </div>
                </div>
            )}

            {/* Filtering Funnel */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#a1a1aa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    Attribution Funnel
                </div>
                <FunnelStep label="Total Monitored" count={filtering.total_vessels} max={filtering.total_vessels} />
                <FunnelStep label="Spatial Filter" count={filtering.spatial_candidates} max={filtering.total_vessels} />
                <FunnelStep label="Temporal Filter" count={filtering.temporal_candidates} max={filtering.total_vessels} />
                <FunnelStep label="Trajectory Match" count={filtering.trajectory_candidates} max={filtering.total_vessels} />
                <FunnelStep label="Behaviour Final" count={filtering.behaviour_candidates} max={filtering.total_vessels} highlight />
            </div>

            {/* Primary Candidates */}
            <div>
                <div style={{ color: '#a1a1aa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    Primary Candidates ({candidates.length})
                </div>
                {candidates.map(c => (
                    <div key={c.id} style={{
                        padding: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        marginBottom: '6px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#22d3ee', fontSize: '12px' }}>{c.name}</span>
                            <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase' }}>{c.vessel_type}</span>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a1a1aa' }}>
                            MMSI: {c.mmsi} | Flag: {c.flag_state}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FunnelStep = ({ label, count, max, highlight = false }: { label: string; count: number; max: number; highlight?: boolean }) => {
    const pct = Math.max((count / max) * 100, 2);
    return (
        <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                <span style={{ color: highlight ? '#22d3ee' : '#a1a1aa', fontWeight: highlight ? 600 : 400 }}>{label}</span>
                <span style={{ fontFamily: 'monospace', color: '#d4d4d8' }}>{count}</span>
            </div>
            <div style={{ height: '4px', background: '#27272a', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: highlight ? '#22d3ee' : '#52525b',
                    borderRadius: '4px',
                    boxShadow: highlight ? '0 0 8px rgba(34,211,238,0.6)' : 'none',
                }} />
            </div>
        </div>
    );
};
