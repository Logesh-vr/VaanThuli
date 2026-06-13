/**
 * neoFetcher.js
 * ─────────────
 * NASA NeoWs (Near Earth Object Web Service) Ingestion Scheduler
 *
 * Schedule: Every 6 hours
 * Source:   https://api.nasa.gov/neo/rest/v1/feed
 *
 * Pipeline:
 *   1. Build a 7-day date window (today → today+7)
 *   2. Fetch NeoWs feed endpoint (returns asteroids grouped by date)
 *   3. Flatten and normalize the nested JSON structure
 *   4. Upsert all NEO records to Supabase
 *   5. Update L1 NodeCache with the fresh array
 *
 * Rate limits:
 *   - Registered key: 1,000 req/hr
 *   - The 7-day window costs only 1 request — very efficient
 */

import cron from 'node-cron';
import { setAsteroidCache } from '../services/cacheService.js';
import { supabase }         from '../db/supabaseClient.js';

// ── Config ─────────────────────────────────────────────────────
const NASA_BASE_URL  = 'https://api.nasa.gov/neo/rest/v1/feed';
const WINDOW_DAYS    = 7;   // Max allowed by NeoWs in a single request

// ── Date Helpers ───────────────────────────────────────────────

/**
 * Returns a YYYY-MM-DD string for a given Date object.
 */
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Adds N days to a Date and returns a new Date.
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// ── Normalizer ─────────────────────────────────────────────────

/**
 * Normalizes a raw NeoWs asteroid object into our flat database schema.
 *
 * @param {Object} raw - Raw asteroid object from NeoWs API
 * @returns {Object}   - Normalized record matching the 'asteroids' table
 */
function normalizeAsteroid(raw) {
  const approach = raw.close_approach_data?.[0] ?? {};
  const diameter = raw.estimated_diameter?.kilometers ?? {};

  return {
    neo_id:                 String(raw.id),
    name:                   raw.name || `NEO-${raw.id}`,
    neo_reference_id:       raw.neo_reference_id || null,

    absolute_magnitude_h:   raw.absolute_magnitude_h ?? null,
    est_diameter_km_min:    diameter.estimated_diameter_min ?? null,
    est_diameter_km_max:    diameter.estimated_diameter_max ?? null,

    close_approach_date:    approach.close_approach_date     || null,
    close_approach_full:    approach.close_approach_date_full || null,
    epoch_close_approach_ms: approach.epoch_date_close_approach ?? null,

    velocity_kms:    approach.relative_velocity?.kilometers_per_second
                      ? parseFloat(approach.relative_velocity.kilometers_per_second)
                      : null,
    velocity_kmh:    approach.relative_velocity?.kilometers_per_hour
                      ? parseFloat(approach.relative_velocity.kilometers_per_hour)
                      : null,

    miss_distance_km:    approach.miss_distance?.kilometers
                          ? parseFloat(approach.miss_distance.kilometers)
                          : null,
    miss_distance_au:    approach.miss_distance?.astronomical
                          ? parseFloat(approach.miss_distance.astronomical)
                          : null,
    miss_distance_lunar: approach.miss_distance?.lunar
                          ? parseFloat(approach.miss_distance.lunar)
                          : null,

    is_hazardous:     raw.is_potentially_hazardous_asteroid ?? false,
    is_sentry_object: raw.is_sentry_object ?? false,

    // Store the raw object for any frontend fields we haven't mapped yet
    raw_data:    raw,
    updated_at:  new Date().toISOString(),
  };
}

// ── Core Fetch Function ────────────────────────────────────────

/**
 * Fetches, normalizes, caches, and persists asteroid data for the next 7 days.
 * Safe to call directly on server startup.
 */
export async function runNEOFetch() {
  const startTime = Date.now();
  console.log('[NEO Scheduler] ⟳ Starting asteroid fetch from NASA NeoWs...');

  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    console.error('[NEO Scheduler] ❌ Missing NASA_API_KEY in .env');
    return;
  }

  try {
    // ── Step 1: Build date window ──────────────────────────────
    const today     = new Date();
    const startDate = toDateString(today);
    const endDate   = toDateString(addDays(today, WINDOW_DAYS));

    const url = `${NASA_BASE_URL}?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`;
    console.log(`[NEO Scheduler] Fetching window: ${startDate} → ${endDate}`);

    // ── Step 2: Fetch from NASA NeoWs ─────────────────────────
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VaanThuli/1.0 (Hackathon)',
        'Accept':     'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    });

    // Check rate limit headers
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining) {
      console.log(`[NEO Scheduler] NASA API rate limit remaining: ${remaining}`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`NASA NeoWs HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const json = await response.json();

    // ── Step 3: Flatten nested date-grouped structure ──────────
    // Response shape: { near_earth_objects: { "2026-06-14": [...], "2026-06-15": [...] } }
    const nearEarthObjects = json.near_earth_objects ?? {};
    const rawAsteroids     = Object.values(nearEarthObjects).flat();

    console.log(`[NEO Scheduler] Raw asteroids received: ${rawAsteroids.length}`);

    if (rawAsteroids.length === 0) {
      console.warn('[NEO Scheduler] ⚠️  No asteroids in response window');
      return;
    }

    // ── Step 4: Normalize all records ─────────────────────────
    const normalized = rawAsteroids.map(normalizeAsteroid);

    // ── Step 5: Update L1 cache immediately ───────────────────
    setAsteroidCache(normalized);

    // ── Step 6: Upsert to Supabase ────────────────────────────
    const { error } = await supabase
      .from('asteroids')
      .upsert(normalized, {
        onConflict:       'neo_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('[NEO Scheduler] Supabase upsert error:', error.message);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const hazardous = normalized.filter(n => n.is_hazardous).length;

    console.log(
      `[NEO Scheduler] ✅ Done in ${elapsed}s — ` +
      `${normalized.length} asteroids | ${hazardous} potentially hazardous`
    );

  } catch (err) {
    console.error('[NEO Scheduler] ❌ Fetch failed:', err.message);
  }
}

// ── Cron Registration ──────────────────────────────────────────

/**
 * Registers the NEO fetch cron job.
 * Called once from server.js on startup.
 */
export function registerNEOScheduler() {
  if (process.env.ENABLE_NEO_SCHEDULER === 'false') {
    console.log('[NEO Scheduler] ⏸  Disabled via ENABLE_NEO_SCHEDULER=false');
    return;
  }

  // Run at minute 0 of every 6th hour: 00:00, 06:00, 12:00, 18:00
  cron.schedule('0 */6 * * *', () => {
    console.log('[NEO Scheduler] 🕐 Cron triggered (6-hour interval)');
    runNEOFetch();
  }, {
    timezone: 'UTC',
  });

  console.log('[NEO Scheduler] ✓ Registered — runs every 6 hours (UTC)');
}
