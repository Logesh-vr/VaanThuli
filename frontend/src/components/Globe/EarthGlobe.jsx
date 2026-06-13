import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Earth }          from './Earth';
import { Atmosphere }     from './Atmosphere';
import { SatelliteLayer } from './SatelliteLayer';
import { AsteroidLayer }  from './AsteroidLayer';
import { UserBubble }     from './UserBubble';

/**
 * EarthGlobe — full-screen Three.js Canvas with the complete 3D scene.
 *
 * Scene contents:
 *  - Deep space star field
 *  - Earth sphere (textured + clouds)
 *  - Atmosphere Fresnel glow
 *  - Satellite InstancedMesh layer
 *  - Asteroid markers
 *  - User GPS bubble
 *  - OrbitControls (auto-rotate, mouse drag, scroll zoom)
 */
export function EarthGlobe({
  filter,
  tleData,
  asteroids,
  userLocation,
  bubbleRadius,
  onSelectObject,
}) {
  const showSats      = filter === 'satellites' || filter === 'both';
  const showAsteroids = filter === 'asteroids'  || filter === 'both';

  return (
    <div className="globe-canvas">
      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 42, near: 0.1, far: 1000 }}
        gl={{
          antialias:    true,
          toneMapping:  THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        onPointerMissed={() => onSelectObject(null)}
      >
        {/* Lighting */}
        <ambientLight intensity={0.08} />
        <directionalLight
          position={[5, 3, 5]}
          intensity={1.4}
          color="#fff8f0"
        />

        {/* Space background */}
        <Stars
          radius={200}
          depth={60}
          count={6000}
          factor={4}
          saturation={0.1}
          fade
          speed={0.5}
        />

        {/* Earth + atmosphere */}
        <Suspense fallback={null}>
          <Earth />
          <Atmosphere />
        </Suspense>

        {/* Satellite dots */}
        <SatelliteLayer
          tleData={tleData}
          visible={showSats}
          onSelect={onSelectObject}
        />

        {/* Asteroid markers */}
        <AsteroidLayer
          asteroids={asteroids}
          visible={showAsteroids}
          onSelect={onSelectObject}
        />

        {/* User GPS bubble */}
        {userLocation && (
          <UserBubble
            lat={userLocation.lat}
            lng={userLocation.lng}
            radiusKm={bubbleRadius}
          />
        )}

        {/* Camera controls */}
        <OrbitControls
          enablePan={false}
          minDistance={1.3}
          maxDistance={6}
          autoRotate
          autoRotateSpeed={0.25}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
