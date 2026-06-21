# 🌌 VaanThuli (வான் துளி)

> **VaanThuli** (meaning *Sky Drop* or *Raindrop from Sky* in Tamil) is a real-time, interactive 3D space tracking system that visualizes over **15,000+ active satellites** and upcoming **Near-Earth Asteroids** inside a localized atmospheric "Sky Bubble" using Three.js, Fastify, Supabase PostGIS, and Google Gemini 2.5 Flash.

---

## 🚀 Key Features

* **Interactive 3D Space Globe**: A visually stunning 3D visualization of Earth, its atmosphere, satellite constellations, and asteroid vectors using **React Three Fiber (R3F)** and **Three.js**.
* **Localized Sky Bubble**: Enter your GPS coordinates (or use default presets like Bengaluru) and define a search radius (up to 5,000 km) to create a virtual hemisphere. The system dynamically filters and highlights every satellite and asteroid passing directly over your head.
* **15,690+ Active Satellites**: Tracks the orbits of all currently active satellites using real-time **Two-Line Element (TLE)** sets from CelesTrak, propagated on the backend via SGP4.
* **Near-Earth Asteroids**: Integrates with the **NASA NeoWs (Near-Earth Object Web Service) API** to track upcoming asteroids, estimate their diameter, speed, miss distance, and hazardous status.
* **Gemini 2.5 Flash Cosmic Cards**: Click on any satellite or asteroid on the globe to prompt **Gemini 2.5 Flash** to generate a punchy, 3-sentence "Cosmic ID Card" containing who launched it, its purpose, and one surprising historical or planetary defense fact.
* **Resilient Dual-Layer Cache**:
  - **L1 Cache (In-Memory)**: Sub-millisecond queries on active objects using `node-cache`.
  - **L2 Cache (Supabase + PostGIS)**: Permanent geographical tracking. If CelesTrak rate-limits the server, a paginated fallback query retrieves all 15,699+ satellites from Supabase instantly.

---

## 🛠️ Technology Stack

### Frontend
* **React 19** + **Vite 8**
* **Three.js** + **React Three Fiber (R3F)** + **Drei** (WebGL 3D graphics rendering)
* **Tailwind CSS** or Custom CSS (Aesthetic glassmorphism UI & HUD panels)
* **Gemini 2.5 Flash API** (Generative AI insights)

### Backend
* **Node.js** (v20+) + **Fastify v4** (High-throughput server framework)
* **PostgreSQL / Supabase** with the **PostGIS** extension (Spatial database and index calculations)
* **Satellite.js** (SGP4 orbital propagation library)
* **Node-Cron** & **Node-Cache** (Automated schedulers and memory caching)

---

## 📐 System Architecture

```
                 🌐 CelesTrak TLE API (Every 2h)
                              │
                              ▼
        🚀 backend/src/schedulers/tleFetcher.js
                              │ (Propagator.js - SGP4)
                              ▼
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   ⚡ NodeCache (L1)                   💾 Supabase PostGIS (L2)
   (Sub-ms in-memory reads)            (ST_DWithin spatial query)
            │                                   │
            └─────────────────┬─────────────────┘
                              ▼
                   📡 Fastify API Endpoints
                    └─► GET /api/core/tles
                    └─► GET /api/core/sky-bubble
                              │
                              ▼
              🎮 3D Web Frontend (React + R3F)
               ├── Interactive Globe & Orbit Layers
               ├── Real-time Vector Conversions
               └── Gemini 2.5 Flash "Cosmic Card" Insights
```

---

## 📦 Directory Structure

```
VaanThuli/
├── backend/                  # Fastify Backend Service
│   ├── src/
│   │   ├── db/              # Supabase Client & SQL Schema
│   │   ├── routes/          # REST Endpoints (TLEs, Sky Bubble)
│   │   ├── schedulers/      # Cron jobs (CelesTrak & NASA NeoWs fetchers)
│   │   ├── services/        # SGP4 Propagator & Geo distance math
│   │   └── server.js        # Main entry point
│   ├── .env.example
│   └── package.json
└── frontend/                 # React Frontend Client
    ├── src/
    │   ├── components/      # UI Overlays & Three.js/R3F layers
    │   │   ├── Globe/       # Earth, Atmosphere, Satellite & Asteroid layers
    │   │   └── UI/          # Heads-Up-Display (HUD), Object cards, & stats
    │   ├── hooks/           # Gemini API Integration hooks
    │   ├── utils/           # Vector math & static orbital calculations
    │   └── main.jsx
    ├── index.html
    └── package.json
```

---

## 🔧 Installation & Setup

### Prerequisites
* **Node.js** (v20.0.0 or higher)
* **Supabase Account** (with database access)
* **NASA API Key** (Get a free one [here](https://api.nasa.gov/))
* **Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/))

---

### Step 1: Database Setup (Supabase PostGIS)

1. Open your **Supabase Dashboard** -> Go to **SQL Editor**.
2. Run the SQL script located in `backend/src/db/schema.sql` to enable PostGIS, create tables, and install the RPC mapping function:
   ```sql
   -- Enables PostGIS spatial extensions
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Verify that the tables `satellites` and `asteroids` are created, along with the `objects_near` RPC function.

---

### Step 2: Backend Configuration

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
4. Fill in your environment credentials:
   ```env
   PORT=3001
   SUPABASE_URL=https://your-supabase-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   NASA_API_KEY=your-nasa-api-key
   ```
5. Start the development server (runs with hot-reloading):
   ```bash
   npm run dev
   ```
   *Note: On first startup, if CelesTrak rate-limits your request, the server will fetch in pages from Supabase to load all 15,699+ satellites into the cache.*

---

### Step 3: Frontend Configuration

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the frontend folder:
   ```bash
   # Add your Gemini Key to generate Cosmic Cards
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📡 API Documentation

### 1. `GET /api/core/sky-bubble`
Returns all satellites and asteroids passing through a localized atmospheric bubble around a set of coordinates.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `lat` | float | Yes | - | Latitude coordinate (-90 to 90) |
| `lng` | float | Yes | - | Longitude coordinate (-180 to 180) |
| `radius` | int | No | `500` | Radar radius in kilometers (max 5000) |
| `type` | string | No | `both` | Filter: `satellites` \| `asteroids` \| `both` |
| `limit` | int | No | `100` | Limits number of satellites returned |

**Example Request:**
```bash
curl "http://localhost:3001/api/core/sky-bubble?lat=12.9716&lng=77.5946&radius=500&type=both"
```

---

### 2. `GET /api/core/tles`
Returns the active list of all satellites currently loaded in cache with propagated coordinates. Used by the frontend to render global satellite orbits.

---

## ☄️ Orbit Categorization Colors

The 3D renderer highlights satellite categories based on their altitude (represented as custom glow rings around Earth):
* 🩵 **Low Earth Orbit (LEO)** (Altitude < 2,000 km): *Cyan*
* 💙 **Medium Earth Orbit (MEO)** (Altitude 2,000 km - 35,786 km): *Blue*
* 🧡 **Geostationary Orbit (GEO)** (Altitude = 35,786 km): *Orange*
* ☄️ **Asteroids**: *Orange (Normal) / Red (Hazardous)*
* 🟢 **User Sky Bubble**: *Neon Green*

---

## 🛡️ License

This project is licensed under the MIT License. See the `LICENSE` file for details.
