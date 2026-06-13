const MODES = [
  { id: 'satellites', label: 'Satellites', icon: '🛰️', cls: '' },
  { id: 'both',       label: 'Both',       icon: '🌍', cls: '' },
  { id: 'asteroids',  label: 'Asteroids',  icon: '☄️', cls: 'asteroids-mode' },
];

export function TogglePanel({ filter, setFilter }) {
  return (
    <div className="toggle-panel">
      {MODES.map(({ id, label, icon, cls }) => (
        <button
          key={id}
          id={`toggle-${id}`}
          className={`toggle-btn ${filter === id ? `active ${cls}` : ''}`}
          onClick={() => setFilter(id)}
          aria-pressed={filter === id}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
