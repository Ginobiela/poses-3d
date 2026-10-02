import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PoseManager } from './PoseManager';
import type { Character } from './CharacterLoader';
import type { SkeletonAdapter } from './SkeletonAdapter';

function rig(): { character: Character; bone: THREE.Bone } {
  const model = new THREE.Group();
  const bone = new THREE.Bone();
  bone.name = 'mixamorig_Hips';
  model.add(bone);
  const skeleton = {
    bones: new Map([['mixamorig:Hips', bone]]),
    reset: () => { bone.position.set(0, 0, 0); bone.quaternion.identity(); },
    apply: (pose: { bones: Record<string, [number, number, number, number]> }) => {
      bone.quaternion.fromArray(pose.bones['mixamorig:Hips']!);
    },
  } as unknown as SkeletonAdapter;
  const character = { model, skeleton, animations: [], placeOnFloor: () => {} } as unknown as Character;
  return { character, bone };
}

describe('PoseManager', () => {
  it('aplica una pose estática por nombre de hueso y vuelve al reposo', () => {
    const { character, bone } = rig();
    const manager = new PoseManager(character);
    manager.addStaticPose({ name: 'pose', category: 'standing', bones: { 'mixamorig:Hips': [0, 0, 0.7071068, 0.7071068] } });
    manager.setStaticPose('pose');
    expect(bone.quaternion.z).toBeCloseTo(0.7071, 3);
    manager.dispose();
  });

  it('toma el 43 % de un clip glTF o JSON y deja fijo ese fotograma', () => {
    const { character, bone } = rig();
    const clip = new THREE.AnimationClip('walking', 1, [new THREE.VectorKeyframeTrack('mixamorig:Hips.position', [0, 1], [0, 0, 0, 1, 0, 0])]);
    character.animations.push(clip);
    const manager = new PoseManager(character);
    manager.setPoseFromAnimation('walking', 0.43);
    expect(bone.position.x).toBeCloseTo(0.43, 2);
    manager.addAnimationJSON(THREE.AnimationClip.toJSON(clip));
    manager.setPoseFromAnimation('walking', 0.43);
    expect(bone.position.x).toBeCloseTo(0.43, 2);
    manager.dispose();
  });
});
