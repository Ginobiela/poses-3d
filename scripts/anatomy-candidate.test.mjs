import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildCandidate, RECIPE, sha, SOURCE_SHA } from './anatomy-candidate.mjs';

const parse = async bytes => {
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = []; gltf.scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object); });
  return { json, meshes };
};
it('reconstruye el candidato offline conservando rig, topología, auxiliares y morphs', async () => {
  const bytes = await readFile('public/models/human/human.glb');
  expect(sha(bytes)).toBe(SOURCE_SHA);
  expect((await readFile('dev/models/human-current.glb')).equals(bytes)).toBe(true);
  const candidateBytes = await buildCandidate(bytes);
  expect(candidateBytes.equals(await readFile('dev/models/human-anatomy-v2.glb'))).toBe(true);
  expect(candidateBytes.length).toBeLessThan(bytes.length * 1.1);
  const current = await parse(bytes), candidate = await parse(candidateBytes);
  expect(candidate.json.nodes).toEqual(current.json.nodes);
  expect(candidate.json.skins).toEqual(current.json.skins);
  expect(candidate.json.materials).toEqual(current.json.materials);
  expect(candidate.meshes).toHaveLength(4);
  let changed = 0, maxDelta = 0;
  for (const original of current.meshes) {
    const improved = candidate.meshes.find(mesh => mesh.name === original.name);
    expect(improved.skeleton.boneInverses).toEqual(original.skeleton.boneInverses);
    expect(improved.morphTargetDictionary).toEqual(original.morphTargetDictionary);
    expect(improved.morphTargetInfluences.every(value => value === 0)).toBe(true);
    expect(improved.geometry.index.array).toEqual(original.geometry.index.array);
    for (const name of ['skinIndex', 'skinWeight', 'uv']) {
      const a = original.geometry.getAttribute(name), b = improved.geometry.getAttribute(name);
      let equal = true;
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) equal &&= b.getComponent(i, c) === a.getComponent(i, c);
      expect(equal).toBe(true);
    }
    const a = original.geometry.getAttribute('position'), b = improved.geometry.getAttribute('position');
    expect(b.count).toBe(a.count);
    for (let i = 0; i < a.count; i++) {
      let distance = 0;
      for (let c = 0; c < 3; c++) {
        const delta = original.name === 'Body' ? Object.entries(RECIPE).reduce((sum, [name, weight]) =>
          sum + weight * original.geometry.morphAttributes.position[original.morphTargetDictionary[name]].getComponent(i, c), 0) : 0;
        expect(b.getComponent(i, c)).toBeCloseTo(a.getComponent(i, c) + delta, 6);
        distance += (b.getComponent(i, c) - a.getComponent(i, c)) ** 2;
      }
      if (distance > 1e-14) changed++;
      maxDelta = Math.max(maxDelta, Math.sqrt(distance));
      const n = improved.geometry.getAttribute('normal');
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
    }
    for (const [name, index] of Object.entries(original.morphTargetDictionary)) {
      const a = original.geometry.morphAttributes.position[index], b = improved.geometry.morphAttributes.position[index];
      const scale = original.name === 'Body' ? 1 - (RECIPE[name] ?? 0) : 1;
      let maxError = 0;
      for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) maxError = Math.max(maxError, Math.abs(b.getComponent(i, c) - a.getComponent(i, c) * scale));
      expect(maxError).toBeLessThan(1e-7);
    }
  }
  expect(changed).toBeGreaterThan(1000); expect(maxDelta).toBeGreaterThan(.01);
}, 30000);
it('rechaza una fuente distinta antes de transformar geometría', async () => {
  await expect(buildCandidate(Buffer.from('unknown source'))).rejects.toThrow('hash changed');
});
