# VaanThuli Backend

Real-time cosmic object tracking backend — satellites (CelesTrak TLE) + near-Earth asteroids (NASA NeoWs).

## Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Set up Supabase schema
1. Go to your Supabase dashboard → **SQL Editor**
2. Open and run the entire contents of `src/db/schema.sql`
3. Verify with: `SELECT PostGIS_Version();`

### 3. Run the server
```bash
npm run dev
```

The server starts on **http://localhost:3001**. On first boot it immediately fetches all satellite TLEs (~6,000) and asteroid data. Expect ~10-15 seconds for the first data load.

---

## API Reference

### `GET /api/health`
Returns server status and cache statistics.

```json
{
  "status": "ok",
  "uptime": 42,
  "cache": {
    "satellite_count": 6134,
    "asteroid_count": 28,
    "satellite_ttl_remaining": 7020
  }
}
```

### `GET /api/core/sky-bubble`

Returns all cosmic objects passing through a localized atmospheric bubble around user GPS coordinates.

| Parameter | Type    | Default | Description |
|-----------|---------|---------|-------------|
| `lat`     | float   | **required** | User latitude (-90 to 90) |
| `lng`     | float   | **required** | User longitude (-180 to 180) |
| `radius`  | integer | `500`   | Bubble radius in km (max 5000) |
| `type`    | string  | `both`  | `satellites` \| `asteroids` \| `both` |
| `limit`   | integer | `100`   | Max satellite results (max 500) |

**Example — Bengaluru, 500km bubble:**
```bash
curl "http://localhost:3001/api/core/sky-bubble?lat=12.97&lng=77.59&radius=500&type=both"
```

**Response shape:**
```json
{
  "status": "ok",
  "meta": {
    "bubble": { "lat": 12.97, "lng": 77.59, "radiusKm": 500 },
    "filter": "both",
    "responseTimeMs": 4,
    "cacheSource": "l1_memory"
  },
  "count": {
    "satellites": 3,
    "asteroids": 2,
    "total": 5
  },
  "objects": [
    {
      "id": "25544",
      "name": "ISS (ZARYA)",
      "type": "satellite",
      "lat": 13.21,
      "lng": 78.44,
      "altKm": 408.3,
      "velocityKms": 7.66,
      "distanceFromUserKm": 142.3,
      "propagatedAt": "2026-06-14T02:10:00.000Z"
    },
    {
      "id": "3542519",
      "name": "2010 PK9",
      "type": "asteroid",
      "estimatedDiameterKm": { "min": 0.1, "max": 0.2 },
      "velocityKms": 12.34,
      "missDistanceKm": 1847190,
      "hazardous": false,
      "closeApproachDate": "2026-06-14"
    }
  ]
}
```

---

## Architecture

```
CelesTrak TLE API ──► tleFetcher.js (every 2h)
                            │
                            ▼
                     propagator.js (satellite.js SGP4)
                            │
                    ┌───────┴────────┐
                    ▼                ▼
            NodeCache (L1)    Supabase PostGIS (L2)
            ~1ms reads        ST_DWithin queries
                    │
                    ▼
         GET /api/core/sky-bubble
              Haversine filter
                    │
                    ▼
              JSON Response

NASA NeoWs API ──► neoFetcher.js (every 6h)
                            │
                    ┌───────┴────────┐
                    ▼                ▼
            NodeCache (L1)    Supabase (L2)
```

## Data Sources

| Source | Endpoint | Update Frequency |
|--------|----------|-----------------|
| CelesTrak | `gp.php?GROUP=active&FORMAT=tle` | Every 2 hours |
| NASA NeoWs | `/neo/rest/v1/feed` | Every 6 hours |

## Environment Variables

See `.env.example` for all variables. Key ones:

```
SUPABASE_URL         Your Supabase project URL
SUPABASE_ANON_KEY    Your Supabase anon key
NASA_API_KEY         NASA API key (1000 req/hr)
PORT                 Server port (default: 3001)
```

## Important Notes

- **CelesTrak rate limit**: Do NOT poll more than once every 2 hours — excessive requests trigger IP bans
- **Satellite positions**: Computed once per fetch cycle using SGP4 propagation, not in real-time per request. For live tracking, the frontend should call `/api/core/sky-bubble` every 10-30 seconds
- **Asteroid geography**: Asteroids don't have a ground track (they're in heliocentric orbit). The bubble returns all upcoming asteroids regardless of lat/lng
- **PostGIS**: The `schema.sql` must be run before the server starts or the Supabase fallback will fail
