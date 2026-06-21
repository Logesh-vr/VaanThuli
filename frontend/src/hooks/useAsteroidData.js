import { useState, useEffect, useRef } from 'react';

/**
 * Fetches asteroid data from the sky-bubble endpoint.
 * Re-fetches when user location or radius changes.
 * Asteroids are refreshed every 6 hours (their update frequency).
 */
export function useAsteroidData(userLocation, radius = 500) {
  const [asteroids, setAsteroids] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const intervalRef = useRef(null);

  const fetchAsteroids = async () => {
    const lat = userLocation?.lat ?? 0;
    const lng = userLocation?.lng ?? 0;

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(
        `${apiBase}/api/core/sky-bubble?lat=${lat}&lng=${lng}&radius=${radius}&type=asteroids`
      );
      if (!res.ok) return;

      const data  = await res.json();
      const neos  = (data.objects ?? []).filter(o => o.type === 'asteroid');
      setAsteroids(neos);
    } catch (err) {
      console.error('[useAsteroidData] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsteroids();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchAsteroids, 6 * 60 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [userLocation?.lat, userLocation?.lng, radius]);

  return { asteroids, loading };
}
