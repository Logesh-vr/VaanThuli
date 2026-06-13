/**
 * skyBubble.js
 * ────────────
 * Route handler for GET /api/core/sky-bubble
 *
 * The "Local Bubble" Filter — returns all cosmic objects (satellites and/or
 * asteroids) currently active within a localized atmospheric sphere around
 * the user's GPS coordinates.
 *
 * Query Parameters:
 * ┌─────────────┬────────┬──────────┬─────────────────────────────────────┐
 * │ Param       │ Type   │ Default  │ Description                         │
 * ├─────────────┼────────┼──────────┼─────────────────────────────────────┤
 * │ lat         │ float  │ required │ User GPS latitude  (-90 to 90)      │
 * │ lng         │ float  │ required │ User GPS longitude (-180 to 180)    │
 * │ radius      │ int    │ 500      │ Bubble radius in km (max 5000)      │
 * │ type        │ string │ "both"   │ "satellites" | "asteroids" | "both" │
 * │ limit       │ int    │ 100      │ Max satellite results (max 500)     │
 * └─────────────┴────────┴──────────┴─────────────────────────────────────┘
 *
 * Response Time Targets:
 *   L1 cache hit:  < 10ms  (Haversine in-memory filter)
 *   L1 cache miss: < 200ms (Supabase PostGIS ST_DWithin fallback)
 */

import {
  getSatelliteCache,
  getAsteroidCache,
} from '../services/cacheService.js';

import {
  filterSatellitesInBubble,
  filterAsteroidsForBubble,
} from '../services/geometryService.js';

import { supabase } from '../db/supabaseClient.js';

// ── Parameter Constraints ──────────────────────────────────────
const RADIUS_DEFAULT = 500;
const RADIUS_MAX     = 5000;
const LIMIT_DEFAULT  = 100;
const LIMIT_MAX      = 500;

// ── Supabase Fallback (L2) ─────────────────────────────────────

/**
 * Falls back to Supabase PostGIS ST_DWithin query when L1 cache is cold.
 * This uses the stored function defined in schema.sql.
 */
async function querySupabaseBubble(lat, lng, radiusKm) {
  const { data, error } = await supabase.rpc('objects_near', {
    p_lat:       lat,
    p_lng:       lng,
    p_radius_km: radiusKm,
  });

  if (error) {
    throw new Error(`Supabase PostGIS query failed: ${error.message}`);
  }

  return (data ?? []).map(row => ({
    id:                 row.norad_id,
    name:               row.name,
    type:               'satellite',
    lat:                row.lat,
    lng:                row.lng,
    altKm:              row.alt_km,
    velocityKms:        row.velocity_kms,
    distanceFromUserKm: row.distance_km,
    propagatedAt:       row.propagated_at,
    source:             'supabase_l2', // Flag for debugging
  }));
}

// ── Route Handler ──────────────────────────────────────────────

export default async function skyBubbleRoute(fastify) {
  fastify.get('/api/core/sky-bubble', {
    schema: {
      description: 'Returns cosmic objects within a localized bubble around user GPS coordinates',
      tags:        ['core'],
      querystring: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat:    { type: 'number', minimum: -90,  maximum: 90 },
          lng:    { type: 'number', minimum: -180, maximum: 180 },
          radius: { type: 'integer', minimum: 1, maximum: RADIUS_MAX, default: RADIUS_DEFAULT },
          type:   { type: 'string', enum: ['satellites', 'asteroids', 'both'], default: 'both' },
          limit:  { type: 'integer', minimum: 1, maximum: LIMIT_MAX,   default: LIMIT_DEFAULT },
        },
      },
    },
  }, async (request, reply) => {
    const reqStart = Date.now();

    const {
      lat,
      lng,
      radius = RADIUS_DEFAULT,
      type   = 'both',
      limit  = LIMIT_DEFAULT,
    } = request.query;

    let satellites = [];
    let asteroids  = [];
    let cacheSource = 'l1_memory';

    try {
      // ── Satellite Filtering ──────────────────────────────────
      if (type === 'satellites' || type === 'both') {
        const cachedSats = getSatelliteCache();

        if (cachedSats) {
          // L1 hit: in-memory Haversine filter (< 5ms for 8k satellites)
          satellites = filterSatellitesInBubble(cachedSats, lat, lng, radius);
        } else {
          // L1 miss: fall back to Supabase PostGIS ST_DWithin
          cacheSource = 'l2_supabase';
          request.log.warn('L1 cache miss for satellites — falling back to Supabase');
          satellites = await querySupabaseBubble(lat, lng, radius);
        }

        // Apply limit
        satellites = satellites.slice(0, limit);
      }

      // ── Asteroid Filtering ───────────────────────────────────
      if (type === 'asteroids' || type === 'both') {
        const cachedNeos = getAsteroidCache();

        if (cachedNeos) {
          asteroids = filterAsteroidsForBubble(cachedNeos);
        } else {
          // L1 miss: query Supabase for next 7 days of asteroids
          cacheSource = 'l2_supabase';
          const { data } = await supabase
            .from('asteroids')
            .select('*')
            .gte('close_approach_date', new Date().toISOString().slice(0, 10))
            .order('close_approach_date', { ascending: true })
            .limit(50);

          asteroids = (data ?? []).map(neo => ({
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
            source:              'supabase_l2',
          }));
        }
      }

      // ── Build Response ───────────────────────────────────────
      const responseTimeMs = Date.now() - reqStart;

      return reply.code(200).send({
        status: 'ok',
        meta: {
          bubble: {
            lat,
            lng,
            radiusKm: radius,
          },
          filter:          type,
          responseTimeMs,
          cacheSource,
          timestamp:       new Date().toISOString(),
        },
        count: {
          satellites: satellites.length,
          asteroids:  asteroids.length,
          total:      satellites.length + asteroids.length,
        },
        objects: [
          ...satellites,
          ...asteroids,
        ],
      });

    } catch (err) {
      request.log.error(err, 'sky-bubble route error');
      return reply.code(500).send({
        status:  'error',
        message: err.message || 'Internal server error',
      });
    }
  });
}
