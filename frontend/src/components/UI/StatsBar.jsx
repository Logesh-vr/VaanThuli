export function StatsBar({ satCount, asteroidCount, filter }) {
  return (
    <div className="stats-bar">
      {filter !== 'asteroids' && (
        <div className="stat-chip satellites">
          <span className="stat-dot" />
          🛰️ &nbsp;
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {satCount.toLocaleString()}
          </span>
        </div>
      )}
      {filter !== 'satellites' && (
        <div className="stat-chip asteroids">
          <span className="stat-dot" />
          ☄️ &nbsp;
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {asteroidCount}
          </span>
        </div>
      )}
    </div>
  );
}
