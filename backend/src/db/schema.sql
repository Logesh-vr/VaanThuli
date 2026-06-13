-- ══════════════════════════════════════════════════════════════
--  VaanThuli — Supabase PostGIS Schema
--  Run this entire file in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Enable PostGIS Extension ───────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 2. Satellites Table ───────────────────────────────────────
-- Stores the last known propagated position of each tracked satellite.
-- Updated every ~2 hours by the TLE scheduler.

CREATE TABLE IF NOT EXISTS satellites (
  -- Primary identity
  norad_id        TEXT PRIMARY KEY,          -- CelesTrak OBJECT_ID (e.g. "25544")
  name            TEXT NOT NULL,             -- Human-readable name (e.g. "ISS (ZARYA)")
  object_id       TEXT,                      -- International designator (e.g. "1998-067A")

  -- Raw TLE lines (stored for re-propagation if needed)
  tle_line1       TEXT NOT NULL,
  tle_line2       TEXT NOT NULL,

  -- Propagated position (computed at fetch time)
  lat             DOUBLE PRECISION,          -- Degrees (-90 to 90)
  lng             DOUBLE PRECISION,          -- Degrees (-180 to 180)
  alt_km          DOUBLE PRECISION,          -- Altitude above Earth surface in km
  velocity_kms    DOUBLE PRECISION,          -- Speed in km/s

  -- PostGIS geography column for spatial queries
  -- NOTE: Uses (longitude, latitude) order — standard for PostGIS
  location        GEOGRAPHY(POINT, 4326),

  -- Metadata
  epoch           TEXT,                      -- TLE epoch string
  propagated_at   TIMESTAMPTZ DEFAULT NOW(), -- When position was last computed
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- GIST spatial index — critical for fast ST_DWithin queries
CREATE INDEX IF NOT EXISTS idx_satellites_location
  ON satellites USING GIST (location);

-- Regular index for common name lookups
CREATE INDEX IF NOT EXISTS idx_satellites_name
  ON satellites (name);


-- ── 3. Asteroids Table ────────────────────────────────────────
-- Stores Near-Earth Objects from NASA NeoWs API.
-- Updated every ~6 hours. Covers the next 7-day approach window.

CREATE TABLE IF NOT EXISTS asteroids (
  -- Primary identity (NASA's JPL ID)
  neo_id                  TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  neo_reference_id        TEXT,

  -- Physical characteristics
  absolute_magnitude_h    DOUBLE PRECISION,
  est_diameter_km_min     DOUBLE PRECISION,
  est_diameter_km_max     DOUBLE PRECISION,

  -- Close approach data (nearest upcoming approach)
  close_approach_date     DATE,
  close_approach_full     TEXT,              -- e.g. "2026-Jun-14 18:32"
  epoch_close_approach_ms BIGINT,            -- Unix timestamp in ms

  -- Velocity & distance
  velocity_kms            DOUBLE PRECISION,  -- km/s relative to Earth
  velocity_kmh            DOUBLE PRECISION,  -- km/h
  miss_distance_km        DOUBLE PRECISION,  -- Miss distance in km
  miss_distance_au        DOUBLE PRECISION,  -- In astronomical units
  miss_distance_lunar     DOUBLE PRECISION,  -- In lunar distances

  -- Risk flags
  is_hazardous            BOOLEAN DEFAULT FALSE,
  is_sentry_object        BOOLEAN DEFAULT FALSE,

  -- Raw payload (for frontend flexibility)
  raw_data                JSONB,

  -- Timestamps
  fetched_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Index on approach date for time-range queries
CREATE INDEX IF NOT EXISTS idx_asteroids_approach_date
  ON asteroids (close_approach_date);

-- Index for hazardous flag queries
CREATE INDEX IF NOT EXISTS idx_asteroids_hazardous
  ON asteroids (is_hazardous);


-- ── 4. Disable Row Level Security (Server-side access) ────────
-- We use the server's anon key directly from backend.
-- For production, replace with proper RLS policies.
ALTER TABLE satellites DISABLE ROW LEVEL SECURITY;
ALTER TABLE asteroids  DISABLE ROW LEVEL SECURITY;


-- ── 5. PostGIS RPC Function — objects_near ────────────────────
-- Called from backend via supabase.rpc('objects_near', {...})
-- Returns satellites within a given radius of a GPS coordinate.

CREATE OR REPLACE FUNCTION objects_near(
  p_lat       DOUBLE PRECISION,
  p_lng       DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION
)
RETURNS TABLE (
  norad_id        TEXT,
  name            TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  alt_km          DOUBLE PRECISION,
  velocity_kms    DOUBLE PRECISION,
  distance_km     DOUBLE PRECISION,
  propagated_at   TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
  SELECT
    norad_id,
    name,
    lat,
    lng,
    alt_km,
    velocity_kms,
    ROUND((ST_Distance(
      location,
      ST_MakePoint(p_lng, p_lat)::GEOGRAPHY
    ) / 1000.0)::NUMERIC, 2)::DOUBLE PRECISION AS distance_km,
    propagated_at
  FROM satellites
  WHERE
    location IS NOT NULL
    AND ST_DWithin(
      location,
      ST_MakePoint(p_lng, p_lat)::GEOGRAPHY,
      p_radius_km * 1000   -- ST_DWithin uses metres for GEOGRAPHY type
    )
  ORDER BY distance_km ASC;
$$;


-- ── 6. Helper: Update location from lat/lng ───────────────────
-- Trigger to auto-sync the geography column whenever lat/lng changes.

CREATE OR REPLACE FUNCTION sync_satellite_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_MakePoint(NEW.lng, NEW.lat)::GEOGRAPHY;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_satellite_location ON satellites;
CREATE TRIGGER trg_sync_satellite_location
  BEFORE INSERT OR UPDATE ON satellites
  FOR EACH ROW EXECUTE FUNCTION sync_satellite_location();


-- ── Verify setup ──────────────────────────────────────────────
-- Run these to confirm everything is in order:
-- SELECT PostGIS_Version();
-- SELECT COUNT(*) FROM satellites;
-- SELECT COUNT(*) FROM asteroids;
