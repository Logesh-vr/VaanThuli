import { useState, useCallback } from 'react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Builds a rich prompt for satellites or asteroids.
 * Returns a short, punchy "cosmic ID card" in 3–4 sentences.
 */
function buildPrompt(obj) {
  if (obj.type === 'satellite') {
    return `You are a space data expert. Give me a short, punchy 3-sentence "cosmic ID card" about the satellite named "${obj.name}" (NORAD ID: ${obj.norad_id}). 
Currently it is flying at ${obj.altKm?.toFixed(0)} km altitude, at latitude ${obj.lat?.toFixed(2)}°, longitude ${obj.lng?.toFixed(2)}°.
Include: what it does, who launched it, and one surprising or cool fact. Write in an exciting, approachable tone — like you're narrating a space documentary. No bullet points, just prose.`;
  }

  if (obj.type === 'asteroid') {
    const hazard = obj.hazardous ? 'POTENTIALLY HAZARDOUS' : 'non-hazardous';
    const speed  = obj.velocity_km_s?.toFixed(2) ?? 'unknown';
    const miss   = obj.miss_distance_km?.toLocaleString() ?? 'unknown';
    const dia    = obj.diameter_m?.toFixed(0) ?? 'unknown';

    return `You are a planetary defense scientist. Give me a dramatic, punchy 3-sentence "cosmic ID card" about near-Earth asteroid "${obj.name}".
It is classified as ${hazard}, flying at ${speed} km/s, with a closest approach of ${miss} km from Earth. Its estimated diameter is ${dia} meters.
Include: what kind of asteroid it likely is, how this close-approach compares to the Moon's distance (384,400 km), and one wild fact about what would happen if it hit Earth. Write in a thrilling but factual tone. No bullet points.`;
  }

  return `Tell me one fascinating fact about the space object: ${obj.name}.`;
}

/**
 * useGeminiInsight — calls Gemini API to generate an AI "cosmic ID card"
 * for a selected satellite or asteroid.
 *
 * Usage:
 *   const { insight, loading, fetchInsight } = useGeminiInsight();
 *   fetchInsight(selectedObject);
 */
export function useGeminiInsight() {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetchInsight = useCallback(async (obj) => {
    if (!obj) return;
    setInsight('');
    setError(null);
    setLoading(true);

    try {
      if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('your-') || GEMINI_API_KEY.trim() === '') {
        // Direct local generation if no key is configured
        const text = generateLocalInsight(obj);
        // Simulate a tiny delay to make the AI feel "alive"
        await new Promise((resolve) => setTimeout(resolve, 600));
        setInsight(text);
        return;
      }

      const prompt = buildPrompt(obj);

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.85,
            maxOutputTokens: 220,
            topK:            40,
            topP:            0.95,
          },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini API ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      setInsight(text.trim());
    } catch (err) {
      console.warn('[useGeminiInsight] API failed, using high-quality local fallback:', err.message);
      const text = generateLocalInsight(obj);
      setInsight(text);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setInsight('');
    setError(null);
  }, []);

  return { insight, loading, error, fetchInsight, clear };
}

/**
 * Generates high-quality mock cosmic ID cards locally if Gemini API is unavailable.
 */
