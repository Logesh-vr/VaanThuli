import { Suspense, useRef, Component } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Use reliable CDN textures to bypass local loading issues
const EARTH_DAY_URL    = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg';
const EARTH_NIGHT_URL  = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_lights_2048.png';
const EARTH_CLOUDS_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_clouds_1024.png';

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

/** Solid blue-navy fallback sphere shown while textures stream in */
function EarthFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshPhongMaterial color="#0a2a5a" emissive="#001020" shininess={5} />
    </mesh>
  );
}

/**
 * Error boundary — if textures fail to load, render the fallback sphere
 * so the rest of the 3D scene is not destroyed.
 */
class EarthErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <EarthFallback />;
    return this.props.children;
  }
}

/**
 * Earth — exported component with Suspense + error boundary.
 * Shows a solid sphere while textures load, and if they fail.
 */
export function Earth() {
  return (
    <EarthErrorBoundary>
      <Suspense fallback={<EarthFallback />}>
        <EarthSphere />
      </Suspense>
    </EarthErrorBoundary>
  );
}
