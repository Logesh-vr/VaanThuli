import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

// Custom Fresnel atmosphere shader
const AtmosphereMaterial = shaderMaterial(
  // Uniforms
  { uColor: new THREE.Color('#3399ff') },

  // Vertex shader
  `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  // Fragment shader — Fresnel glow at limb edges
  `
    varying vec3 vNormal;
    uniform vec3 uColor;
    void main() {
      float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
      gl_FragColor = vec4(uColor, 1.0) * intensity;
    }
  `
);

extend({ AtmosphereMaterial });

/**
 * Atmosphere — a slightly oversized sphere rendered from the inside (BackSide),
 * using a Fresnel shader to create a blue atmospheric glow around Earth's limb.
 */
export function Atmosphere() {
  return (
    <mesh scale={[1.08, 1.08, 1.08]}>
      <sphereGeometry args={[1, 48, 48]} />
      <atmosphereMaterial
        uColor={new THREE.Color('#2277ee')}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
