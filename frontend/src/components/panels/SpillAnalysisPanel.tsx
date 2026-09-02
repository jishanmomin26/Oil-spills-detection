
import { useIncidentStore } from '../../store/useIncidentStore';

export const SpillAnalysisPanel = () => {
    const { spills, incident } = useIncidentStore();

    if (!incident || spills.length === 0) return null;

    const spill = spills[0];

    const lookalikeFactors = [
        { name: "Low Wind Area", prob: spill.low_wind_probability ?? 0 },
        { name: "Ship Wake", prob: spill.ship_wake_probability ?? 0 },
        { name: "Rain / Weather Artifact", prob: spill.rain_artifact_probability ?? 0 },
        { name: "Biological Film", prob: spill.biological_film_probability ?? 0 },
    ];

    const oilProb = spill.oil_probability ?? 0;
    const isHighConfidence = oilProb > 0.8;

    return (
        <div style={{
            width: '320px',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
            color: '#e4e4e7',
            maxHeight: '80vh',
            overflowY: 'auto',
            fontSize: '13px',
            marginTop: '16px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>&#9888;</span>
                <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Spill Characterization</h2>
            </div>

            {/* General Info */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <InfoBox label="Area (km²)" value={(spill.area_km2 ?? 0).toFixed(2)} />
                    <InfoBox label="Confidence" value={`${((spill.confidence ?? 0) * 100).toFixed(1)}%`} />
                    <InfoBox label="Severity" value={spill.estimated_severity ?? 'UNKNOWN'} highlight={spill.estimated_severity === 'HIGH' || spill.estimated_severity === 'CRITICAL'} />
                    <InfoBox label="Est. Age" value={`${(spill.estimated_age_hours ?? 0).toFixed(1)} hrs`} />
                </div>
            </div>

            {/* Look-alike Analysis */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#a1a1aa', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                    Look-Alike Analysis
                </div>

                <div style={{ padding: '10px', background: isHighConfidence ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${isHighConfidence ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: isHighConfidence ? '#34d399' : '#fbbf24' }}>Oil Probability</span>
                        <span style={{ fontFamily: 'monospace' }}>{(oilProb * 100).toFixed(1)}%</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lookalikeFactors.map((factor, idx) => (
                        <div key={idx} style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '6px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                                <span style={{ color: '#a1a1aa' }}>{factor.name}</span>
                                <span style={{ fontFamily: 'monospace', color: factor.prob > 0.3 ? '#fbbf24' : '#71717a' }}>
                                    {(factor.prob * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div style={{ height: '3px', background: '#27272a', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.max(factor.prob * 100, 2)}%`,
                                    background: factor.prob > 0.3 ? '#fbbf24' : '#52525b',
                                    borderRadius: '3px',
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ fontSize: '10px', color: '#71717a', fontStyle: 'italic', lineHeight: 1.4, marginTop: '16px' }}>
                Note: System identifies look-alike factors but does not definitively prove spill reality. Manual verification required. [DEMO DATA]
            </div>
        </div>
    );
};

const InfoBox = ({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) => (
    <div style={{
        padding: '8px',
        background: highlight ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${highlight ? 'rgba(244,63,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    }}>
        <div style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: highlight ? '#fb7185' : '#e4e4e7', fontFamily: 'monospace' }}>{value}</div>
    </div>
);
