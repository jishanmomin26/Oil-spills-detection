import { useEffect } from 'react';
import { useIncidentStore } from '../../store/useIncidentStore';

export const TimelineControl = () => {
    const {
        minTimestamp,
        maxTimestamp,
        currentTimestamp,
        setCurrentTimestamp,
        isPlaying,
        togglePlayback,
    } = useIncidentStore();

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying && currentTimestamp !== null && maxTimestamp !== null) {
            interval = setInterval(() => {
                const step = 15 * 60 * 1000; // 15 min steps
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
    }, [isPlaying, currentTimestamp, maxTimestamp, setCurrentTimestamp, togglePlayback]);

    if (!minTimestamp || !maxTimestamp || !currentTimestamp) return null;

    const progress = ((currentTimestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * 100;
    const fmt = (ts: number) => {
        const d = new Date(ts);
        return d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    };

    return (
        <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '720px',
            padding: '16px 24px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            zIndex: 50,
            color: '#e4e4e7',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={togglePlayback}
                        style={{
                            width: '36px', height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(59,130,246,0.2)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59,130,246,0.4)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#a1a1aa' }}>
                        {fmt(currentTimestamp)}
                    </span>
                </div>
                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#52525b' }}>
                    T-24h to T+48h
                </span>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '6px', background: '#27272a', borderRadius: '4px', marginTop: '12px' }}>
                <div style={{
                    position: 'absolute', top: 0, left: 0, height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #22d3ee)',
                    borderRadius: '4px',
                }} />
                <input
                    type="range"
                    min={minTimestamp}
                    max={maxTimestamp}
                    value={currentTimestamp}
                    onChange={(e) => setCurrentTimestamp(Number(e.target.value))}
                    style={{
                        position: 'absolute', top: '-4px', left: 0,
                        width: '100%', height: '14px',
                        opacity: 0, cursor: 'pointer',
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#52525b', marginTop: '6px' }}>
                <span>{fmt(minTimestamp)}</span>
                <span>{fmt(maxTimestamp)}</span>
            </div>
        </div>
    );
};
