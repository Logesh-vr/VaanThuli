import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { asteroidPosition } from '../../utils/propagator';
import { COLORS } from '../../utils/constants';

/**
 * AsteroidMarker — single pulsing diamond-shaped marker for one asteroid.
 */
function AsteroidMarker({ neo, onSelect }) {
  const meshRef  = useRef();
  const glowRef  = useRef();
  const lineRef  = useRef();

  const pos      = useMemo(() => asteroidPosition(neo), [neo.id]);
  const color    = neo.hazardous ? COLORS.ASTEROID_HAZARD : COLORS.ASTEROID_NORMAL;

  // Approach line from asteroid to Earth center
  const linePoints = useMemo(() => {
    const origin = new THREE.Vector3(0, 0, 0);
    return [pos, origin];
  }, [pos]);

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
    return geo;
  }, [linePoints]);

  // Pulse animation
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (meshRef.current) {
      const scale = 1 + Math.sin(t * 2 + parseInt(neo.id, 10) || 0) * 0.15;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.15 + Math.sin(t * 2) * 0.08;
    }
  });

  const size = neo.hazardous ? 0.04 : 0.028;

  return (
    <group>
      {/* Trajectory line: asteroid → Earth */}
      <line ref={lineRef} geometry={lineGeo}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={neo.hazardous ? 0.35 : 0.15}
        />
      </line>

      {/* Asteroid marker */}
      <mesh
        ref={meshRef}
        position={pos}
        onClick={(e) => { e.stopPropagation(); onSelect?.(neo); }}
        onPointerEnter={() => { document.body.style.cursor = 'pointer'; }}
        onPointerLeave={() => { document.body.style.cursor = 'auto'; }}
      >
        <octahedronGeometry args={[size, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Outer glow sphere */}
      <mesh ref={glowRef} position={pos} scale={[2.5, 2.5, 2.5]}>
        <sphereGeometry args={[size, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * AsteroidLayer — renders all near-Earth asteroids as pulsing markers in 3D space.
 */
export function AsteroidLayer({ asteroids, visible, onSelect }) {
  if (!visible || !asteroids?.length) return null;

  return (
    <group>
      {asteroids.map(neo => (
        <AsteroidMarker
          key={neo.id}
          neo={neo}
          onSelect={(obj) => onSelect?.({ ...obj, type: 'asteroid' })}
        />
      ))}
    </group>
  );
}
