import { useState, useCallback } from 'react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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
      console.error('[useGeminiInsight]', err.message);
      setError('AI insight unavailable');
      setInsight('');
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
