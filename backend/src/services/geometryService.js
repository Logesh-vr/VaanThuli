/**
 * geometryService.js
 * ──────────────────
 * Haversine-based in-memory geographic filtering.
 *
 * Used as the primary filter in the /api/core/sky-bubble route.
 * Much faster than a DB round-trip for arrays already in L1 cache.
 *
 * Earth radius reference: 6371 km (mean spherical)
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculates the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param {number} lat1 - Origin latitude  (degrees)
 * @param {number} lng1 - Origin longitude (degrees)
 * @param {number} lat2 - Target latitude  (degrees)
 * @param {number} lng2 - Target longitude (degrees)
 * @returns {number} Distance in kilometres (surface distance, ignores altitude)
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Filters a satellite array to only those within a 2D surface radius.
 *
 * NOTE: 'radiusKm' is measured as a surface great-circle distance from the
 * user's GPS position to the satellite's sub-orbital point (ground track).
 * Altitude is NOT included in the distance calculation by default, matching
 * the concept of "overhead" visibility.
 *
 * @param {Array}  satellites - Full propagated satellite array from cache
 * @param {number} userLat    - User latitude  (degrees)
 * @param {number} userLng    - User longitude (degrees)
 * @param {number} radiusKm   - Filter radius in km (default 500)
 * @returns {Array}           - Filtered + annotated satellite objects
 */
export function filterSatellitesInBubble(satellites, userLat, userLng, radiusKm = 500) {
  const results = [];

  for (const sat of satellites) {
    if (sat.lat == null || sat.lng == null) continue;

    const distKm = haversineKm(userLat, userLng, sat.lat, sat.lng);

    if (distKm <= radiusKm) {
      results.push({
        id:               sat.norad_id,
        name:             sat.name,
        type:             'satellite',
        lat:              sat.lat,
        lng:              sat.lng,
        altKm:            sat.alt_km,
        velocityKms:      sat.velocity_kms,
        distanceFromUserKm: parseFloat(distKm.toFixed(2)),
        propagatedAt:     sat.propagated_at,
      });
    }
  }

  // Sort by distance — closest first
  results.sort((a, b) => a.distanceFromUserKm - b.distanceFromUserKm);

  return results;
}

/**
 * Filters asteroids for the sky bubble response.
 *
 * Asteroids do NOT have a sub-orbital ground track (they are in heliocentric
 * orbit). Instead, we return all upcoming asteroids with enriched metadata.
 * The frontend can visualize them as inbound vectors from deep space.
 *
 * Optional: filter by date range (approaching within N days from now).
 *
 * @param {Array}  asteroids  - Full asteroid array from cache
 * @param {number} [daysOut]  - Max days from now to include (default 7)
 * @returns {Array}           - Filtered asteroid objects
 */
export function filterAsteroidsForBubble(asteroids, daysOut = 7) {
  const now     = Date.now();
  const maxTime = now + daysOut * 24 * 60 * 60 * 1000;

  return asteroids
    .filter(neo => {
      if (!neo.epoch_close_approach_ms) return true; // Include if no date
      return neo.epoch_close_approach_ms <= maxTime;
    })
    .map(neo => ({
      id:                  neo.neo_id,
      name:                neo.name,
      type:                'asteroid',
      estimatedDiameterKm: {
        min: neo.est_diameter_km_min,
        max: neo.est_diameter_km_max,
      },
      velocityKms:         neo.velocity_kms,
      missDistanceKm:      neo.miss_distance_km,
      missDistanceLunar:   neo.miss_distance_lunar,
      hazardous:           neo.is_hazardous,
      closeApproachDate:   neo.close_approach_date,
      closeApproachFull:   neo.close_approach_full,
    }))
    .sort((a, b) => {
      // Sort: hazardous first, then by miss distance
      if (a.hazardous !== b.hazardous) return a.hazardous ? -1 : 1;
      return a.missDistanceKm - b.missDistanceKm;
    });
}
