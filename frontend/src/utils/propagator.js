/**
 * propagator.js
 * ─────────────
 * Client-side satellite position utilities.
 * Converts geodetic coordinates to Three.js 3D positions.
 */

import * as THREE from 'three';
import {
  EARTH_RADIUS_THREEJS,
  EARTH_RADIUS_KM,
  ORBIT_LEO_MAX,
  ORBIT_MEO_MAX,
  COLORS,
} from './constants';

/**
 * Converts geodetic lat/lng/alt to a Three.js Vector3 position on a sphere.
 *
 * @param {number} lat      - Latitude in degrees (-90 to 90)
 * @param {number} lng      - Longitude in degrees (-180 to 180)
 * @param {number} radius   - Sphere radius in Three.js units
 * @returns {THREE.Vector3}
 */
export function latLngToVector3(lat, lng, radius = EARTH_RADIUS_THREEJS) {
  const phi   = (90 - lat) * (Math.PI / 180);   // polar angle from north pole
  const theta = (lng + 180) * (Math.PI / 180);  // azimuthal angle

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Converts satellite altitude (km above Earth's surface) to
 * a Three.js scene radius (Earth surface = 1 unit).
 *
 * @param {number} altKm  - Altitude in km
 * @returns {number}      - Radius in Three.js units
 */
export function altToRadius(altKm) {
  return EARTH_RADIUS_THREEJS + (altKm / EARTH_RADIUS_KM) * EARTH_RADIUS_THREEJS;
}

/**
 * Returns the THREE.Color for a satellite based on its orbital altitude.
 *
 * @param {number} altKm  - Altitude in km
 * @returns {THREE.Color}
 */
export function getOrbitColor(altKm) {
  if (altKm < ORBIT_LEO_MAX) return new THREE.Color(COLORS.LEO);   // LEO — cyan
  if (altKm < ORBIT_MEO_MAX) return new THREE.Color(COLORS.MEO);   // MEO — blue
  return new THREE.Color(COLORS.GEO);                               // GEO — orange
}

/**
 * Generates a consistent 3D position for an asteroid in the scene.
 * Asteroids are in heliocentric orbit — they don't have an Earth ground track.
 * We place them at their actual miss distance in a pseudo-random direction
 * (seeded by their ID for consistency across renders).
 *
 * @param {Object} neo         - Normalized asteroid object from API
 * @returns {THREE.Vector3}
 */
export function asteroidPosition(neo) {
  const seed = parseInt(neo.id, 10) || 999;

  // Golden angle distribution for even sphere coverage
  const phi   = (seed * 137.508) % 360 * (Math.PI / 180);
  const theta = Math.acos(1 - 2 * ((seed * 0.618033988) % 1));

  // Scale miss distance to Three.js units — clamp to visible range [1.4, 4.0]
  const distUnits = Math.min(4.0, Math.max(1.4, neo.missDistanceKm / (EARTH_RADIUS_KM * 10)));

  return new THREE.Vector3(
    distUnits * Math.sin(theta) * Math.cos(phi),
    distUnits * Math.cos(theta),
    distUnits * Math.sin(theta) * Math.sin(phi),
  );
}