function generateLocalInsight(obj) {
  if (obj.type === 'satellite') {
    const nameUpper = (obj.name || '').toUpperCase();
    const norad = obj.norad_id || 'UNKNOWN';
    const alt = obj.altKm ? Math.round(obj.altKm) : 500;

    // 1. Check for specific well-known satellites
    if (nameUpper.includes('ISS') || nameUpper.includes('ZARYA') || norad === 25544) {
      return `The International Space Station (ISS) is a collaborative masterpiece of international science, orbiting at ${alt} km altitude. It acts as a permanently crewed microgravity laboratory, traveling at a staggering 28,000 km/h. Surprising fact: the onboard crew experiences 16 sunrises and sunsets every single day as they orbit Earth once every 90 minutes.`;
    }
    if (nameUpper.includes('STARLINK')) {
      return `Starlink is part of a massive satellite internet constellation operated by SpaceX. Positioned in low Earth orbit at ${alt} km, these satellites communicate using optical laser links to beam low-latency broadband to remote corners of the globe. Fun fact: they are designed to fully burn up in Earth's atmosphere at the end of their operational lifecycle, leaving no space debris behind.`;
    }
    if (nameUpper.includes('TIANGONG')) {
      return `Tiangong, meaning "Heavenly Palace," is China's advanced modular space station operating in low Earth orbit. Launched by the CNSA, it hosts crewed research teams conducting cutting-edge biotechnology and material science experiments. Surprising fact: the station operates a closed-loop life support system that recycles over 95% of its internal water and air.`;
    }
    if (nameUpper.includes('HUBBLE') || nameUpper.includes('HST') || norad === 20580) {
      return `The Hubble Space Telescope is a legendary observatory launched by NASA and ESA, currently orbiting at ${alt} km. Over its decades-long mission, Hubble has revolutionized our understanding of the universe, capturing breathtaking deep-space images and measuring the cosmic expansion rate. Fun fact: it has traveled more than 4 billion miles in a circular low Earth orbit.`;
    }
    if (nameUpper.includes('GPS') || nameUpper.includes('NAVSTAR')) {
      return `This is a Global Positioning System (GPS) satellite, part of the navigation constellation operated by the United States Space Force. From its altitude of ${alt} km, it transmits highly precise timing signals that enable mapping and navigation services worldwide. Fun fact: the atomic clocks onboard are so accurate they must be adjusted for relativistic time dilation to remain synchronized with Earth.`;
    }
    if (nameUpper.includes('GLONASS')) {
      return `This satellite belongs to GLONASS, the global satellite navigation network operated by Russia. Traveling in a medium Earth orbit at ${alt} km, it broadcasts dual-frequency navigation signals. Fun fact: GLONASS is particularly optimized to provide high-precision positioning data at higher northern latitudes.`;
    }
    if (nameUpper.includes('GALILEO')) {
      return `This is a Galileo satellite, Europe's independent and highly precise civilian global navigation system. Orbiting at ${alt} km, it provides centimeter-level positioning accuracy. Fun fact: Galileo's search-and-rescue function can pick up distress signals anywhere on Earth and transmit a confirmation signal back to the sender in real-time.`;
    }
    if (nameUpper.includes('BEIDOU') || nameUpper.includes('BDS')) {
      return `This satellite is part of BeiDou, China's global satellite navigation system. Positioned at ${alt} km altitude, the constellation provides high-precision positioning and short-message text communication services. Fun fact: BeiDou features satellites in geostationary, inclined geosynchronous, and medium Earth orbits.`;
    }
    if (nameUpper.includes('NOAA') || nameUpper.includes('METOP') || nameUpper.includes('GOES')) {
      return `This is a meteorological monitoring satellite, operated to track global weather patterns, ocean temperatures, and environmental changes. Orbiting at ${alt} km, it scans the atmosphere to predict storms and track climate trends. Fun fact: these space weather sentinels save thousands of lives annually by providing early warnings of incoming hurricanes.`;
    }

    // 2. Generic based on orbit altitude class
    if (alt < 2000) {
      return `The satellite "${obj.name}" (#${norad}) is orbiting in Low Earth Orbit (LEO) at an altitude of ${alt} km. In this zone, objects travel at about 7.8 km/s to combat gravity, completing a full orbit in under two hours. LEO is the busiest region of space, commonly used for high-speed communications, Earth imaging, and scientific observation.`;
    } else if (alt < 35786) {
      return `The satellite "${obj.name}" (#${norad}) operates in Medium Earth Orbit (MEO) at an altitude of ${alt} km. This stable orbital band is the home of global navigation constellations, providing vital positioning and timing signals. Satellites here experience a higher radiation environment and complete an orbit roughly every 12 hours.`;
    } else {
      return `The satellite "${obj.name}" (#${norad}) resides in Geostationary Earth Orbit (GEO) at an altitude of ${alt} km. At this precise distance, its orbital period matches Earth's rotation exactly, allowing it to hover indefinitely over the same spot on the equator. This unique position makes it perfect for communications and continuous weather monitoring.`;
    }
  }

  if (obj.type === 'asteroid') {
    const isHazard = obj.hazardous;
    const speed = obj.velocityKms ?? obj.velocity_km_s ?? 15;
    const rawMiss = obj.missDistanceKm ?? obj.miss_distance_km;
    const missVal = rawMiss ? Number(rawMiss) : 10000000;
    const miss = missVal ? (missVal / 1e6).toFixed(2) + 'M' : '10M';
    const rawDia = obj.estimatedDiameterKm
      ? (obj.estimatedDiameterKm.min + obj.estimatedDiameterKm.max) * 500
      : (obj.diameter_m ?? 150);
    const dia = Math.round(Number(rawDia));

    const moonDist = 384400;
    const timesMoon = (missVal / moonDist).toFixed(1);

    const hazardText = isHazard ? "classified as potentially hazardous" : "classified as non-hazardous";
    const impactEffect = dia > 1000
      ? "trigger a global ecological catastrophe, blocking out sunlight and causing global cooling"
      : dia > 140
      ? "devastate an entire metropolitan area, leaving a crater several kilometers wide and unleashing shockwaves for hundreds of miles"
      : "disintegrate in a spectacular atmospheric airburst, releasing energy equivalent to multiple Hiroshima-sized atomic bombs";

    return `Asteroid "${obj.name}" is a rocky remnant from the early solar system, ${hazardText}. It is traveling through deep space at a velocity of ${speed.toFixed(1)} km/s and will pass ${miss} km from Earth—roughly ${timesMoon} times the distance to the Moon. If a rocky body of this size (${dia} meters) were to collide with Earth, it would ${impactEffect}.`;
  }

  return `An interesting cosmic object named "${obj.name}" currently traveling through our solar system. Detailed physical properties and orbital characteristics are being monitored in real time.`;
}
