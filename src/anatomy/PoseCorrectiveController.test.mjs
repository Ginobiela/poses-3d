import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BodyMorphController } from './BodyMorphController.ts';
import { PoseCorrectiveController } from './PoseCorrectiveController.ts';
import { POSE_CORRECTIVES } from './correctives.ts';
import { SkeletonAdapter } from '../character/SkeletonAdapter.ts';

// Fixture targets exist only in this test, never in the shipped model/configuration.
function fixture() {
  const root = new THREE.Group();
  const a = new THREE.Bone(), b = new THREE.Bone(), c = new THREE.Bone();
  root.add(a); a.add(b); b.add(c); b.position.y = 1; c.position.y = 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, .1, 0], 3), new THREE.Float32BufferAttribute([.1, 0, 0], 3)];
  geometry.morphTargetsRelative = true;
  const mesh = new THREE.SkinnedMesh(geometry);
  mesh.morphTargetDictionary = { fixtureCorrective: 0, bodyShape: 1 }; mesh.morphTargetInfluences = [0, 0];
  root.add(mesh);
  const bones = new Map([['a', a], ['b', b], ['c', c]]);
  const morphs = new BodyMorphController([mesh]);
  const rule = { id: 'elbow', joint: 'leftElbow', morph: 'fixtureCorrective', startAngle: 20, fullAngle: 120,
    measurement: { type: 'bend', boneA: 'a', boneB: 'b', boneC: 'c' } };
  return { root, a, b, c, mesh, bones, morphs, rule };
}
const rotate = (bone, angle) => bone.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle * Math.PI / 180);

