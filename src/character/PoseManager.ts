import * as THREE from 'three';
import type { Character } from './CharacterLoader';
import type { StaticPose } from './SkeletonAdapter';

export class PoseManager {
  private readonly poses = new Map<string, StaticPose>();
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly mixer: THREE.AnimationMixer;

  constructor(private readonly character: Character) {
    this.mixer = new THREE.AnimationMixer(character.model);
    for (const clip of character.animations) this.addAnimationClip(clip);
  }

  addStaticPose(pose: StaticPose) { this.poses.set(pose.name, pose); }
  addAnimationClip(clip: THREE.AnimationClip) {
    const bound = clip.clone();
    for (const track of bound.tracks) {
      for (const [original, bone] of this.character.skeleton.bones) {
        if (track.name.startsWith(`${original}.`)) {
          track.name = `${bone.name}${track.name.slice(original.length)}`;
          break;
        }
      }
    }
    this.clips.set(bound.name, bound);
  }
  addAnimationJSON(json: Parameters<typeof THREE.AnimationClip.parse>[0]) { this.addAnimationClip(THREE.AnimationClip.parse(json)); }
  hasStaticPose(name: string) { return this.poses.has(name); }

  setStaticPose(name: string) {
    const pose = this.poses.get(name);
    if (!pose) throw new Error(`No existe la pose ${name}.`);
    this.mixer.stopAllAction();
    this.character.skeleton.apply(pose.hipsPosition && !pose.positions?.['mixamorig:Hips']
      ? { ...pose, positions: { ...pose.positions, 'mixamorig:Hips': pose.hipsPosition } } : pose);
    if (pose.modelPosition) {
      if (pose.modelPosition.length !== 3 || !pose.modelPosition.every(n => Number.isFinite(n) && Math.abs(n) < 10)) throw new Error('Posición del modelo inválida.');
      this.character.model.position.fromArray(pose.modelPosition);
      this.character.model.updateMatrixWorld(true);
    } else this.character.placeOnFloor();
  }

  /** Samples one frame. The mixer is never advanced by the render loop. */
  setPoseFromAnimation(name: string, fraction: number) {
    const clip = this.clips.get(name);
    if (!clip) throw new Error(`No existe la animación ${name}.`);
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error('El instante debe estar entre 0 y 1.');
    this.mixer.stopAllAction();
    this.character.skeleton.reset();
    const action = this.mixer.clipAction(clip);
    action.reset().play();
    this.mixer.setTime(clip.duration * fraction);
    action.paused = true;
    this.character.placeOnFloor();
  }

  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.character.model); }
}
