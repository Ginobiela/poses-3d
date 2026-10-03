import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { smoothShoulderWeights } from './blender/shoulder_weights.mjs';

it('corrige pesos del hombro sin cambiar malla, rig ni correctivos y sin duplicar atributos', async () => {
  const source = await readFile('dev/models/human-anatomy-correctives.glb');
  const savedSource = Buffer.from(source);
  const { bytes, report } = await smoothShoulderWeights(source, 10, true);
  expect(source.equals(savedSource)).toBe(true);
  expect(bytes.equals(await readFile('dev/models/human-arms-up-weights.glb'))).toBe(true);
  expect(bytes.length - source.length).toBeLessThan(1000);
  expect(report.reassignedNeckVertices).toBe(38); expect(report.vertices).toBe(388);
  const parse = async b => (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')).scene;
  const original = (await parse(source)).getObjectByName('Body'), candidate = (await parse(bytes)).getObjectByName('Body');
  expect(candidate.skeleton.boneInverses).toEqual(original.skeleton.boneInverses);
  expect(candidate.morphTargetDictionary).toEqual(original.morphTargetDictionary);
  for (const kind of ['position', 'normal']) {
    expect(candidate.geometry.morphAttributes[kind]).toHaveLength(original.geometry.morphAttributes[kind].length);
    for (let i = 0; i < original.geometry.morphAttributes[kind].length; i++) {
      const a = original.geometry.morphAttributes[kind][i].array, b = candidate.geometry.morphAttributes[kind][i].array;
      expect(Buffer.from(b.buffer, b.byteOffset, b.byteLength).equals(Buffer.from(a.buffer, a.byteOffset, a.byteLength))).toBe(true);
    }
  }
  for (const name of ['position', 'normal', 'uv']) {
    const a = original.geometry.attributes[name], b = candidate.geometry.attributes[name];
    let equal = true;
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) equal &&= a.getComponent(i, c) === b.getComponent(i, c);
    expect(equal).toBe(true);
  }
  expect(candidate.geometry.index.array).toEqual(original.geometry.index.array);
  let changed = 0;
  for (let i = 0; i < candidate.geometry.attributes.position.count; i++) {
    let sum = 0;
    const before = new Map(), after = new Map();
    for (let c = 0; c < 4; c++) {
      const weight = candidate.geometry.attributes.skinWeight.getComponent(i, c);
      expect(Number.isFinite(weight) && weight >= 0 && weight <= 1).toBe(true); sum += weight;
      const previous = original.geometry.attributes.skinWeight.getComponent(i, c);
      if (previous > 1e-8) before.set(original.geometry.attributes.skinIndex.getComponent(i, c), previous);
      if (weight > 1e-8) after.set(candidate.geometry.attributes.skinIndex.getComponent(i, c), weight);
    }
    expect(sum).toBeCloseTo(1, 6);
    const joints = new Set([...before.keys(), ...after.keys()]);
    const delta = [...joints].reduce((total, joint) => total + Math.abs((before.get(joint) ?? 0) - (after.get(joint) ?? 0)), 0);
    if (delta > 1e-6) {
      changed++;
      expect([...joints].every(j => /^mixamorig:(Neck|Spine2|LeftArm|RightArm|LeftShoulder|RightShoulder)$/.test(original.skeleton.bones[j].userData.name))).toBe(true);
    }
  }
  expect(changed).toBe(388);
}, 30000);
