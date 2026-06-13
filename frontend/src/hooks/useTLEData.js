import { useState, useEffect } from 'react';
import { TLE_REFRESH_MS } from '../utils/constants';

/**
 * Fetches the raw TLE array from the backend and refreshes every 10 minutes.
 * The frontend uses satellite.js to propagate positions client-side.
 */
export function useTLEData() {
  const [tleData, setTleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchTLEs = async () => {
    try {
      const res = await fetch('/api/core/tles');

      if (res.status === 503) {
        // Backend is still warming up — retry in 5 seconds
        setTimeout(fetchTLEs, 5000);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setTleData(data);
      setError(null);
    } catch (err) {
      console.error('[useTLEData] Fetch error:', err.message);
      setError(err.message);
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
  };
}
