/**
 * tleData.js
 * ──────────
 * GET /api/core/tles
 * Serves the raw TLE array from NodeCache for client-side propagation.
 * The frontend uses satellite.js locally to animate satellites at 60fps.
 */

import { getSatelliteCache } from '../services/cacheService.js';

export default async function tleDataRoute(fastify) {
  // Full TLE array — frontend parses satrecs and propagates locally
  fastify.get('/api/core/tles', async (request, reply) => {
    const cached = getSatelliteCache();

    if (!cached || cached.length === 0) {
      return reply.code(503).send({
        status:   'unavailable',
        message:  'TLE data is still loading. Retry in ~15 seconds after server start.',
        retryIn:  15,
      });
    }

    // Return only fields the frontend needs for propagation + display
    const tles = cached.map(sat => ({
      norad_id:  sat.norad_id,
      name:      sat.name,
      tle_line1: sat.tle_line1,
      tle_line2: sat.tle_line2,
      alt_km:    sat.alt_km,        // Last known altitude (for initial color)
    }));

    reply.header('Cache-Control', 'public, max-age=300'); // 5-min browser cache
    return reply.code(200).send(tles);
  });

  // Lightweight count endpoint — for UI stats bar polling
  fastify.get('/api/core/tles/count', async (request, reply) => {
    const cached = getSatelliteCache();
    return reply.code(200).send({
      count:      cached?.length ?? 0,
      ready:      !!cached,
      timestamp:  new Date().toISOString(),
    });
  });
}
