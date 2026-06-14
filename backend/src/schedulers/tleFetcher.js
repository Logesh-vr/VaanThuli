/**
 * tleFetcher.js
 * ─────────────
 * CelesTrak TLE Ingestion Scheduler
 *
 * Schedule: Every 2 hours (matches CelesTrak's data update frequency)
 * Source:   https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle
 *
 * Pipeline:
 *   1. Fetch TLE text from CelesTrak
 *   2. Parse 3-line TLE sets into structured objects
 *   3. Propagate each TLE to current lat/lng/alt using satellite.js
 *   4. Upsert all records to Supabase (conflict on norad_id)
 *   5. Update L1 NodeCache with fresh propagated array
 *
 * NOTE: CelesTrak's rate limit is strict — do NOT poll more than once per
 * 2 hours. Excessive requests will trigger an IP ban. The scheduler includes
 * a jitter delay on startup to avoid thundering-herd if multiple instances start.
 */

import cron from 'node-cron';
import { parseTLEText, propagateBatch } from '../services/propagator.js';
import { setSatelliteCache }           from '../services/cacheService.js';
import { supabase }                    from '../db/supabaseClient.js';

// ── Config ─────────────────────────────────────────────────────
const CELESTRAK_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';

// Batch size for Supabase upserts (avoids request body size limits)
const UPSERT_BATCH_SIZE = 500;

// ── Core Fetch Function ────────────────────────────────────────

/**
 * Fetches, propagates, caches, and persists the full active satellite catalog.
 * Safe to call directly (e.g., on server startup) as well as on cron schedule.
 */
export async function runTLEFetch() {
  const startTime = Date.now();
  console.log('[TLE Scheduler] ⟳ Starting TLE fetch from CelesTrak...');

  try {
    // ── Step 1 & 2: Fetch and Parse TLEs from KeepTrack ────────
    let parsedTLEs = [];
    const apiKey = process.env.KEEPTRACK_API_KEY;
    if (!apiKey) {
      throw new Error('Missing KEEPTRACK_API_KEY in environment');
    }

    console.log('[TLE Scheduler] Fetching satellite catalog from KeepTrack API...');
    const keepTrackRes = await fetch(`https://api.keeptrack.space/v4/sats/brief?apiKey=${apiKey}`, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!keepTrackRes.ok) {
      throw new Error(`KeepTrack API HTTP error: ${keepTrackRes.status}`);
    }

    const satsList = await keepTrackRes.json();
    console.log(`[TLE Scheduler] Downloaded ${satsList.length} total objects from KeepTrack`);

    // Filter active payloads and filter out corrupt years > 2027
    const payloads = satsList.filter(sat => {
      if (sat.type !== 1 || !sat.tle1 || !sat.tle2) return false;
      if (sat.launchDate) {
        const year = new Date(sat.launchDate).getFullYear();
        if (isNaN(year) || year > 2027) return false;
      }
      return true;
    });

    // Separate Starlink and non-Starlink payloads
    const starlinks = payloads.filter(p => p.name && p.name.toUpperCase().includes('STARLINK'));
    const others = payloads.filter(p => !p.name || !p.name.toUpperCase().includes('STARLINK'));

    // Sort both descending by launch date to prioritize newer satellites
    const sortByLaunchDate = (a, b) => {
      const dateA = a.launchDate ? new Date(a.launchDate).getTime() : 0;
      const dateB = b.launchDate ? new Date(b.launchDate).getTime() : 0;
      return dateB - dateA;
    };
    starlinks.sort(sortByLaunchDate);
    others.sort(sortByLaunchDate);

    // Limit Starlinks to 1500 to keep high diversity, and combine with all ~7200 non-Starlink payloads
    const limitedStarlinks = starlinks.slice(0, 1500);
    const combined = [...others, ...limitedStarlinks];

    // Map to normalized database format
    parsedTLEs = combined.map(sat => {
      const norad_id = parseInt(sat.tle2.substring(2, 7).trim(), 10).toString();
      return {
        norad_id,
        name: sat.name || `SAT-${norad_id}`,
        object_id: sat.altName || null,
        epoch: sat.launchDate || null,
        tle_line1: sat.tle1,
        tle_line2: sat.tle2,
      };
    });

    console.log(`[TLE Scheduler] Filtered and parsed ${parsedTLEs.length} active payloads`);

    if (parsedTLEs.length === 0) {
      throw new Error('TLE fetching yielded 0 results from KeepTrack API');
    }

    // ── Step 3: Propagate all TLEs to current positions ────────
    const now = new Date();
    const propagated = propagateBatch(parsedTLEs, now);

    if (propagated.length === 0) {
      throw new Error('Propagation yielded 0 valid positions');
    }

    // ── Step 4: Update L1 NodeCache immediately ────────────────
    // Do this BEFORE the DB write so the API is responsive right away
    setSatelliteCache(propagated);

    // ── Step 5: Upsert to Supabase in batches ─────────────────
    let totalUpserted = 0;
    let totalErrors   = 0;

    for (let i = 0; i < propagated.length; i += UPSERT_BATCH_SIZE) {
      const batch = propagated.slice(i, i + UPSERT_BATCH_SIZE);

      const { error } = await supabase
        .from('satellites')
        .upsert(batch, {
          onConflict:        'norad_id',
          ignoreDuplicates:  false, // Update existing records
        });

      if (error) {
        console.error(`[TLE Scheduler] Supabase upsert error (batch ${i / UPSERT_BATCH_SIZE + 1}):`, error.message);
        totalErrors += batch.length;
      } else {
        totalUpserted += batch.length;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `[TLE Scheduler] ✅ Done in ${elapsed}s — ` +
      `${propagated.length} satellites | ${totalUpserted} upserted | ${totalErrors} DB errors`
    );

  } catch (err) {
    console.error('[TLE Scheduler] ❌ Fetch failed:', err.message);
    // Don't re-throw — let the cron continue running on next tick
  }
}

// ── Cron Registration ──────────────────────────────────────────

/**
 * Registers the TLE fetch cron job.
 * Called once from server.js on startup.
 */
export function registerTLEScheduler() {
  if (process.env.ENABLE_TLE_SCHEDULER === 'false') {
    console.log('[TLE Scheduler] ⏸  Disabled via ENABLE_TLE_SCHEDULER=false');
    return;
  }

  // Run at minute 0 of every 2nd hour: 00:00, 02:00, 04:00, ...
  cron.schedule('0 */2 * * *', () => {
    console.log('[TLE Scheduler] 🕐 Cron triggered (2-hour interval)');
    runTLEFetch();
  }, {
    timezone: 'UTC',
  });

  console.log('[TLE Scheduler] ✓ Registered — runs every 2 hours (UTC)');
}
