import { expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraPosition, CAMERA_PRESETS, focalFov, ReferenceMaterials } from './reference';
it('ofrece ocho vistas diferentes y focales de perspectiva', () => {
  expect(new Set(CAMERA_PRESETS.map(name => cameraPosition(name).toArray().join(','))).size).toBe(8);
  expect(cameraPosition('Frente').z).toBeGreaterThan(0);
  expect(cameraPosition('Espalda').z).toBeLessThan(0);
  expect(focalFov(24)).toBeGreaterThan(focalFov(85));
});
it('restaura los materiales originales sin modificarlos', () => {
  const original = new THREE.MeshStandardMaterial({ color: 'red' });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const modes = new ReferenceMaterials([mesh]);
  for (const mode of ['Gris', 'Silueta', 'Wireframe'] as const) { modes.set(mode); expect(mesh.material).not.toBe(original); }
  expect(mesh.material.wireframe).toBe(true);
  modes.set('Normal'); expect(mesh.material).toBe(original); expect(original.color.getHexString()).toBe('ff0000'); modes.dispose();
});
