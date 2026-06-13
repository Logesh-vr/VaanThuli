/**
 * propagator.js
 * ─────────────
 * TLE propagation engine using satellite.js (SGP4/SDP4 models).
 *
 * Converts raw CelesTrak TLE text into real-time geodetic positions:
 *   TLE lines → ECI position → Geodetic (lat, lng, alt) + velocity magnitude
 *
 * IMPORTANT: Call propagateTLE() with 'now' as a fresh Date() each time you
 * want current position. Satellite positions change significantly every second.
 */

import * as satellite from 'satellite.js';

/**
 * Propagates a single satellite TLE to its current geodetic position.
 *
 * @param {string} tleLine1  - TLE Line 1 (69 chars)
 * @param {string} tleLine2  - TLE Line 2 (69 chars)
 * @param {Date}   [at]      - Point in time to propagate to (defaults to now)
 * @returns {{ lat, lng, altKm, velocityKms } | null}
 */
export function propagateTLE(tleLine1, tleLine2, at = new Date()) {
  try {
    // Step 1: Parse TLE into a satellite record (satrec)
    const satrec = satellite.twoline2satrec(tleLine1.trim(), tleLine2.trim());

    // Step 2: Propagate to the target time → ECI position & velocity
    const result = satellite.propagate(satrec, at);

    // Propagation can fail (decayed satellite, bad TLE) — check for validity
    if (!result || !result.position || typeof result.position === 'boolean') {
      return null;
    }

    const posECI = result.position; // { x, y, z } km — Earth Centered Inertial
    const velECI = result.velocity; // { x, y, z } km/s

    // Step 3: Greenwich Mean Sidereal Time — needed to rotate ECI → Earth-fixed
    const gmst = satellite.gstime(at);

    // Step 4: ECI → Geodetic (lat/lng in radians, alt in km)
    const posGeodetic = satellite.eciToGeodetic(posECI, gmst);

    const lat = satellite.radiansToDegrees(posGeodetic.latitude);
    const lng = satellite.radiansToDegrees(posGeodetic.longitude);
    const altKm = posGeodetic.height; // km above ellipsoid

    // Step 5: Velocity magnitude (km/s) from ECI velocity vector
    const velocityKms = velECI
      ? Math.sqrt(velECI.x ** 2 + velECI.y ** 2 + velECI.z ** 2)
      : null;

    // Sanity check — skip satellites with clearly invalid positions
    if (!isFinite(lat) || !isFinite(lng) || !isFinite(altKm)) {
      return null;
    }

    return {
      lat:         parseFloat(lat.toFixed(6)),
      lng:         parseFloat(lng.toFixed(6)),
      altKm:       parseFloat(altKm.toFixed(3)),
      velocityKms: velocityKms ? parseFloat(velocityKms.toFixed(4)) : null,
    };
  } catch {
    // Silently skip bad TLE entries (corrupted, expired, decayed)
    return null;
  }
}

/**
 * Batch-propagates an array of parsed TLE objects.
 * Each item must have: { name, norad_id, object_id, tle_line1, tle_line2 }
 *
 * @param {Array}  tleArray  - Array of parsed TLE objects
 * @param {Date}   [at]      - Point in time (defaults to now)
 * @returns {Array}          - Array of propagated satellite objects
 */
export function propagateBatch(tleArray, at = new Date()) {
  const results = [];
  let failures = 0;

  for (const sat of tleArray) {
    const pos = propagateTLE(sat.tle_line1, sat.tle_line2, at);

    if (pos === null) {
      failures++;
      continue;
    }

    results.push({
      norad_id:     sat.norad_id,
      name:         sat.name,
      object_id:    sat.object_id || null,
      tle_line1:    sat.tle_line1,
      tle_line2:    sat.tle_line2,
      epoch:        sat.epoch || null,
      lat:          pos.lat,
      lng:          pos.lng,
      alt_km:       pos.altKm,
      velocity_kms: pos.velocityKms,
      propagated_at: at.toISOString(),
    });
  }

  console.log(
    `[Propagator] ✓ ${results.length} propagated, ${failures} skipped (decayed/invalid)`
  );

  return results;
}

/**
 * Parses raw CelesTrak TLE text format (3-line sets) into structured objects.
 *
 * TLE text format:
 *   ISS (ZARYA)
 *   1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9993
 *   2 25544  51.6416  72.9653 0006703 347.6153  12.4940 15.50377579432729
 *
 * @param {string} rawText - Raw TLE text from CelesTrak
 * @returns {Array}        - Array of parsed TLE objects
 */
export function parseTLEText(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const parsed = [];

  for (let i = 0; i < lines.length; i += 3) {
    const name     = lines[i];
    const tleLine1 = lines[i + 1];
    const tleLine2 = lines[i + 2];

    // Basic validation: TLE lines start with '1' and '2' respectively
    if (!tleLine1 || !tleLine2) continue;
    if (!tleLine1.startsWith('1 ') || !tleLine2.startsWith('2 ')) continue;

    // Extract NORAD catalog number from line 2 (columns 2-7)
    const norad_id = tleLine2.substring(2, 7).trim();

    // Extract epoch from line 1 (columns 18-32)
    const epoch = tleLine1.substring(18, 32).trim();

    parsed.push({
      norad_id,
      name:      name || `SAT-${norad_id}`,
      object_id: null,   // Not available in TLE text format
      epoch,
      tle_line1: tleLine1,
      tle_line2: tleLine2,
    });
  }

  return parsed;
}
