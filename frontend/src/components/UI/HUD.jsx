import { StatsBar }       from './StatsBar';
import { TogglePanel }    from './TogglePanel';
import { BubbleControls } from './BubbleControls';
import { ObjectCard }     from './ObjectCard';

export function HUD({
  filter, setFilter,
  satCount, asteroidCount, tleSource,
  userLocation, onRequestLocation, locationLoading, onClearLocation,
  bubbleRadius, setBubbleRadius,
  selectedObject, insight, insightLoading, onCloseCard,
}) {
  return (
    <div className="hud">
      {/* Top-left: Brand */}
      <div className="brand">
        <h1 className="brand-title">VAANTHULI</h1>
        <p className="brand-sub">Real-Time Cosmic Tracker</p>
      </div>

      {/* Top-right: Live counts */}
      <StatsBar
        satCount={satCount}
        asteroidCount={asteroidCount}
        filter={filter}
        tleSource={tleSource}
      />

      {/* Bottom-left: Toggle */}
      <TogglePanel filter={filter} setFilter={setFilter} />

      {/* Bottom-right: GPS + radius */}
      <BubbleControls
        userLocation={userLocation}
        bubbleRadius={bubbleRadius}
        setBubbleRadius={setBubbleRadius}
        onRequestLocation={onRequestLocation}
        locationLoading={locationLoading}
        onClearLocation={onClearLocation}
      />

      {/* Center-right: Selected object card with AI insight */}
      {selectedObject && (
        <ObjectCard
          object={selectedObject}
          insight={insight}
          insightLoading={insightLoading}
          onClose={onCloseCard}
        />
      )}

      {/* Bottom-center: Legend */}
      <div className="legend glass-panel" style={{ gridArea: 'none', justifySelf: 'center', alignSelf: 'end' }}>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--sat-leo)' }} />
          LEO
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--sat-meo)' }} />
          MEO
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--sat-geo)' }} />
          GEO
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--asteroid-hazard)' }} />
          Hazardous
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'var(--asteroid-normal)' }} />
          Asteroid
        </div>
      </div>
    </div>
  );
}
