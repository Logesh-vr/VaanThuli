import { useState, useEffect } from 'react';
import { EarthGlobe }    from './components/Globe/EarthGlobe';
import { HUD }           from './components/UI/HUD';
import { LoadingScreen } from './components/UI/LoadingScreen';
import { useTLEData }        from './hooks/useTLEData';
import { useAsteroidData }   from './hooks/useAsteroidData';
import { useUserLocation }   from './hooks/useUserLocation';

export default function App() {
  const [filter,         setFilter]         = useState('both');
  const [bubbleRadius,   setBubbleRadius]   = useState(500);
  const [selectedObject, setSelectedObject] = useState(null);
  const [appReady,       setAppReady]       = useState(false);

  // Data hooks
  const { tleData, count: satCount, loading: tleLoading } = useTLEData();
  const { location, loading: locLoading, request: requestLocation, clear: clearLocation } = useUserLocation();
  const { asteroids, loading: astLoading } = useAsteroidData(location, bubbleRadius);

  // Mark app ready when TLE data arrives (asteroids + textures can load after)
  useEffect(() => {
    if (!tleLoading && tleData) {
      setTimeout(() => setAppReady(true), 800);
    }
  }, [tleLoading, tleData]);

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
        onSelectObject={setSelectedObject}
      />

      {/* HUD overlay */}
      <HUD
        filter={filter}
        setFilter={setFilter}
        satCount={satCount}
        asteroidCount={asteroids.length}
        userLocation={location}
        onRequestLocation={requestLocation}
        locationLoading={locLoading}
        onClearLocation={clearLocation}
        bubbleRadius={bubbleRadius}
        setBubbleRadius={setBubbleRadius}
        selectedObject={selectedObject}
        onCloseCard={() => setSelectedObject(null)}
      />
    </div>
  );
}
