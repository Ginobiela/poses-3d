import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3 } from 'three';
import { smoothShoulderWeights } from './shoulder_weights.mjs';
import { exportCorrectives } from './export_correctives.mjs';
import { SkeletonAdapter } from '../../src/character/SkeletonAdapter.ts';
import { BodyMorphController } from '../../src/anatomy/BodyMorphController.ts';
import { PoseCorrectiveController } from '../../src/anatomy/PoseCorrectiveController.ts';

const parse = async bytes => (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
it('reproduce pesos y seis experimentos sin perder los cuatro correctivos anteriores', async () => {
  const originalBytes = await readFile('dev/models/human-anatomy-correctives.glb');
  const { bytes, report } = await smoothShoulderWeights(originalBytes);
  expect(report.vertices).toBe(350);
  const data = JSON.parse(await readFile('dev/models/shoulder-correctives.json', 'utf8'));
  const output = await exportCorrectives(bytes, data);
  expect(output.equals(await readFile('dev/models/human-shoulders.glb'))).toBe(true);
  const original = await parse(originalBytes), candidate = await parse(output);
  const a = original.getObjectByName('Body'), b = candidate.getObjectByName('Body');
  expect(b.geometry.attributes.position.array).toEqual(a.geometry.attributes.position.array);
  expect(b.geometry.index.array).toEqual(a.geometry.index.array);
  expect(b.skeleton.boneInverses).toEqual(a.skeleton.boneInverses);
  for (const name of ['elbowFlex_L', 'elbowFlex_R', 'kneeFlex_L', 'kneeFlex_R']) {
    const i = a.morphTargetDictionary[name], j = b.morphTargetDictionary[name];
    expect(b.geometry.morphAttributes.position[j].array).toEqual(a.geometry.morphAttributes.position[i].array);
    expect(b.geometry.morphAttributes.normal[j].array).toEqual(a.geometry.morphAttributes.normal[i].array);
  }
  let changed = 0;
  for (let v = 0; v < b.geometry.attributes.position.count; v++) {
    const before = new Map(), after = new Map();
    for (let c = 0; c < 4; c++) {
      const x = a.geometry.attributes.skinWeight.getComponent(v, c), y = b.geometry.attributes.skinWeight.getComponent(v, c);
      if (x > 1e-8) before.set(a.geometry.attributes.skinIndex.getComponent(v, c), x);
      if (y > 1e-8) after.set(b.geometry.attributes.skinIndex.getComponent(v, c), y);
      expect(Number.isFinite(y) && y >= 0 && y <= 1).toBe(true);
    }
    expect([...after.values()].reduce((s, w) => s + w, 0)).toBeCloseTo(1, 6);
    const delta = [...new Set([...before.keys(), ...after.keys()])].reduce((s, n) => s + Math.abs((before.get(n) ?? 0) - (after.get(n) ?? 0)), 0);
    if (delta > 1e-6) {
      changed++;
      for (const n of new Set([...before.keys(), ...after.keys()])) expect(/mixamorig:(Spine2|LeftArm|RightArm|LeftShoulder|RightShoulder)/.test(a.skeleton.bones[n].userData.name)).toBe(true);
    }
  }
  expect(changed).toBe(350);
  const meshes = []; candidate.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  const skeleton = new SkeletonAdapter(candidate, meshes), morphs = new BodyMorphController(meshes);
  const controller = new PoseCorrectiveController(candidate, skeleton.bones, morphs, data.correctives.map(c => c.config));
  const point = new Vector3();
  for (const item of data.correctives) {
    skeleton.apply(JSON.parse(await readFile(`public/poses/${item.poseFile}`, 'utf8'))); controller.update();
    expect(morphs.getMorph(item.name)).toBeCloseTo(1);
    b.skeleton.update();
    let maxError = 0;
    for (const [index, x, y, z] of item.referencePositions) {
      b.getVertexPosition(index, point).applyMatrix4(b.matrixWorld);
      maxError = Math.max(maxError, point.distanceTo(new Vector3(x, y, z)));
    }
    expect(maxError).toBeLessThan(2e-6);
    controller.reset();
  }
}, 30000);
