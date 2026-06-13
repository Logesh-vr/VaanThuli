export function ObjectCard({ object, onClose }) {
  if (!object) return null;

  const isSat      = object.type === 'satellite';
  const isHazardous = object.hazardous;

  return (
    <div className="object-card glass-panel">
      <button className="card-close" onClick={onClose} aria-label="Close">✕</button>

      <div className="card-type">
        {isSat ? '🛰️  SATELLITE' : '☄️  NEAR-EARTH OBJECT'}
      </div>

      <h2 className="card-name">{object.name}</h2>

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
              value={`${(object.missDistanceKm / 1e6).toFixed(3)}M km`}
            />
            <StatRow
              label="Lunar Distance"
              value={`${object.missDistanceLunar?.toFixed(1)} LD`}
            />
            <StatRow
              label="Velocity"
              value={`${object.velocityKms?.toFixed(2)} km/s`}
            />
            <StatRow
              label="Diameter"
              value={`${(object.estimatedDiameterKm?.min * 1000)?.toFixed(0)}–${(object.estimatedDiameterKm?.max * 1000)?.toFixed(0)} m`}
            />
            <StatRow
              label="Approach"
              value={object.closeApproachFull ?? object.closeApproachDate}
            />
          </>
        )}
      </div>

      {isHazardous && (
        <div className="card-hazard">⚠️ Potentially Hazardous Asteroid</div>
      )}
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
