import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '../../utils/propagator';
import { EARTH_RADIUS_KM, COLORS } from '../../utils/constants';

/**
 * UserBubble
 * ──────────
 * Renders the user's GPS position on the Earth globe with:
 *  1. A glowing green dot at the exact lat/lng position
 *  2. A flat ring on the Earth surface representing the bubble radius
 *  3. A translucent disc filling the bubble area
 *
 * The ring is oriented tangent to the sphere (normal = outward from Earth center).
 */
export function UserBubble({ lat, lng, radiusKm }) {
  const groupRef = useRef();
  const dotRef   = useRef();

  // Convert radius from km to Three.js units (Earth R = 1 unit)
  const ringRadius = radiusKm / EARTH_RADIUS_KM;

  // Position on Earth surface + tiny offset to avoid z-fighting
  const surfacePos = useMemo(
    () => latLngToVector3(lat, lng, 1.002),
    [lat, lng]
  );

  // Orient the group so its local Z axis points outward from Earth center
  // → Ring geometry (in XY plane) will lie tangent to the sphere
  useEffect(() => {
    if (!groupRef.current) return;
    const normal = surfacePos.clone().normalize();
    const quat   = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal
    );
    groupRef.current.position.copy(surfacePos);
    groupRef.current.quaternion.copy(quat);
  }, [surfacePos]);

  // Pulse the center dot
  useFrame(({ clock }) => {
    if (dotRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.3;
      dotRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Center marker dot */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshBasicMaterial color={COLORS.USER_BUBBLE} />
      </mesh>

      {/* Outer glow dot */}
      <mesh scale={[3, 3, 3]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial
          color={COLORS.USER_BUBBLE}
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      {/* Bubble ring */}
      <mesh>
        <ringGeometry args={[ringRadius * 0.96, ringRadius, 96]} />
        <meshBasicMaterial
          color={COLORS.USER_BUBBLE}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Translucent fill disc */}
      <mesh>
        <circleGeometry args={[ringRadius * 0.96, 96]} />
        <meshBasicMaterial
          color={COLORS.USER_BUBBLE}
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
