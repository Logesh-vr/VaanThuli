export function BubbleControls({
  userLocation,
  bubbleRadius,
  setBubbleRadius,
  onRequestLocation,
  locationLoading,
  onClearLocation,
}) {
  const MIN = 100, MAX = 5000;
  const pct = ((bubbleRadius - MIN) / (MAX - MIN) * 100).toFixed(1);

  return (
    <div className="bubble-controls">
      <button
        id="gps-btn"
        className={`gps-btn${userLocation ? ' active' : ''}`}
        onClick={userLocation ? onClearLocation : onRequestLocation}
        disabled={locationLoading}
      >
        {locationLoading
          ? '⏳ Locating…'
          : userLocation
            ? `✅ ${userLocation.lat.toFixed(2)}°, ${userLocation.lng.toFixed(2)}°`
            : '📍 Use My Location'}
      </button>

      {userLocation && (
        <div className="radius-control glass-panel">
          <div className="radius-label">
            <span>Bubble Radius</span>
            <span className="radius-value">{bubbleRadius.toLocaleString()} km</span>
          </div>
          <input
            id="radius-slider"
            type="range"
            className="radius-slider"
            min={MIN}
            max={MAX}
            step={50}
            value={bubbleRadius}
            onChange={e => setBubbleRadius(Number(e.target.value))}
            style={{ '--progress': `${pct}%` }}
            aria-label="Bubble radius in kilometres"
          />
        </div>
      )}
    </div>
  );
}
