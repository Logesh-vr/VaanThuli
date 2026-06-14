export function ObjectCard({ object, insight, insightLoading, onClose }) {
  if (!object) return null;

  const isSat       = object.type === 'satellite';
  const isHazardous = object.hazardous;

  return (
    <div className="object-card glass-panel">
      <button className="card-close" onClick={onClose} aria-label="Close">✕</button>

      {/* Header */}
      <div className="card-type">
        {isSat ? '🛰️  SATELLITE' : '☄️  NEAR-EARTH OBJECT'}
      </div>
      <h2 className="card-name">{object.name}</h2>

      {/* Stats */}
      <div className="card-stats">
        {isSat && (
          <>
            <StatRow label="Altitude"  value={`${object.altKm?.toFixed(1)} km`} />
            <StatRow label="NORAD ID"  value={`#${object.norad_id}`} />
            <StatRow label="Orbit"     value={orbitClass(object.altKm)} />
            <StatRow label="Position"  value={`${object.lat?.toFixed(2)}°, ${object.lng?.toFixed(2)}°`} />
          </>
        )}

        {!isSat && (
          <>
            <StatRow
              label="Miss Distance"
              value={object.missDistanceKm
                ? `${(object.missDistanceKm / 1e6).toFixed(3)}M km`
                : `${object.miss_distance_km?.toLocaleString()} km`}
            />
            <StatRow
              label="Velocity"
              value={`${(object.velocityKms ?? object.velocity_km_s)?.toFixed(2)} km/s`}
            />
            <StatRow
              label="Diameter"
              value={object.diameter_m
                ? `~${object.diameter_m?.toFixed(0)} m`
                : `${(object.estimatedDiameterKm?.min * 1000)?.toFixed(0)}–${(object.estimatedDiameterKm?.max * 1000)?.toFixed(0)} m`}
            />
            <StatRow
              label="Approach"
              value={object.closeApproachFull ?? object.closeApproachDate ?? '—'}
            />
          </>
        )}
      </div>

      {isHazardous && (
        <div className="card-hazard">⚠️ Potentially Hazardous Asteroid</div>
      )}

      {/* ── Gemini AI Insight ──────────────────────────────────── */}
      <div className="card-ai-section">
        <div className="card-ai-header">
          <span className="card-ai-icon">✦</span>
          <span className="card-ai-label">AI INSIGHT</span>
          <span className="card-ai-poweredby">Gemini</span>
        </div>

        <div className="card-ai-body">
          {insightLoading && (
            <div className="card-ai-loading">
              <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
              <span style={{ marginLeft: 8 }}>Analysing…</span>
            </div>
          )}
          {!insightLoading && insight && (
            <p className="card-ai-text">{insight}</p>
          )}
          {!insightLoading && !insight && (
            <p className="card-ai-placeholder">Click to reveal cosmic intelligence…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="card-stat">
      <span className="card-stat-label">{label}</span>
      <span className="card-stat-value">{value}</span>
    </div>
  );
}

function orbitClass(altKm) {
  if (!altKm) return '—';
  if (altKm < 2000)  return 'LEO';
  if (altKm < 35786) return 'MEO';
  return 'GEO';
}