describe('PoseCorrectiveController', () => {
  it('activa por umbrales, limita el peso y preserva pose, geometría y morph corporal', () => {
    const f = fixture(); const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, [f.rule]);
    f.morphs.setMorph('bodyShape', .35);
    const geometry = f.mesh.geometry; const data = geometry.attributes.position.array.slice();
    for (const [angle, weight] of [[0, 0], [20, 0], [70, .5], [120, 1], [170, 1]]) {
      rotate(f.b, angle); const quaternion = f.b.quaternion.toArray(); controller.update();
      expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(weight);
      expect(controller.getStates()[0].angle).toBeCloseTo(angle);
      expect(f.b.quaternion.toArray()).toEqual(quaternion);
    }
    expect(f.morphs.getMorph('bodyShape')).toBe(.35);
    expect(f.mesh.geometry).toBe(geometry); expect(geometry.attributes.position.array).toEqual(data);
    controller.reset(); expect(f.morphs.getMorph('fixtureCorrective')).toBe(0);
    expect(f.morphs.getMorph('bodyShape')).toBe(.35);
  });

  it('mide flexión independiente de orientación global, padres y escala uniforme', () => {
    const f = fixture(); const parent = new THREE.Group(); parent.add(f.root);
    const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, [f.rule]);
    rotate(f.b, 70); controller.update(); const initial = f.morphs.getMorph('fixtureCorrective');
    parent.rotation.set(.8, -.4, 1.2); parent.position.set(3, 4, 5); parent.scale.setScalar(2);
    controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(initial);
  });

  it('omite morphs/huesos ausentes sin escribir ni lanzar error; diagnóstico es una copia', () => {
    const f = fixture(); f.morphs.setMorph('fixtureCorrective', .3);
    const configs = [{ ...f.rule, id: 'missing-morph', morph: 'missing' },
      { ...f.rule, id: 'missing-bone', measurement: { ...f.rule.measurement, boneC: 'missing' } }];
    const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, configs);
    expect(() => { controller.update(); controller.reset(); }).not.toThrow();
    expect(controller.getStates().map(s => s.active)).toEqual([false, false]);
    expect(controller.getStates().map(s => s.reason)).toEqual(['Morph ausente', 'Hueso ausente o ajeno al personaje']);
    expect(f.morphs.getMorph('fixtureCorrective')).toBe(.3);
    controller.getStates()[0].active = true; expect(controller.getStates()[0].active).toBe(false);
  });

  it('no depende de nombres sanitizados de Object3D y copia la configuración', () => {
    const f = fixture(); f.b.name = 'sanitized_name';
    const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, [f.rule]);
    f.rule.fullAngle = 180; f.rule.measurement.boneB = 'missing';
    rotate(f.b, 120); controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(1);
  });

  it('rechaza umbrales inválidos, targets duplicados y calibraciones ambiguas', () => {
    const f = fixture();
    for (const patch of [{ startAngle: NaN }, { fullAngle: Infinity }, { startAngle: -1 }, { fullAngle: 181 }, { fullAngle: 20 }]) {
      expect(() => new PoseCorrectiveController(f.root, f.bones, f.morphs, [{ ...f.rule, ...patch }])).toThrow('Correctivo inválido');
    }
    expect(() => new PoseCorrectiveController(f.root, f.bones, f.morphs, [f.rule, { ...f.rule, id: 'other' }])).toThrow('únicos');
    expect(() => new PoseCorrectiveController(f.root, f.bones, f.morphs, [{ ...f.rule,
      measurement: { type: 'bend', boneA: 'c', boneB: 'b', boneC: 'a' } }])).toThrow('fuera de orden');
    expect(() => new PoseCorrectiveController(f.root, f.bones, f.morphs, [{ ...f.rule,
      measurement: { type: 'local-axis', bone: 'b', axis: [0, 0, 0], restQuaternion: [0, 0, 0, 1], direction: 1 } }])).toThrow('Calibración');
  });

  it('usa rotación parent-relative respecto del reposo explícito y discrimina el sentido', () => {
    const f = fixture(); const rest = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .7);
    const rule = { ...f.rule, measurement: { type: 'local-axis', bone: 'b', axis: [0, 0, 1], restQuaternion: rest.toArray(), direction: 1 } };
    const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, [rule]);
    for (const sign of [1, -1]) {
      f.b.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sign * 70 * Math.PI / 180));
      controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(sign === 1 ? .5 : 0);
    }
    f.b.quaternion.copy(rest); rotate(f.a, 100); controller.update();
    expect(f.morphs.getMorph('fixtureCorrective')).toBe(0);
    f.b.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 70 * Math.PI / 180));
    f.b.quaternion.set(-f.b.quaternion.x, -f.b.quaternion.y, -f.b.quaternion.z, -f.b.quaternion.w);
    controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(.5);
  });

  it('segmentos degenerados y NaN desactivan el correctivo sin propagar NaN y se recuperan', () => {
    const f = fixture(); const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, [f.rule]);
    rotate(f.b, 120); controller.update(); f.c.position.set(0, 0, 0); controller.update();
    expect(f.morphs.getMorph('fixtureCorrective')).toBe(0); expect(controller.getStates()[0].angle).toBeNull();
    f.c.position.y = 1; f.b.quaternion.x = NaN; controller.update();
    expect(f.morphs.getMorph('fixtureCorrective')).toBe(0);
    rotate(f.b, 70); controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(.5);
    expect(controller.getStates()[0].reason).toBeNull();
  });

  it('respeta topes menores del morph', () => {
    const f = fixture(); const morphs = new BodyMorphController([f.mesh], { fixtureCorrective: { min: 0, max: .4 } });
    const controller = new PoseCorrectiveController(f.root, f.bones, morphs, [f.rule]);
    rotate(f.b, 120); controller.update(); expect(morphs.getMorph('fixtureCorrective')).toBeCloseTo(.4);
  });

  it('el sensor local protege NaN/giro indeterminado, separa swing y soporta el sentido negativo', () => {
    const f = fixture();
    const rule = { ...f.rule, measurement: { type: 'local-axis', bone: 'b', axis: [0, 0, 1], restQuaternion: [0, 0, 0, 1], direction: -1 } };
    const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, [rule]);
    rotate(f.b, -70); controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(.5);
    f.b.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBe(0);
    f.b.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    controller.update(); expect(controller.getStates()[0].angle).toBeNull();
    f.b.quaternion.set(0, 0, 0, 0); controller.update(); expect(controller.getStates()[0].angle).toBeNull();
    f.b.quaternion.x = NaN; controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBe(0);
    rotate(f.b, -120); controller.update(); expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(1);
  });

  it('actualiza desde AnimationMixer sin intervenir en la animación', () => {
    const f = fixture(); f.b.name = 'joint';
    const controller = new PoseCorrectiveController(f.root, f.bones, f.morphs, [f.rule]);
    const end = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 120 * Math.PI / 180);
    const clip = new THREE.AnimationClip('flex', 1, [new THREE.QuaternionKeyframeTrack('joint.quaternion', [0, 1], [0, 0, 0, 1, ...end.toArray()])]);
    const mixer = new THREE.AnimationMixer(f.root); mixer.clipAction(clip).play(); mixer.setTime(.5);
    const before = f.b.quaternion.toArray(); controller.update();
    expect(controller.getStates()[0].angle).toBeCloseTo(60);
    expect(f.morphs.getMorph('fixtureCorrective')).toBeCloseTo(.4);
    expect(f.b.quaternion.toArray()).toEqual(before); expect(mixer.time).toBe(.5);
    mixer.stopAllAction(); mixer.uncacheRoot(f.root);
  });
});

it('el GLB real conserva todos los morphs corporales y las veinte poses con configuración vacía', async () => {
  const bytes = await readFile('public/models/human/human.glb');
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const meshes = []; scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  try {
    const skeleton = new SkeletonAdapter(scene, meshes); const morphs = new BodyMorphController(meshes);
    const controller = new PoseCorrectiveController(scene, skeleton.bones, morphs);
    expect(POSE_CORRECTIVES).toEqual([]); expect(controller.getStates()).toEqual([]);
    morphs.setMorph('bodyMuscular', .35);
    const influences = meshes.map(m => [...m.morphTargetInfluences]);
    const manifest = JSON.parse(await readFile('public/poses/manifest.json', 'utf8'));
    for (const entry of manifest.poses) {
      skeleton.apply(JSON.parse(await readFile(`public/poses/${entry.file}`, 'utf8')));
      const rotations = [...skeleton.bones.values()].map(b => b.quaternion.toArray());
      controller.update(); controller.reset();
      expect(meshes.map(m => m.morphTargetInfluences)).toEqual(influences);
      expect([...skeleton.bones.values()].map(b => b.quaternion.toArray())).toEqual(rotations);
    }
  } finally {
    for (const mesh of meshes) { mesh.geometry.dispose(); for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose(); }
  }
});
