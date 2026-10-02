import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Character } from '../character/CharacterLoader';
import type { SkeletonAdapter } from '../character/SkeletonAdapter';
import { PoseEditor } from './PoseEditor';

function character() {
  const root = new THREE.Group();
  const model = new THREE.Group();
  root.add(model);
  const names = ['Hips', 'Spine', 'Head', 'LeftForeArm', 'RightForeArm'];
  const bones = new Map<string, THREE.Bone>();
  let parent: THREE.Object3D = model;
  for (const name of names) {
    const bone = new THREE.Bone();
    bone.position.y = .2;
    parent.add(bone);
    bones.set(`mixamorig:${name}`, bone);
    parent = bone;
  }
  const skeleton = { bones } as SkeletonAdapter;
  return { root, model, skeleton, placeOnFloor: () => root.updateMatrixWorld(true) } as unknown as Character;
}

describe('PoseEditor', () => {
  it('edita una copia, aplica límites, restablece y recorre undo/redo', () => {
    const rig = character();
    const editor = new PoseEditor(rig);
    editor.beginPose();
    const untouched = rig.skeleton.bones.get('mixamorig:RightForeArm')!.quaternion.clone();
    editor.select('mixamorig:LeftForeArm');
    expect(editor.rotateSelected('x', 5)).toBe(true);
    const edited = rig.skeleton.bones.get('mixamorig:LeftForeArm')!.quaternion.clone();
    expect(edited.x).not.toBe(0);
    expect(rig.skeleton.bones.get('mixamorig:RightForeArm')!.quaternion.equals(untouched)).toBe(true);
    expect(editor.undo()).toBe(true);
    expect(rig.skeleton.bones.get('mixamorig:LeftForeArm')!.quaternion.equals(new THREE.Quaternion())).toBe(true);
    expect(editor.redo()).toBe(true);
    expect(rig.skeleton.bones.get('mixamorig:LeftForeArm')!.quaternion.equals(edited)).toBe(true);
    for (let i = 0; i < 25; i++) editor.rotateSelected('x', 5);
    const angle = new THREE.Euler().setFromQuaternion(editor.bone!.quaternion).x;
    expect(angle).toBeLessThanOrEqual(45 * Math.PI / 180 + 1e-6);
    editor.resetJoint();
    expect(editor.bone!.quaternion.equals(new THREE.Quaternion())).toBe(true);
    editor.select('mixamorig:Spine');
    editor.rotateSelected('z', 5);
    editor.resetPose();
    expect(rig.skeleton.bones.get('mixamorig:Spine')!.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });

  it('exporta quaternions normalizados y se recarga con la misma postura', () => {
    const rig = character();
    const editor = new PoseEditor(rig);
    editor.beginPose();
    editor.select('mixamorig:Head');
    editor.rotateSelected('y', 10);
    rig.root.updateMatrixWorld(true);
    const before = rig.skeleton.bones.get('mixamorig:RightForeArm')!.getWorldPosition(new THREE.Vector3());
    const pose = editor.exportPose('mi variante', 'standing');
    for (const q of Object.values(pose.bones)) expect(Math.hypot(...q)).toBeCloseTo(1, 10);
    expect(pose.hipsPosition).toEqual(pose.positions!['mixamorig:Hips']);
    const fresh = character();
    for (const [name, q] of Object.entries(pose.bones)) fresh.skeleton.bones.get(name)!.quaternion.fromArray(q);
    fresh.skeleton.bones.get('mixamorig:Hips')!.position.fromArray(pose.positions!['mixamorig:Hips']!);
    fresh.root.updateMatrixWorld(true);
    const after = fresh.skeleton.bones.get('mixamorig:RightForeArm')!.getWorldPosition(new THREE.Vector3());
    expect(after.distanceTo(before)).toBeLessThan(1e-10);
  });
});
