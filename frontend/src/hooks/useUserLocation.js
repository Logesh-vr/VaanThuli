import { useState } from 'react';

/**
 * Wraps the browser Geolocation API with loading/error state.
 * Call `request()` when user clicks "Use My Location".
 */
export function useUserLocation() {
  const [location, setLocation] = useState(null);
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const request = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Location access denied.');
        setLoading(false);
      },
      { timeout: 10_000, enableHighAccuracy: false },
    );
  };

  const clear = () => {
    setLocation(null);
    setError(null);
  };

  return { location, error, loading, request, clear };
}
