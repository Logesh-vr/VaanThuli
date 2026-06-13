import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { latLngToVector3, altToRadius, getOrbitColor } from '../../utils/propagator';
import { MAX_DISPLAY_SATELLITES, PROPAGATION_INTERVAL_MS } from '../../utils/constants';

/**
 * SatelliteLayer
 * ──────────────
 * Renders up to MAX_DISPLAY_SATELLITES satellites using THREE.InstancedMesh —
 * a single draw call for all instances, regardless of count.
 *
 * Performance strategy:
 *  1. Parse all TLE strings into satrec objects ONCE on mount
 *  2. Propagate all positions every PROPAGATION_INTERVAL_MS via setInterval
 *  3. In useFrame: update InstancedMesh matrices (just reading from ref — fast)
 *  4. Colors set at propagation time (not every frame)
 */
export function SatelliteLayer({ tleData, visible, onSelect }) {
  const meshRef      = useRef();
  const satrecsRef   = useRef([]);  // { satrec, name, norad_id }[]
  const positionsRef = useRef([]);  // { pos, name, norad_id, altKm }[]

  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // ── Step 1: Parse TLEs into satrecs (once) ──────────────────
  useEffect(() => {
    if (!tleData?.length) return;

    const limited = tleData.slice(0, MAX_DISPLAY_SATELLITES);
    const satrecs = [];

    for (const sat of limited) {
      try {
        const satrec = satellite.twoline2satrec(
          sat.tle_line1.trim(),
          sat.tle_line2.trim()
        );
        satrecs.push({ satrec, name: sat.name, norad_id: sat.norad_id });
      } catch {
        /* skip malformed TLEs */
      }
    }

    satrecsRef.current = satrecs;

    // Initial propagation immediately
    propagate();

    // Schedule periodic re-propagation
    const timer = setInterval(propagate, PROPAGATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [tleData]);

  // ── Step 2: Propagate positions ─────────────────────────────
  const propagate = () => {
    const now  = new Date();
    const gmst = satellite.gstime(now);
    const results = [];

    for (const { satrec, name, norad_id } of satrecsRef.current) {
      try {
        const posVel = satellite.propagate(satrec, now);
        if (!posVel?.position || typeof posVel.position === 'boolean') continue;

        const geo = satellite.eciToGeodetic(posVel.position, gmst);
        const lat  = satellite.radiansToDegrees(geo.latitude);
        const lng  = satellite.radiansToDegrees(geo.longitude);
        const altKm = geo.height;

        if (!isFinite(lat) || !isFinite(lng) || !isFinite(altKm) || altKm < 0) continue;

        const pos = latLngToVector3(lat, lng, altToRadius(altKm));
        results.push({ pos, name, norad_id, lat, lng, altKm });
      } catch { /* skip */ }
    }

    positionsRef.current = results;

    // Update colors on the InstancedMesh (only at propagation time)
    if (meshRef.current && results.length > 0) {
      for (let i = 0; i < results.length; i++) {
        const color = getOrbitColor(results[i].altKm);
        meshRef.current.setColorAt(i, color);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  };

  // ── Step 3: Update matrices every frame (fast — no math) ────
  useFrame(() => {
    if (!meshRef.current) return;
    const positions = positionsRef.current;
    if (!positions.length) return;

    for (let i = 0; i < positions.length; i++) {
      dummy.position.copy(positions[i].pos);
      dummy.scale.setScalar(0.0035);
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
      frustumCulled={false}
      onPointerDown={(e) => {
        e.stopPropagation();
        const sat = positionsRef.current[e.instanceId];
        if (sat && onSelect) {
          onSelect({
            type:        'satellite',
            name:        sat.name,
            norad_id:    sat.norad_id,
            lat:         sat.lat,
            lng:         sat.lng,
            altKm:       sat.altKm,
          });
        }
      }}
    >
      <sphereGeometry args={[0.003, 4, 4]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
