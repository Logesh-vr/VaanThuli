import { useState, useEffect, useCallback } from 'react';
import { EarthGlobe }    from './components/Globe/EarthGlobe';
import { HUD }           from './components/UI/HUD';
import { LoadingScreen } from './components/UI/LoadingScreen';
import { useTLEData }       from './hooks/useTLEData';
import { useAsteroidData }  from './hooks/useAsteroidData';
import { useUserLocation }  from './hooks/useUserLocation';
import { useGeminiInsight } from './hooks/useGeminiInsight';

export default function App() {
  const [filter,         setFilter]         = useState('both');
  const [bubbleRadius,   setBubbleRadius]   = useState(500);
  const [selectedObject, setSelectedObject] = useState(null);
  const [appReady,       setAppReady]       = useState(false);

  // Data hooks
  const { tleData, count: satCount, loading: tleLoading, source: tleSource } = useTLEData();
  const { location, loading: locLoading, request: requestLocation, clear: clearLocation } = useUserLocation();
  const { asteroids, loading: astLoading } = useAsteroidData(location, bubbleRadius);

  // AI Insight hook
  const { insight, loading: insightLoading, error: insightError, fetchInsight, clear: clearInsight } = useGeminiInsight();

  // Mark app ready once the initial loading phase completes.
  useEffect(() => {
    if (!tleLoading) {
      setTimeout(() => setAppReady(true), 800);
    }
  }, [tleLoading]);

  // Hard fallback: show the app after 3s no matter what
  useEffect(() => {
    const t = setTimeout(() => setAppReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // When an object is selected, fetch its AI insight
  const handleSelectObject = useCallback((obj) => {
    setSelectedObject(obj);
    if (obj) fetchInsight(obj);
  }, [fetchInsight]);

  const handleCloseCard = useCallback(() => {
    setSelectedObject(null);
    clearInsight();
  }, [clearInsight]);

  return (
    <div className="app">
      {/* Loading screen — fades out when data is ready */}
      <LoadingScreen done={appReady} />

      {/* 3D Globe */}
      <EarthGlobe
        filter={filter}
        tleData={tleData}
        asteroids={asteroids}
        userLocation={location}
        bubbleRadius={bubbleRadius}
        onSelectObject={handleSelectObject}
      />

      {/* HUD overlay */}
      <HUD
        filter={filter}
        setFilter={setFilter}
        satCount={satCount}
        asteroidCount={asteroids.length}
        tleSource={tleSource}
        userLocation={location}
        onRequestLocation={requestLocation}
        locationLoading={locLoading}
        onClearLocation={clearLocation}
        bubbleRadius={bubbleRadius}
        setBubbleRadius={setBubbleRadius}
        selectedObject={selectedObject}
        insight={insight}
        insightLoading={insightLoading}
        onCloseCard={handleCloseCard}
      />
    </div>
  );
}
