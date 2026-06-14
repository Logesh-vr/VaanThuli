import { useRef, useEffect, useMemo, useCallback } from 'react';
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
 *  1. Parse all TLE strings into satrec objects ONCE when tleData changes
 *  2. Propagate all positions every PROPAGATION_INTERVAL_MS
 *  3. In useFrame: update InstancedMesh matrices every frame (fast — just reads ref)
 *  4. Colors set at propagation time (not every frame)
 *
 * Fix: propagate is defined with useCallback BEFORE useEffect, ensuring it is
 * available in the closure when the effect runs.
 */
export function SatelliteLayer({ tleData, visible, onSelect }) {
  const meshRef      = useRef();
  const satrecsRef   = useRef([]);  // { satrec, name, norad_id }[]
  const positionsRef = useRef([]);  // { pos, name, norad_id, lat, lng, altKm }[]

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // ── Step 2: Propagate positions ──────────────────────────────
  // Defined FIRST (as useCallback) so the useEffect below can safely close over it.
  const propagate = useCallback(() => {
    const now  = new Date();
    const gmst = satellite.gstime(now);
    const results = [];

    for (const { satrec, name, norad_id } of satrecsRef.current) {
      try {
        const posVel = satellite.propagate(satrec, now);
        if (!posVel?.position || typeof posVel.position === 'boolean') continue;

        const geo  = satellite.eciToGeodetic(posVel.position, gmst);
        const lat  = satellite.radiansToDegrees(geo.latitude);
        const lng  = satellite.radiansToDegrees(geo.longitude);
        const altKm = geo.height;

        if (!isFinite(lat) || !isFinite(lng) || !isFinite(altKm) || altKm < 0) continue;

        const pos = latLngToVector3(lat, lng, altToRadius(altKm));
        results.push({ pos, name, norad_id, lat, lng, altKm });
      } catch { /* skip bad propagations */ }
    }

    positionsRef.current = results;

    // Update colors on InstancedMesh at propagation time (not every frame)
    if (meshRef.current && results.length > 0) {
      const colorAttr = new THREE.Color();
      for (let i = 0; i < results.length; i++) {
        colorAttr.set(getOrbitColor(results[i].altKm));
        meshRef.current.setColorAt(i, colorAttr);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, []); // stable ref — reads satrecsRef which is always current

  // ── Step 1: Parse TLEs into satrecs (once per data change) ──
  useEffect(() => {
    if (!tleData?.length) return;

    console.log(`[SatelliteLayer] Parsing ${tleData.length} TLEs…`);
    const limited = tleData.slice(0, MAX_DISPLAY_SATELLITES);
    const satrecs = [];

    for (const sat of limited) {
      try {
        const satrec = satellite.twoline2satrec(
          sat.tle_line1.trim(),
          sat.tle_line2.trim()
        );
        // satellite.js sets error code when TLE is invalid
        if (satrec.error !== 0) continue;
        satrecs.push({ satrec, name: sat.name, norad_id: sat.norad_id });
      } catch { /* skip malformed TLEs */ }
    }

    console.log(`[SatelliteLayer] ${satrecs.length} valid satrecs parsed`);
    satrecsRef.current = satrecs;

    // Run first propagation immediately
    propagate();

    // Refresh positions every PROPAGATION_INTERVAL_MS
    const timer = setInterval(propagate, PROPAGATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [tleData, propagate]);

  // ── Step 3: Push positions into GPU every frame ──────────────
  useFrame(() => {
    if (!meshRef.current) return;
    const positions = positionsRef.current;
    if (!positions.length) return;

    for (let i = 0; i < positions.length; i++) {
      dummy.position.copy(positions[i].pos);
      dummy.scale.setScalar(0.004);
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
            type:     'satellite',
            name:     sat.name,
            norad_id: sat.norad_id,
            lat:      sat.lat,
            lng:      sat.lng,
            altKm:    sat.altKm,
          });
        }
      }}
    >
      <sphereGeometry args={[0.003, 4, 4]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  );
}
