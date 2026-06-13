/**
 * cacheService.js
 * ───────────────
 * Two-layer cache abstraction for VaanThuli's cosmic object data.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  L1 — NodeCache (in-memory)                                 │
 * │  • Sub-millisecond reads for the full satellite/asteroid     │
 * │    array (~6,000-8,000 objects)                             │
 * │  • Evicted on process restart                               │
 * │  • TTL: matches scheduler fetch intervals                   │
 * ├─────────────────────────────────────────────────────────────┤
 * │  L2 — Supabase (PostgreSQL + PostGIS)                       │
 * │  • Persisted between restarts                               │
 * │  • Used for spatial ST_DWithin queries                      │
 * │  • Fallback when L1 is cold (first boot)                    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Cache Keys:
 *   'satellites:propagated'  → Array of propagated satellite objects
 *   'asteroids:all'          → Array of normalized asteroid objects
 */

import NodeCache from 'node-cache';

// ── L1: In-Memory Cache ────────────────────────────────────────
const TLE_TTL = parseInt(process.env.TLE_CACHE_TTL || '7200', 10);   // 2h
const NEO_TTL = parseInt(process.env.NEO_CACHE_TTL || '21600', 10);  // 6h

const memoryCache = new NodeCache({
  stdTTL:      0,          // Default TTL = no expiry (we set per-key)
  checkperiod: 300,        // Check for expired keys every 5 minutes
  useClones:   false,      // Don't clone on get/set — performance critical for large arrays
  deleteOnExpire: true,
});

export const CACHE_KEYS = {
  SATELLITES: 'satellites:propagated',
  ASTEROIDS:  'asteroids:all',
};

// ── Satellite Cache ────────────────────────────────────────────

/**
 * Store the full propagated satellite array in L1 cache.
 * @param {Array} satellites - Array of propagated satellite objects
 */
export function setSatelliteCache(satellites) {
  memoryCache.set(CACHE_KEYS.SATELLITES, satellites, TLE_TTL);
  console.log(`[Cache] ✓ Satellite L1 updated: ${satellites.length} objects, TTL=${TLE_TTL}s`);
}

/**
 * Retrieve the satellite array from L1 cache.
 * @returns {Array|null} - Cached satellite array, or null if expired/missing
 */
export function getSatelliteCache() {
  const data = memoryCache.get(CACHE_KEYS.SATELLITES);
  return data ?? null;
}

// ── Asteroid Cache ─────────────────────────────────────────────

/**
 * Store the normalized asteroid array in L1 cache.
 * @param {Array} asteroids - Array of normalized asteroid objects
 */
export function setAsteroidCache(asteroids) {
  memoryCache.set(CACHE_KEYS.ASTEROIDS, asteroids, NEO_TTL);
  console.log(`[Cache] ✓ Asteroid L1 updated: ${asteroids.length} objects, TTL=${NEO_TTL}s`);
}

/**
 * Retrieve the asteroid array from L1 cache.
 * @returns {Array|null} - Cached asteroid array, or null if expired/missing
 */
export function getAsteroidCache() {
  const data = memoryCache.get(CACHE_KEYS.ASTEROIDS);
  return data ?? null;
}

// ── Cache Status ───────────────────────────────────────────────

/**
 * Returns cache health info for the /api/health endpoint.
 */
export function getCacheStats() {
  const stats = memoryCache.getStats();
  const sats  = memoryCache.get(CACHE_KEYS.SATELLITES);
  const neos  = memoryCache.get(CACHE_KEYS.ASTEROIDS);

  return {
    hits:      stats.hits,
    misses:    stats.misses,
    keys:      stats.keys,
    satellite_count: sats?.length ?? 0,
    asteroid_count:  neos?.length ?? 0,
    satellite_ttl_remaining: memoryCache.getTtl(CACHE_KEYS.SATELLITES)
      ? Math.round((memoryCache.getTtl(CACHE_KEYS.SATELLITES) - Date.now()) / 1000)
      : 0,
    asteroid_ttl_remaining: memoryCache.getTtl(CACHE_KEYS.ASTEROIDS)
      ? Math.round((memoryCache.getTtl(CACHE_KEYS.ASTEROIDS) - Date.now()) / 1000)
      : 0,
  };
}
