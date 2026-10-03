import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BodyMorphController } from './BodyMorphController.ts';
import { BODY_CONTROLS, getBodyControlStates, setBodyControl, clearManualBodyControls } from './bodyControls.ts';
import { applyBodyPreset, BODY_PRESETS, BODY_PRESET_MORPHS } from './bodyPresets.ts';

describe('Controles corporales del GLB real', () => {
  let meshes, scene, controller;
  beforeAll(async () => {
    const bytes = await readFile('public/models/human/human.glb');
    scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    meshes = []; scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object); });
    controller = new BodyMorphController(meshes);
  });
  afterEach(() => controller.resetAll());
  afterAll(() => meshes.forEach(mesh => { mesh.geometry.dispose(); (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose()); }));

  it('expone diez controles con nombres efectivos y oculta controles incompletos', () => {
    expect(getBodyControlStates(controller)).toHaveLength(10);
    expect(getBodyControlStates(new BodyMorphController([]))).toEqual([]);
    const partial = {
      getAvailableMorphs: () => controller.getAvailableMorphs().filter(morph => morph.name !== 'calvesThinner'),
      getMorph: name => controller.getMorph(name), setMorph: (name, value) => controller.setMorph(name, value),
    };
    expect(getBodyControlStates(partial).some(item => item.id === 'legs')).toBe(false);
    expect(() => setBodyControl(partial, 'legs', .2)).toThrow('no compatible');
    for (const control of BODY_CONTROLS) for (const name of [...control.positive, ...control.negative]) {
      const body = meshes.find(mesh => mesh.name === 'Body');
      expect(Array.from(body.geometry.morphAttributes.position[body.morphTargetDictionary[name]].array).some(n => n !== 0)).toBe(true);
    }
  });

  it('aplica ambos sentidos sin acumular morphs opuestos y limita valores', () => {
    for (const control of BODY_CONTROLS) {
      for (const value of [99, -99, 0]) {
        const applied = setBodyControl(controller, control.id, value);
        expect(Math.abs(applied)).toBeLessThanOrEqual(control.max);
        for (const name of control.positive) expect(controller.getMorph(name)).toBe(Math.max(0, applied));
        for (const name of control.negative) expect(controller.getMorph(name)).toBe(Math.max(0, -applied));
        expect(getBodyControlStates(controller).find(item => item.id === control.id).value).toBe(applied);
      }
    }
  });

  it('mantiene los cuatro meshes sincronizados en cambios leves de altura y no mueve bones', () => {
    scene.updateMatrixWorld(true); meshes.forEach(mesh => mesh.skeleton.update());
    const bones = meshes[0].skeleton.bones.map(bone => [bone.position.toArray(), bone.quaternion.toArray()]);
    const body = meshes.find(mesh => mesh.name === 'Body');
    const before = body.getVertexPosition(0, new THREE.Vector3()).clone();
    setBodyControl(controller, 'height', .04);
    expect(body.getVertexPosition(0, new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(0);
    for (const mesh of meshes) expect(mesh.morphTargetInfluences[mesh.morphTargetDictionary.heightTaller]).toBe(.04);
    expect(meshes[0].skeleton.bones.map(bone => [bone.position.toArray(), bone.quaternion.toArray()])).toEqual(bones);
    setBodyControl(controller, 'height', -.04);
    for (const mesh of meshes) {
      expect(mesh.morphTargetInfluences[mesh.morphTargetDictionary.heightTaller]).toBe(0);
      expect(mesh.morphTargetInfluences[mesh.morphTargetDictionary.heightShorter]).toBe(.04);
    }
  });

  it('los presets limpian ajustes manuales y mantienen solo sus valores sin tocar la cara', () => {
    for (const control of BODY_CONTROLS) setBodyControl(controller, control.id, control.max);
    controller.setMorph('headAged', .1);
    applyBodyPreset(controller, 'athletic'); clearManualBodyControls(controller);
    for (const name of BODY_PRESET_MORPHS) expect(controller.getMorph(name)).toBe(BODY_PRESETS.athletic.morphs[name] ?? 0);
    expect(controller.getMorph('heightTaller')).toBe(0); expect(controller.getMorph('hipsWider')).toBe(0);
    expect(controller.getMorph('headAged')).toBe(.1);
    expect(getBodyControlStates(controller).find(item => item.id === 'weight').value).toBe(-.15);
  });

  it('rechaza NaN, infinitos y controles desconocidos sin cambiar influences', () => {
    setBodyControl(controller, 'legs', .2);
    const before = meshes.map(mesh => [...mesh.morphTargetInfluences]);
    for (const value of [NaN, Infinity, -Infinity]) expect(() => setBodyControl(controller, 'legs', value)).toThrow('finito');
    expect(() => setBodyControl(controller, 'inventado', .1)).toThrow('ausente');
    expect(meshes.map(mesh => mesh.morphTargetInfluences)).toEqual(before);
  });
});
