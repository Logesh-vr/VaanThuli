import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// NASA Blue Marble textures via three-globe unpkg CDN
const EARTH_DAY_URL    = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const EARTH_NIGHT_URL  = 'https://unpkg.com/three-globe/example/img/earth-night.jpg';
const EARTH_CLOUDS_URL = 'https://unpkg.com/three-globe/example/img/earth-clouds.png';

/**
 * EarthSphere — the textured Earth mesh with slow cloud rotation.
 * Wrapped in Suspense because useTexture suspends while loading.
 */
function EarthSphere() {
  const cloudsRef = useRef();

  const [earthDay, earthNight, clouds] = useTexture([
    EARTH_DAY_URL,
    EARTH_NIGHT_URL,
    EARTH_CLOUDS_URL,
  ]);

  // Slow cloud layer rotation
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.025;
    }
  });

  return (
    <group>
      {/* Earth */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={earthDay}
          emissiveMap={earthNight}
          emissive={new THREE.Color(0x888888)}
          emissiveIntensity={0.8}
          specular={new THREE.Color(0x222244)}
          shininess={12}
        />
      </mesh>

      {/* Cloud layer — slightly larger, slow independent rotation */}
      <mesh ref={cloudsRef} scale={[1.006, 1.006, 1.006]}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhongMaterial
          map={clouds}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Earth — exported component with Suspense fallback.
 * Shows a solid sphere while textures load.
 */
export function Earth() {
  return (
    <Suspense fallback={
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#0a1a3a" />
      </mesh>
    }>
      <EarthSphere />
    </Suspense>
  );
}
