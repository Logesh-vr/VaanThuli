/**
 * server.js
 * ─────────
 * VaanThuli Backend — Fastify Server Entry Point
 *
 * Startup Sequence:
 *   1. Load environment variables
 *   2. Initialize Fastify with CORS
 *   3. Register API routes
 *   4. Start listening on PORT
 *   5. Fire data fetchers immediately (cold-start cache warm-up)
 *   6. Register cron schedulers for periodic refresh
 *
 * The immediate fetch on startup ensures the API is ready to serve data
 * within ~10-15 seconds of boot (the time TLE propagation takes for ~6k sats).
 */

import 'dotenv/config';

import Fastify          from 'fastify';
import FastifyCors      from '@fastify/cors';

import skyBubbleRoute              from './routes/skyBubble.js';
import tleDataRoute                from './routes/tleData.js';
import { runTLEFetch,  registerTLEScheduler } from './schedulers/tleFetcher.js';
import { runNEOFetch,  registerNEOScheduler } from './schedulers/neoFetcher.js';
import { getCacheStats, setSatelliteCache }   from './services/cacheService.js';
import { supabase }                           from './db/supabaseClient.js';

// ── Server Init ────────────────────────────────────────────────
const app = Fastify({
  logger: {
    level:     process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? {
          target:  'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
        }
      : undefined,
  },
});

// ── CORS ───────────────────────────────────────────────────────
await app.register(FastifyCors, {
  origin: true, // Allow all origins for hackathon — tighten for production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ── Routes ─────────────────────────────────────────────────────

// Health check — used by frontend to verify backend is alive
app.get('/api/health', async (request, reply) => {
  const cacheStats = getCacheStats();

  return reply.code(200).send({
    status:  'ok',
    version: '1.0.0',
    app:     'VaanThuli Backend',
    env:     process.env.NODE_ENV || 'development',
    uptime:  Math.round(process.uptime()),
    cache:   cacheStats,
    timestamp: new Date().toISOString(),
  });
});

// Core sky-bubble route
await app.register(skyBubbleRoute);

// Raw TLE data route (for frontend client-side propagation)
await app.register(tleDataRoute);

// ── Not Found Handler ──────────────────────────────────────────
app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    status:  'error',
    message: `Route not found: ${request.method} ${request.url}`,
    docs:    'Available: GET /api/health, GET /api/core/sky-bubble',
  });
});

// ── Graceful Shutdown ──────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
  await app.close();
  console.log('[Server] Closed. Goodbye.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Boot Sequence ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);

try {
  // Start server
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀 VaanThuli Backend running on http://localhost:${PORT}`);
  console.log(`   Health:     http://localhost:${PORT}/api/health`);
  console.log(`   Sky Bubble: http://localhost:${PORT}/api/core/sky-bubble?lat=12.97&lng=77.59&radius=500`);
  console.log('');

  // Register cron schedulers (won't fire until their schedule)
  registerTLEScheduler();
  registerNEOScheduler();

  // ── Cold-start warm-up: fetch data immediately ───────────────
  // Run both fetchers in parallel — don't await so server responds immediately
  console.log('[Boot] 🔥 Warming up data caches (this takes ~10-15s)...');

  // Try CelesTrak first, then fall back to Supabase if rate-limited
  const warmSatellites = async () => {
    await runTLEFetch();
    // Check if cache got populated (CelesTrak may have been rate-limited)
    const stats = getCacheStats();
    if (!stats.satellites || stats.satellites === 0) {
      console.log('[Boot] 📡 CelesTrak rate-limited — loading satellites from Supabase (paginated)...');
      try {
        // Supabase PostgREST caps at 1000 rows per request — paginate to get all
        const PAGE_SIZE = 1000;
        let allSatellites = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('satellites')
            .select('norad_id, name, tle_line1, tle_line2, alt_km, lat, lng, velocity_kms')
            .order('norad_id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (error) {
            console.error(`[Boot] ❌ Supabase page error (from=${from}):`, error.message);
            break;
          }

          if (!data || data.length === 0) {
            hasMore = false;
            break;
          }

          allSatellites = allSatellites.concat(data);
          console.log(`[Boot] 📥 Loaded page ${Math.floor(from / PAGE_SIZE) + 1}: ${allSatellites.length} satellites so far…`);

          hasMore = data.length === PAGE_SIZE; // if we got a full page, there may be more
          from += PAGE_SIZE;
        }

        if (allSatellites.length > 0) {
          setSatelliteCache(allSatellites);
          console.log(`[Boot] ✅ Loaded ${allSatellites.length} satellites from Supabase cache`);
        } else {
          console.log('[Boot] ⚠️  Supabase satellites table is empty — will retry on next cron tick');
        }
      } catch (dbErr) {
        console.error('[Boot] ❌ Supabase fallback failed:', dbErr.message);
      }
    }
  };


  Promise.all([
    warmSatellites(),
    runNEOFetch(),
  ]).then(() => {
    console.log('[Boot] ✅ Cache warm-up complete — API is fully ready');
  }).catch(err => {
    console.error('[Boot] ⚠️  Cache warm-up error:', err.message);
    console.error('[Boot] API still running — data will load on next cron tick');
  });

} catch (err) {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
}
