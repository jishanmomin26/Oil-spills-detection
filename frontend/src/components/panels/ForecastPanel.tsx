
import { useIncidentStore } from '../../store/useIncidentStore';

export const ForecastPanel = () => {
    const { forecast } = useIncidentStore();

    if (!forecast) return null;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                <span style={{ fontSize: '16px' }}>&#10038;</span>
                <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Spill Forecast (48h)</h2>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <InfoBox label="Predicted Lat" value={forecast.predicted_lat.toFixed(4)} />
                    <InfoBox label="Predicted Lon" value={forecast.predicted_lon.toFixed(4)} />
                    <InfoBox label="Confidence" value={`${(forecast.confidence * 100).toFixed(1)}%`} highlight />
                    <InfoBox label="Affected Radius" value={`${forecast.uncertainty_radius_km.toFixed(1)} km`} />
                </div>
            </div>
            
            <div style={{ marginBottom: '8px', fontSize: '11px', color: '#a1a1aa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Forecast Target Time:</span>
                    <span style={{ color: '#e4e4e7', fontFamily: 'monospace' }}>
                        {forecast.forecast_time.substring(0, 16).replace('T', ' ')} UTC
                    </span>
                </div>
            </div>

            <div style={{ fontSize: '10px', color: '#71717a', fontStyle: 'italic', lineHeight: 1.4, marginTop: '16px' }}>
                [MODELLED / DEMO DATA] Forward deterministic trajectory. Do not use for real navigation or response.
            </div>
        </div>
    );
};

const InfoBox = ({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) => (
    <div style={{
        padding: '8px',
        background: highlight ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${highlight ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    }}>
        <div style={{ fontSize: '10px', color: '#a1a1aa', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: highlight ? '#38bdf8' : '#e4e4e7', fontFamily: 'monospace' }}>{value}</div>
    </div>
);
