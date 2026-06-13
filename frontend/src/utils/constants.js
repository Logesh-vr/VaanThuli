// ── App-wide constants ──────────────────────────────────────────

// Three.js scene scale: Earth radius = 1 unit
export const EARTH_RADIUS_THREEJS = 1.0;

// Real Earth radius in km (for coordinate math)
export const EARTH_RADIUS_KM = 6371;

// Max satellites to display (performance limit)
export const MAX_DISPLAY_SATELLITES = 3000;

// How often to re-propagate satellite positions (ms)
export const PROPAGATION_INTERVAL_MS = 5000;

// How often to re-fetch TLE data from backend (ms) — 10 minutes
export const TLE_REFRESH_MS = 10 * 60 * 1000;

// Orbit altitude thresholds (km)
export const ORBIT_LEO_MAX  = 2000;
export const ORBIT_MEO_MAX  = 35786;

// Colors (must match CSS variables)
export const COLORS = {
  LEO:             '#00e5ff',  // Cyan
  MEO:             '#4488ff',  // Blue
  GEO:             '#ff8c00',  // Orange
  ASTEROID_NORMAL: '#ff6600',
  ASTEROID_HAZARD: '#ff2244',
  USER_BUBBLE:     '#00ff88',
};
