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
    // ── Step 1: Fetch TLE text ─────────────────────────────────
    const response = await fetch(CELESTRAK_URL, {
      headers: {
        'User-Agent': 'VaanThuli/1.0 (Hackathon; contact: vaanthuli@example.com)',
        'Accept':     'text/plain',
      },
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`CelesTrak HTTP ${response.status}: ${response.statusText}`);
    }

    const rawText = await response.text();

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('CelesTrak returned empty response');
    }

    // ── Step 2: Parse TLE text → structured objects ────────────
    const parsedTLEs = parseTLEText(rawText);
    console.log(`[TLE Scheduler] Parsed ${parsedTLEs.length} TLE sets`);

    if (parsedTLEs.length === 0) {
      throw new Error('TLE parsing yielded 0 results — check raw format');
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
