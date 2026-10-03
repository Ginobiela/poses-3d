import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AnimationPlayer } from './AnimationPlayer';
import type { AnimationLibrary } from './AnimationLibrary';
import type { Character } from '../character/CharacterLoader';
import type { SkeletonAdapter, StaticPose } from '../character/SkeletonAdapter';
import { PoseManager } from '../character/PoseManager';

function fixture() {
  const model = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'mixamorig_Hips'; model.add(hips);
  const head = new THREE.Bone(); head.name = 'mixamorig_Head'; hips.add(head);
  const bones = new Map([['mixamorig:Hips', hips], ['mixamorig:Head', head]]);
  const skeleton = {
    bones,
    reset: () => { hips.position.set(0, 1, 0); hips.quaternion.identity(); head.quaternion.identity(); },
    apply: (pose: StaticPose) => {
      hips.quaternion.fromArray(pose.bones['mixamorig:Hips']!);
      head.quaternion.fromArray(pose.bones['mixamorig:Head']!);
      hips.position.fromArray(pose.positions!['mixamorig:Hips']!);
    },
  } as unknown as SkeletonAdapter;
  skeleton.reset();
  const character = { model, root: model, skeleton, animations: [], placeOnFloor: () => {} } as unknown as Character;
  const clip = new THREE.AnimationClip('walk', 1, [
    new THREE.QuaternionKeyframeTrack('mixamorig:Head.quaternion', [0, 1], [0, 0, 0, 1, 0, Math.SQRT1_2, 0, Math.SQRT1_2]),
    new THREE.VectorKeyframeTrack('mixamorig:Hips.position', [0, 1], [0, 1, 0, .2, 1, 0]),
  ]);
  const library = { loadAnimation: async () => ({ entry: { id: 'walk', name: 'Walk', category: 'walk', file: 'walk/walk.json', source: 'test', license: 'CC0-1.0', skeleton: 'mixamorig', loop: true }, clip }) } as unknown as AnimationLibrary;
  return { character, hips, head, library };
}

describe('AnimationPlayer', () => {
  it('carga, busca 0/50/100%, pausa, cambia velocidad y reproduce', async () => {
    const { character, hips, head, library } = fixture();
    const player = new AnimationPlayer(character, library);
    await player.loadAnimation('walk');
    player.setProgress(0);
    expect(head.quaternion.y).toBeCloseTo(0, 5);
    player.setProgress(.5);
    expect(head.quaternion.y).toBeCloseTo(Math.sin(Math.PI / 8), 4);
    expect(hips.position.x).toBeCloseTo(.1, 5);
    player.setProgress(1);
    expect(head.quaternion.y).toBeCloseTo(Math.SQRT1_2, 4);
    player.setSpeed(.5);
    player.setProgress(.5);
    expect(hips.position.x).toBeCloseTo(.1, 5);
    expect(player.currentTime).toBeCloseTo(.5, 5);
    player.setLoop(false);
    player.play();
    player.update(.1);
    player.pause();
    expect(player.isPlaying).toBe(false);
    player.setProgress(1);
    player.setProgress(0);
    expect(head.quaternion.y).toBeCloseTo(0, 5);
    player.dispose();
  });

  it('congela un frame, lo recarga como pose y desconecta el mixer', async () => {
    const { character, head, library } = fixture();
    const player = new AnimationPlayer(character, library);
    await player.loadAnimation('walk');
    player.setProgress(.5);
    const captured = head.quaternion.clone().normalize();
    const pose = player.freezeFrame('mi frame');
    expect(pose.bones['mixamorig:Head']).toBeDefined();
    expect(Math.hypot(...pose.bones['mixamorig:Head']!)).toBeCloseTo(1, 8);
    const manager = new PoseManager(character);
    manager.addStaticPose(pose);
    manager.setStaticPose('mi frame');
    expect(head.quaternion.angleTo(captured)).toBeLessThan(1e-6);
    player.update(.8);
    expect(head.quaternion.angleTo(captured)).toBeLessThan(1e-6);
    manager.dispose(); player.dispose();
  });
});
