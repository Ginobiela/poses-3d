import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SkeletonAdapter } from '../../src/character/SkeletonAdapter.ts';
import { exportCorrectives } from './export_correctives.mjs';

const load = async bytes => {
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = []; gltf.scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object); });
  return { root: gltf.scene, meshes, body: meshes.find(mesh => mesh.name === 'Body') };
};
it('exporta cuatro targets sparse reproducibles sin alterar base, skinning o skeleton', async () => {
  const base = await readFile('dev/models/human-anatomy-v2.glb');
  const data = JSON.parse(await readFile('dev/models/volume-correctives.json', 'utf8'));
  const bytes = await exportCorrectives(base, data);
  expect(bytes.equals(await readFile('dev/models/human-anatomy-correctives.glb'))).toBe(true);
  expect(bytes.length - base.length).toBeLessThan(60000);
  const current = await load(base), candidate = await load(bytes);
  for (let i = 0; i < current.meshes.length; i++) {
    const a = current.meshes[i], b = candidate.meshes[i];
    for (const attr of ['position', 'normal', 'skinIndex', 'skinWeight', 'uv']) {
      const x = a.geometry.getAttribute(attr), y = b.geometry.getAttribute(attr);
      let identical = true;
      for (let vertex = 0; vertex < x.count; vertex++) for (let c = 0; c < x.itemSize; c++) identical &&= x.getComponent(vertex, c) === y.getComponent(vertex, c);
      expect(identical).toBe(true);
    }
    expect(b.skeleton.boneInverses).toEqual(a.skeleton.boneInverses);
    expect(b.skeleton.bones.map(bone => bone.name)).toEqual(a.skeleton.bones.map(bone => bone.name));
  }
  expect(candidate.body.morphTargetInfluences).toHaveLength(310);
  expect(candidate.body.geometry.morphAttributes.normal).toHaveLength(310);
  expect(candidate.body.morphTargetInfluences.every(value => value === 0)).toBe(true);
  await expect(exportCorrectives(base, { ...data, baseSHA256: 'wrong' })).rejects.toThrow('basis');
});
it('reproduce en Three.js los puntos Preserve Volume de Blender a la pose calibrada', async () => {
  const bytes = await readFile('dev/models/human-anatomy-correctives.glb');
  const data = JSON.parse(await readFile('dev/models/volume-correctives.json', 'utf8'));
  const candidate = await load(bytes);
  const adapter = new SkeletonAdapter(candidate.root, candidate.meshes);
  const point = new Vector3();
  for (const spec of data.correctives) {
    expect(spec.lbsAgreementError).toBeLessThan(5e-5);
    expect(spec.minSkinDeterminant).toBeGreaterThan(0);
    const pose = JSON.parse(await readFile(`public/poses/${spec.poseFile}`, 'utf8'));
    candidate.body.morphTargetInfluences.fill(0);
    adapter.apply(pose); candidate.root.updateMatrixWorld(true); candidate.body.skeleton.update();
    candidate.body.morphTargetInfluences[candidate.body.morphTargetDictionary[spec.name]] = 1;
    let maxError = 0;
    for (const [index, x, y, z] of spec.referencePositions) {
      candidate.body.getVertexPosition(index, point).applyMatrix4(candidate.body.matrixWorld);
      maxError = Math.max(maxError, point.distanceTo(new Vector3(x, y, z)));
    }
    expect(maxError).toBeLessThan(2e-6);
    // Exact support: no target displaces vertices outside the calibrated two-bone blend.
    const target = candidate.body.geometry.morphAttributes.position[candidate.body.morphTargetDictionary[spec.name]];
    const indices = new Set(spec.deltas.map(row => row[0]));
    const normalSupport = new Set(indices);
    const faces = candidate.body.geometry.index.array;
    for (let face = 0; face < faces.length; face += 3) {
      const vertices = [faces[face], faces[face + 1], faces[face + 2]];
      if (vertices.some(index => indices.has(index))) vertices.forEach(index => normalSupport.add(index));
    }
    const position = candidate.body.geometry.getAttribute('position');
    const positionKey = index => [position.getX(index), position.getY(index), position.getZ(index)].map(value => Math.round(value * 1e5)).join(',');
    const seamPositions = new Set([...normalSupport].map(positionKey));
    for (let index = 0; index < position.count; index++) if (seamPositions.has(positionKey(index))) normalSupport.add(index);
    const normal = candidate.body.geometry.morphAttributes.normal[candidate.body.morphTargetDictionary[spec.name]];
    let outside = 0;
    for (let index = 0; index < target.count; index++) if (!indices.has(index)) outside += Math.abs(target.getX(index)) + Math.abs(target.getY(index)) + Math.abs(target.getZ(index));
    expect(outside).toBe(0);
    let outsideNormals = 0, finiteNormals = true;
    for (let index = 0; index < normal.count; index++) {
      const values = [normal.getX(index), normal.getY(index), normal.getZ(index)];
      finiteNormals &&= values.every(Number.isFinite);
      if (!normalSupport.has(index)) outsideNormals += values.reduce((sum, value) => sum + Math.abs(value), 0);
    }
    expect(finiteNormals).toBe(true); expect(outsideNormals).toBeLessThan(1e-5);
  }
});
