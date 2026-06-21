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
            <StatRow label="Mission"   value={getMissionCategory(object.name, object.altKm)} />
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

      {isSat && (
        <a 
          href={`https://www.n2yo.com/?s=${object.norad_id}`}
          target="_blank" 
          rel="noopener noreferrer"
          className="n2yo-link-btn"
        >
          Track Live on N2YO ↗
        </a>
      )}

      {isHazardous && (
        <div className="card-hazard">⚠️ Potentially Hazardous Asteroid</div>
      )}

      {/* ── Gemini AI Insight ──────────────────────────────────── */}
      <div className="card-ai-section">
        <div className="card-ai-header">
          <span className="card-ai-icon">✦</span>
          <span className="card-ai-label">{isSat ? 'MISSION PROFILE' : 'COSMIC PROFILE'}</span>
          <span className="card-ai-poweredby">Gemini</span>
        </div>

        <div className="card-ai-body">
          {insightLoading && (
            <div className="card-ai-loading">
              <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
              <span style={{ marginLeft: 8 }}>Analyzing…</span>
            </div>
          )}
          {!insightLoading && insight && (
            <p className="card-ai-text">{insight}</p>
          )}
          {!insightLoading && !insight && (
            <p className="card-ai-placeholder">
              {isSat ? 'Click to reveal mission profile…' : 'Click to reveal cosmic intelligence…'}
            </p>
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

function getMissionCategory(name, altKm) {
  const nameUpper = (name || '').toUpperCase();
  if (nameUpper.includes('STARLINK') || nameUpper.includes('ONEWEB') || nameUpper.includes('IRIDIUM')) {
    return 'Global Broadband Internet';
  }
  if (nameUpper.includes('ISS') || nameUpper.includes('ZARYA') || nameUpper.includes('TIANGONG') || nameUpper.includes('CSS')) {
    return 'Manned Space Station / Science';
  }
  if (nameUpper.includes('GPS') || nameUpper.includes('NAVSTAR') || nameUpper.includes('GLONASS') || nameUpper.includes('GALILEO') || nameUpper.includes('BEIDOU')) {
    return 'Global Satellite Navigation (GNSS)';
  }
  if (nameUpper.includes('NOAA') || nameUpper.includes('METOP') || nameUpper.includes('GOES') || nameUpper.includes('FENGYUN') || nameUpper.includes('HIMAWARI') || nameUpper.includes('SENTINEL')) {
    return 'Meteorology / Earth Observation';
  }
  if (nameUpper.includes('HUBBLE') || nameUpper.includes('HST') || nameUpper.includes('JWST') || nameUpper.includes('KEPLER') || nameUpper.includes('CHANDRA')) {
    return 'Space Telescope / Astronomy';
  }
  
  // Generic guess based on altitude
  if (altKm < 2000) {
    return 'Earth Observation & Telecom';
  } else if (altKm < 35786) {
    return 'Navigation & Regional Telecom';
  } else {
    return 'Geostationary Broadcast & Comms';
  }
}
