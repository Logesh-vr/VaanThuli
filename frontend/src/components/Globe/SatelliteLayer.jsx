import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3, altToRadius, getOrbitColor, propagateTLE } from '../../utils/propagator';
import { MAX_DISPLAY_SATELLITES } from '../../utils/constants';

/**
 * SatelliteLayer
 * ──────────────
 * Renders satellites using THREE.InstancedMesh (1 draw call for all dots).
 * 
 * Performs client-side SGP4 real-time propagation from TLEs every second.
 * Fallbacks to server-pre-computed coordinates if TLE parsing fails.
 */
export function SatelliteLayer({ tleData, visible, onSelect }) {
  const meshRef = useRef();
  const positionsRef = useRef([]);  // { pos, name, norad_id, lat, lng, altKm }[]
  const colorsBaked = useRef(false);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const colorArray = useMemo(() => {
    const arr = new Float32Array(MAX_DISPLAY_SATELLITES * 3);
    arr.fill(1); // initialize all to white (1, 1, 1)
    return arr;
  }, []);

  // ── Periodic propagation of positions on client side ──────────
  useEffect(() => {
    if (!tleData?.length) {
      positionsRef.current = [];
      colorsBaked.current = false;
      return;
    }

    const limited = tleData.slice(0, MAX_DISPLAY_SATELLITES);

    const updatePositions = () => {
      const results = [];
      const now = new Date();

      for (const sat of limited) {
        try {
          let lat, lng, altKm;

          // Try to propagate live from TLE
          if (sat.tle_line1 && sat.tle_line2) {
            const pos = propagateTLE(sat.tle_line1, sat.tle_line2, now);
            if (pos) {
              lat = pos.lat;
              lng = pos.lng;
              altKm = pos.altKm;
            }
          }

          // Fallback to server pre-propagated values if TLE propagation fails
          if (lat === undefined) {
            lat = sat.lat;
            lng = sat.lng;
            altKm = sat.alt_km;
          }

          if (!isFinite(lat) || !isFinite(lng) || !isFinite(altKm) || altKm < 0) continue;

          const r = altToRadius(altKm);
          const pos = latLngToVector3(lat, lng, r);
          results.push({ pos, name: sat.name, norad_id: sat.norad_id, lat, lng, altKm });
        } catch { /* skip */ }
      }

      positionsRef.current = results;
      colorsBaked.current = false; // Trigger colors update when positions/count change
    };

    // Run immediately
    updatePositions();

    // Run every 1000ms to show real-time smooth orbit tracking
    const interval = setInterval(updatePositions, 1000);
    return () => clearInterval(interval);
  }, [tleData]);

  // ── Bake colors + push matrices every frame ──────────────────
  useFrame(() => {
    if (!meshRef.current) return;
    const positions = positionsRef.current;
    if (!positions.length) return;

    // Set colors once per data change
    if (!colorsBaked.current) {
      const col = new THREE.Color();
      for (let i = 0; i < positions.length; i++) {
        col.set(getOrbitColor(positions[i].altKm));
        meshRef.current.setColorAt(i, col);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
      colorsBaked.current = true;
    }

    // Update matrix for every satellite every frame
    for (let i = 0; i < positions.length; i++) {
      dummy.position.copy(positions[i].pos);
      dummy.scale.setScalar(1.0); // Fix microscopic scale so they are visible
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.count = positions.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, MAX_DISPLAY_SATELLITES]}
      onPointerDown={(e) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && positionsRef.current[instanceId]) {
          const sat = positionsRef.current[instanceId];
          onSelect?.({
            type: 'satellite',
            name: sat.name,
            norad_id: sat.norad_id,
            altKm: sat.altKm,
            lat: sat.lat,
            lng: sat.lng,
          });
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
      }}
    >
      <octahedronGeometry args={[0.015, 0]} />
      <meshBasicMaterial />
      <instancedBufferAttribute
        attach="instanceColor"
        args={[colorArray, 3]}
      />
    </instancedMesh>
  );
}
