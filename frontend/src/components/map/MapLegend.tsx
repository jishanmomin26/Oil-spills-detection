import React from 'react';

interface LegendRow {
    symbol: React.ReactNode;
    label: string;
    sublabel?: string;
}

const Dot = ({ color, border, dashed }: { color: string; border?: string; dashed?: boolean }) => (
    <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: color,
        border: border ?? 'none',
        outline: dashed ? `2px dashed ${color}` : 'none',
        outlineOffset: '1px',
        flexShrink: 0,
    }} />
);

const Line = ({ color, dashed }: { color: string; dashed?: boolean }) => (
    <div style={{
        width: '20px', height: '2px',
        background: dashed ? 'none' : color,
        borderTop: dashed ? `2px dashed ${color}` : 'none',
        flexShrink: 0,
    }} />
);

const Poly = ({ fill, border }: { fill: string; border: string }) => (
    <div style={{
        width: '14px', height: '10px',
        background: fill,
        border: `2px solid ${border}`,
        borderRadius: '2px',
        flexShrink: 0,
    }} />
);

const Arrow = ({ color }: { color: string }) => (
    <div style={{ fontSize: '13px', lineHeight: 1, color, flexShrink: 0 }}>→</div>
);

const Ship = ({ color }: { color: string }) => (
    <svg width="12" height="14" viewBox="0 0 12 14" style={{ flexShrink: 0 }}>
        <polygon points="6,1 11,13 6,9 1,13" fill={color} />
    </svg>
);

export const MapLegend = () => {
    const [isOpen, setIsOpen] = React.useState(true);

    const rows: LegendRow[] = [
        { symbol: <Poly fill="rgba(220,38,38,0.35)" border="rgb(255,60,60)" />, label: 'Oil Spill' },
        { symbol: <Poly fill="rgba(16,185,129,0.2)" border="rgb(16,185,129)" />, label: 'Probable Origin' },
        { symbol: <Ship color="#f87171" />, label: 'Candidate Vessel' },
        { symbol: <Ship color="#a0a0b9" />, label: 'Normal Vessel' },
        { symbol: <Ship color="#22d3ee" />, label: 'Selected Vessel' },
        { symbol: <Line color="#38bdf8" />, label: 'Observed AIS Track' },
        { symbol: <Line color="#fbbf24" dashed />, label: 'Reconstructed AIS' },
        { symbol: <Dot color="rgba(245,158,11,0.85)" />, label: 'Hindcast Particle' },
        { symbol: <Dot color="rgba(34,211,238,0.85)" />, label: 'Forecast Particle' },
        { symbol: <Arrow color="#64b4ff" />, label: 'Wind Vector' },
        { symbol: <Arrow color="#10b981" />, label: 'Ocean Current' },
    ];

    return (
        <div style={{
            position: 'absolute', bottom: '100px', left: '14px',
            background: 'rgba(9,9,11,0.88)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: isOpen ? '12px 14px' : '8px 14px',
            backdropFilter: 'blur(10px)',
            zIndex: 25, pointerEvents: 'auto',
            width: '180px',
        }}>
            <div 
                style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    cursor: 'pointer' 
                }}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div style={{ fontSize: '9px', color: '#52525b', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                    Map Legend
                </div>
                <div style={{ fontSize: '10px', color: '#52525b' }}>{isOpen ? '▼' : '▲'}</div>
            </div>
            
            {isOpen && (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
                        {rows.map((row, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '22px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                    {row.symbol}
                                </div>
                                <div>
                                    <div style={{ fontSize: '11px', color: '#d4d4d8', fontFamily: "'Inter', system-ui", lineHeight: 1.2 }}>{row.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '9px', color: '#3f3f46', fontStyle: 'italic' }}>
                        [SIMULATED / DEMO DATA]
                    </div>
                </>
            )}
        </div>
    );
};
