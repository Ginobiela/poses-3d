import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BodyMorphController } from './BodyMorphController.ts';
import { applyBodyPreset, BODY_PRESETS, BODY_PRESET_MORPHS } from './bodyPresets.ts';
import { SkeletonAdapter } from '../character/SkeletonAdapter.ts';
import { PoseManager } from '../character/PoseManager.ts';

describe('Presets corporales sobre el GLB real', () => {
  let scene, meshes, controller, skeleton, manager;
  beforeAll(async () => {
    const bytes = await readFile('public/models/human/human.glb');
    scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    meshes = []; scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object); });
    controller = new BodyMorphController(meshes);
    skeleton = new SkeletonAdapter(scene, meshes);
    manager = new PoseManager({ model: scene, skeleton, animations: [], placeOnFloor: () => scene.updateMatrixWorld(true) });
    for (const file of ['standing/standing_01.json', 'standing/arms_up.json', 'action/fight_01.json']) {
      manager.addStaticPose(JSON.parse(await readFile(`public/poses/${file}`, 'utf8')));
    }
  });
  afterEach(() => { controller.resetAll(); skeleton.reset(); });
  afterAll(() => {
    manager.dispose();
    meshes.forEach(mesh => { mesh.geometry.dispose(); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose()); });
  });

  it('usa exclusivamente targets efectivos del GLB y valores finitos moderados', () => {
    expect(Object.values(BODY_PRESETS).map(preset => preset.name)).toEqual(['Neutral', 'Delgado', 'Atlético', 'Musculoso']);
    expect(Object.isFrozen(BODY_PRESETS.muscular.morphs)).toBe(true);
    for (const id of Object.keys(BODY_PRESETS)) {
      applyBodyPreset(controller, id);
      for (const name of BODY_PRESET_MORPHS) {
        const value = controller.getMorph(name);
        expect(Number.isFinite(value) && value >= 0 && value <= .65).toBe(true);
        const body = meshes.find(mesh => mesh.name === 'Body');
        expect(Array.from(body.geometry.morphAttributes.position[body.morphTargetDictionary[name]].array).some(value => value !== 0)).toBe(true);
      }
    }
  });

  it('cambiar de preset limpia pesos anteriores y Neutral restaura el cuerpo base', () => {
    controller.setMorph('headAged', .1);
    for (const id of ['muscular', 'lean', 'athletic', 'neutral']) {
      applyBodyPreset(controller, id);
      for (const name of BODY_PRESET_MORPHS) expect(controller.getMorph(name)).toBe(BODY_PRESETS[id].morphs[name] ?? 0);
      expect(controller.getMorph('headAged')).toBe(.1);
    }
  });

  it('produce cuatro superficies distintas y Neutral recupera exactamente la original', () => {
    const body = meshes.find(mesh => mesh.name === 'Body');
    scene.updateMatrixWorld(true); body.skeleton.update();
    const vertices = BODY_PRESET_MORPHS.map(name => {
      const target = body.geometry.morphAttributes.position[body.morphTargetDictionary[name]];
      return Math.floor(Array.from(target.array).findIndex(value => value !== 0) / 3);
    });
    const surface = () => vertices.map(index => body.getVertexPosition(index, new THREE.Vector3()).toArray());
    const base = surface();
    const signatures = [];
    for (const id of Object.keys(BODY_PRESETS)) {
      applyBodyPreset(controller, id); signatures.push(JSON.stringify(surface()));
    }
    expect(new Set(signatures).size).toBe(4);
    applyBodyPreset(controller, 'neutral'); expect(surface()).toEqual(base);
  });

  it('no modifica skeleton, pose, geometría, materiales ni identidad de meshes', () => {
    const bone = skeleton.bones.get('mixamorig:LeftForeArm');
    bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), .2));
    const capture = () => [...skeleton.bones].map(([name, bone]) => [name, bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]);
    const pose = capture();
    const geometry = meshes.map(mesh => mesh.geometry);
    const materials = meshes.map(mesh => mesh.material);
    const positions = meshes.map(mesh => Array.from(mesh.geometry.attributes.position.array));
    for (const id of Object.keys(BODY_PRESETS)) {
      applyBodyPreset(controller, id);
      expect(capture()).toEqual(pose);
      meshes.forEach((mesh, index) => {
        expect(mesh.geometry).toBe(geometry[index]); expect(mesh.material).toBe(materials[index]);
        expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(positions[index]);
      });
    }
  });

  it('cambiar poses JSON y congelar AnimationClip conserva el preset', async () => {
    applyBodyPreset(controller, 'muscular');
    for (const file of ['standing/standing_01.json', 'standing/arms_up.json', 'action/fight_01.json']) {
      const pose = JSON.parse(await readFile(`public/poses/${file}`, 'utf8'));
      manager.setStaticPose(pose.name);
      for (const name of BODY_PRESET_MORPHS) expect(controller.getMorph(name)).toBe(BODY_PRESETS.muscular.morphs[name] ?? 0);
    }
    const bone = skeleton.bones.get('mixamorig:LeftForeArm');
    const q = bone.quaternion.toArray();
    manager.addAnimationClip(new THREE.AnimationClip('test-arm', 1, [new THREE.QuaternionKeyframeTrack('mixamorig:LeftForeArm.quaternion', [0, 1], [...q, ...q])]));
    manager.setPoseFromAnimation('test-arm', .43);
    for (const name of BODY_PRESET_MORPHS) expect(controller.getMorph(name)).toBe(BODY_PRESETS.muscular.morphs[name] ?? 0);
  });

  it('rechaza nombres o límites incompatibles antes de modificar ninguna influencia', () => {
    applyBodyPreset(controller, 'lean');
    const before = meshes.map(mesh => [...mesh.morphTargetInfluences]);
    expect(() => applyBodyPreset(controller, 'unknown')).toThrow('desconocido');
    expect(() => applyBodyPreset(new BodyMorphController([]), 'muscular')).toThrow('ausente');
    const limited = new BodyMorphController(meshes, { bodyMuscular: { min: 0, max: .2 } });
    expect(() => applyBodyPreset(limited, 'muscular')).toThrow('fuera de rango');
    expect(meshes.map(mesh => mesh.morphTargetInfluences)).toEqual(before);
  });
});
