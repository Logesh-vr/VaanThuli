import { useState, useEffect } from 'react';
import { TLE_REFRESH_MS } from '../utils/constants';
import { FALLBACK_TLES } from '../utils/fallbackTles';

/**
 * Fetches the raw TLE array from the backend and refreshes every 10 minutes.
 * The frontend uses satellite.js to propagate positions client-side.
 *
 * Fallback: if the backend is still rate-limited by CelesTrak (503),
 * we immediately show the curated FALLBACK_TLES set so the satellite
 * layer is never empty, then keep retrying silently in the background.
 */
export function useTLEData() {
  const [tleData, setTleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [source,  setSource]  = useState('loading'); // 'backend' | 'fallback' | 'loading'

  const fetchTLEs = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${apiBase}/api/core/tles`);

      if (res.status === 503) {
        // Backend TLE cache not ready (CelesTrak rate-limit).
        // Show fallback satellites immediately so the globe isn't empty.
        if (!tleData || source === 'fallback') {
          setTleData(FALLBACK_TLES);
          setSource('fallback');
        }
        setLoading(false);
        // Retry silently in the background every 30s
        setTimeout(fetchTLEs, 30_000);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setTleData(data);
      setSource('backend');
      setError(null);
    } catch (err) {
      console.error('[useTLEData] Fetch error:', err.message);
      setError(err.message);
      // On network error, still show fallback
      if (!tleData) {
        setTleData(FALLBACK_TLES);
        setSource('fallback');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTLEs();
    const interval = setInterval(fetchTLEs, TLE_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    tleData,
    count:   tleData?.length ?? 0,
    loading,
    error,
    source,  // expose so UI can show "LIVE" vs "DEMO" badge
  };
}
