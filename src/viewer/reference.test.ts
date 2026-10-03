import { expect, it } from 'vitest';
import * as THREE from 'three';
import { cameraPosition, CAMERA_PRESETS, focalFov, MATERIAL_MODES, ReferenceMaterials } from './reference';
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
  for (const mode of ['Gris', 'Silueta', 'Anatomía', 'Wireframe'] as const) { modes.set(mode); expect(mesh.material).not.toBe(original); }
  expect(mesh.material.wireframe).toBe(true);
  modes.set('Normal'); expect(mesh.material).toBe(original); expect(original.color.getHexString()).toBe('ff0000'); modes.dispose();
});
it('Anatomía usa un material neutro reutilizable sin alterar morphs, skeleton ni materiales originales', () => {
  expect(MATERIAL_MODES).toEqual(['Normal', 'Gris', 'Silueta', 'Anatomía', 'Wireframe']);
  const geometry = new THREE.BoxGeometry();
  const original = new THREE.MeshStandardMaterial({ color: '#d89966', roughness: .9 });
  const originalArray = [original];
  const meshes = [new THREE.SkinnedMesh(geometry, original), new THREE.SkinnedMesh(geometry, originalArray)];
  const influences = [.35]; meshes[0]!.morphTargetInfluences = influences;
  const skeleton = meshes[0]!.skeleton;
  const modes = new ReferenceMaterials(meshes);
  modes.set('Anatomía');
  const anatomy = meshes[0]!.material as THREE.MeshStandardMaterial;
  expect(anatomy.isMeshStandardMaterial).toBe(true); expect(anatomy.color.getHexString()).toBe('90969c');
  expect(anatomy.roughness).toBe(.48); expect(anatomy.metalness).toBe(0);
  expect(anatomy.map).toBeNull(); expect(anatomy.normalMap).toBeNull(); expect(anatomy.displacementMap).toBeNull();
  expect(anatomy.wireframe).toBe(false);
  expect(meshes[1]!.material).toBe(anatomy);
  modes.set('Gris'); modes.set('Anatomía'); expect(meshes[0]!.material).toBe(anatomy);
  expect(meshes[0]!.geometry).toBe(geometry); expect(meshes[0]!.skeleton).toBe(skeleton);
  expect(meshes[0]!.morphTargetInfluences).toBe(influences); expect(influences).toEqual([.35]);
  modes.set('Normal'); expect(meshes[0]!.material).toBe(original); expect(meshes[1]!.material).toBe(originalArray);
  expect(original.roughness).toBe(.9); expect(original.color.getHexString()).toBe('d89966');
  let disposed = 0; anatomy.addEventListener('dispose', () => disposed++);
  modes.dispose(); expect(disposed).toBe(1); expect(meshes[0]!.material).toBe(original);
  geometry.dispose(); original.dispose();
});
