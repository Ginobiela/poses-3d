import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BodyMorphController } from './BodyMorphController.ts';

describe('BodyMorphController sobre human.glb real', () => {
  let scene;
  let meshes;
  let controller;
  beforeAll(async () => {
    const bytes = await readFile('public/models/human/human.glb');
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    scene = (await new GLTFLoader().parseAsync(buffer, '')).scene;
    meshes = [];
    scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object); });
    scene.updateMatrixWorld(true);
    meshes.forEach(mesh => mesh.skeleton.update());
  });
  beforeEach(() => { controller = new BodyMorphController(meshes); });
  afterEach(() => { controller.resetAll(); });
  afterAll(() => meshes.forEach(mesh => {
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  }));

  it('descubre 306 nombres exactos y sus 395 ocurrencias sin duplicar meshes', () => {
    const available = new BodyMorphController([...meshes, meshes[0]]).getAvailableMorphs();
    expect(available).toHaveLength(306);
    expect(available.reduce((total, morph) => total + morph.occurrences.length, 0)).toBe(395);
    expect(available.find(morph => morph.name === 'bodyMuscular').occurrences.map(item => item.meshName)).toEqual(['Body']);
    const height = available.find(morph => morph.name === 'heightTaller');
    expect(height.occurrences.map(item => [item.meshName, item.index])).toEqual([['Body', 92], ['Eyes', 16], ['Teeth', 17], ['Tongue', 15]]);
    // Metadata is a copy: callers cannot change registered ranges or indices.
    height.occurrences[0].index = 0;
    available.length = 0;
    expect(controller.getAvailableMorphs()).toHaveLength(306);
  });

  it('sincroniza todas las ocurrencias de un nombre y deja otros morphs intactos', () => {
    controller.setMorph('heightTaller', .2);
    expect(controller.getMorph('heightTaller')).toBe(.2);
    for (const mesh of meshes) expect(mesh.morphTargetInfluences[mesh.morphTargetDictionary.heightTaller]).toBe(.2);
    expect(controller.getMorph('heightShorter')).toBe(0);
    controller.setMorph('bodyMuscular', .4);
    expect(controller.getMorph('bodyMuscular')).toBe(.4);
    expect(controller.getMorph('heightTaller')).toBe(.2);
    controller.resetMorph('heightTaller');
    expect(controller.getMorph('heightTaller')).toBe(0);
    expect(controller.getMorph('bodyMuscular')).toBe(.4);
    controller.resetAll();
    expect(meshes.every(mesh => mesh.morphTargetInfluences.every(value => value === 0))).toBe(true);
  });

  it('limita valores, rechaza NaN/infinitos y no escribe al fallar', () => {
    expect(controller.setMorph('bodyMuscular', -2)).toBe(0);
    expect(controller.setMorph('bodyMuscular', 2)).toBe(1);
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => controller.setMorph('bodyMuscular', value)).toThrow('finito');
      expect(controller.getMorph('bodyMuscular')).toBe(1);
    }
    expect(() => controller.setMorph('elbowFlex_L', .5)).toThrow('No existe');
    expect(() => controller.getMorph('BodyMuscular')).toThrow('No existe');
    expect(() => controller.resetMorph('inexistente')).toThrow('No existe');
    expect(controller.getMorph('bodyMuscular')).toBe(1);
  });

  it('acepta topes menores y rechaza configuración inválida o nombres inexistentes', () => {
    const limited = new BodyMorphController(meshes, { bodyMuscular: { min: 0, max: .35 } });
    expect(limited.setMorph('bodyMuscular', 1)).toBe(.35);
    limited.resetAll();
    for (const range of [{ min: -1, max: 1 }, { min: 0, max: 2 }, { min: .8, max: .3 }, { min: 0, max: NaN }]) {
      expect(() => new BodyMorphController(meshes, { bodyMuscular: range })).toThrow('Límites inválidos');
    }
    expect(() => new BodyMorphController(meshes, { nonexistent: { min: 0, max: 1 } })).toThrow('No existe');
  });

  it('restaura la influencia inicial y detecta escrituras externas desincronizadas', () => {
    controller.setMorph('heightTaller', .15);
    const initial = new BodyMorphController(meshes);
    initial.setMorph('heightTaller', .3);
    initial.resetMorph('heightTaller');
    expect(initial.getMorph('heightTaller')).toBe(.15);
    meshes[1].morphTargetInfluences[meshes[1].morphTargetDictionary.heightTaller] = .25;
    expect(() => initial.getMorph('heightTaller')).toThrow('desincronizadas');
    initial.resetAll();
    expect(initial.getMorph('heightTaller')).toBe(.15);
  });

  it('cambia la superficie mediante influences sin editar geometría, materiales ni huesos', () => {
    const body = meshes.find(mesh => mesh.name === 'Body');
    const arm = body.skeleton.bones.find(bone => bone.userData.name === 'mixamorig:LeftArm');
    const originalRotation = arm.quaternion.clone();
    arm.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .3));
    scene.updateMatrixWorld(true); body.skeleton.update();
    const bones = body.skeleton.bones.map(bone => [bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()]);
    const geometry = body.geometry, material = body.material;
    const basePositions = Array.from(geometry.attributes.position.array);
    const normals = Array.from(geometry.attributes.normal.array);
    const index = body.morphTargetDictionary.bodyMuscular;
    const target = geometry.morphAttributes.position[index];
    const deltas = Array.from(target.array);
    let vertex = 0;
    while (target.getX(vertex) === 0 && target.getY(vertex) === 0 && target.getZ(vertex) === 0) vertex++;
    const before = body.getVertexPosition(vertex, new THREE.Vector3()).clone();
    controller.setMorph('bodyMuscular', .4);
    expect(body.getVertexPosition(vertex, new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(1e-6);
    expect(body.geometry).toBe(geometry); expect(body.material).toBe(material);
    expect(Array.from(geometry.attributes.position.array)).toEqual(basePositions);
    expect(Array.from(geometry.attributes.normal.array)).toEqual(normals);
    expect(Array.from(target.array)).toEqual(deltas);
    expect(body.skeleton.bones.map(bone => [bone.position.toArray(), bone.quaternion.toArray(), bone.scale.toArray()])).toEqual(bones);
    controller.resetAll();
    expect(body.getVertexPosition(vertex, new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-10);
    arm.quaternion.copy(originalRotation); scene.updateMatrixWorld(true); body.skeleton.update();
  });

  it('admite personajes sin morphs y rechaza diccionarios corruptos sin modificarlos', () => {
    expect(new BodyMorphController([]).getAvailableMorphs()).toEqual([]);
    const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    expect(new BodyMorphController([mesh]).getAvailableMorphs()).toEqual([]);
    mesh.morphTargetDictionary = { broken: 0 }; mesh.morphTargetInfluences = [0];
    expect(() => new BodyMorphController([mesh])).toThrow('Índice de morph inválido');
    expect(mesh.morphTargetInfluences).toEqual([0]);
    mesh.geometry.dispose(); (mesh.material).dispose();
  });
});
