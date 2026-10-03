import * as THREE from 'three';
import type { Character } from '../character/CharacterLoader';
import type { StaticPose } from '../character/SkeletonAdapter';
import { AnimationLibrary, type AnimationEntry } from './AnimationLibrary';

export class AnimationPlayer {
  private readonly mixer: THREE.AnimationMixer;
  private readonly originalModelPosition: THREE.Vector3;
  private action?: THREE.AnimationAction;
  private clip?: THREE.AnimationClip;
  private entry?: AnimationEntry;
  private playing = false;
  private time = 0;
  private loop = true;
  private generation = 0;

  constructor(private readonly character: Character, private readonly library = new AnimationLibrary()) {
    this.mixer = new THREE.AnimationMixer(character.model);
    this.originalModelPosition = character.model.position.clone();
    this.mixer.addEventListener('finished', () => { this.playing = false; });
  }

  get duration() { return this.clip?.duration ?? 0; }
  get currentTime() { return this.time; }
  get progress() { return this.duration ? this.time / this.duration : 0; }
  get isPlaying() { return this.playing; }
  get activeEntry() { return this.entry; }

  async loadAnimation(id: string) {
    const generation = ++this.generation;
    const { entry, clip } = await this.library.loadAnimation(id);
    if (generation !== this.generation) return;
    this.release();
    this.character.skeleton.reset();
    this.character.model.position.copy(this.originalModelPosition);
    const bound = clip.clone();
    for (const track of bound.tracks) {
      const match = /^([^.]*)\.(quaternion|position|scale)$/.exec(track.name);
      const bone = match && (this.character.skeleton.bones.get(match[1]!)
        ?? [...this.character.skeleton.bones.values()].find(item => item.name === match[1]));
      if (!bone) throw new Error(`La animación ${id} usa un hueso no compatible: ${track.name}.`);
      track.name = `${bone.name}.${match[2]}`;
    }
    this.clip = bound;
    this.entry = entry;
    this.loop = entry.loop;
    this.action = this.mixer.clipAction(bound);
    this.action.setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce, this.loop ? Infinity : 1);
    this.action.clampWhenFinished = !this.loop;
    this.action.play();
    this.setTime(0);
    return entry;
  }

  play() {
    if (!this.action) return;
    if (!this.loop && this.time >= this.duration) this.setTime(0);
    this.action.paused = false;
    this.playing = true;
  }
  pause() {
    this.playing = false;
    if (this.action) this.action.paused = true;
  }
  setProgress(fraction: number) {
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error('El progreso debe estar entre 0 y 1.');
    this.setTime(this.duration * fraction);
  }
  setTime(seconds: number) {
    if (!this.action || !Number.isFinite(seconds)) return;
    this.pause();
    this.time = THREE.MathUtils.clamp(seconds, 0, this.duration);
    this.action.paused = false;
    const speed = this.mixer.timeScale;
    this.mixer.timeScale = 1;
    this.action.enabled = true;
    this.mixer.setTime(this.time === this.duration && this.loop ? Math.max(0, this.time - 1e-6) : this.time);
    this.mixer.timeScale = speed;
    this.action.paused = true;
    this.character.model.updateMatrixWorld(true);
  }
  setSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed < .1 || speed > 3) throw new Error('La velocidad debe estar entre 0.1 y 3.');
    this.mixer.timeScale = speed;
  }
  setLoop(loop: boolean) {
    this.loop = loop;
    this.action?.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    if (this.action) this.action.clampWhenFinished = !loop;
  }
  update(deltaSeconds: number) {
    if (!this.playing || !this.action || !this.clip) return;
    this.mixer.update(Math.min(.1, Math.max(0, deltaSeconds)));
    this.time = this.action.time;
    if (!this.loop && this.action.time >= this.duration - 1e-5) {
      this.time = this.duration;
      this.pause();
    }
  }
  stop() {
    this.generation++;
    this.release();
    this.character.skeleton.reset();
    this.character.model.position.copy(this.originalModelPosition);
    this.character.model.updateMatrixWorld(true);
  }
  freezeFrame(name = 'frame'): StaticPose & { hipsPosition: [number, number, number] } {
    if (!this.clip) throw new Error('No hay una animación activa.');
    this.pause();
    this.generation++;
    const bones: StaticPose['bones'] = {};
    const positions: NonNullable<StaticPose['positions']> = {};
    for (const [boneName, bone] of this.character.skeleton.bones) {
      const q = bone.quaternion.clone().normalize();
      bones[boneName] = [q.x, q.y, q.z, q.w];
      positions[boneName] = [bone.position.x, bone.position.y, bone.position.z];
    }
    const hips = this.character.skeleton.bones.get('mixamorig:Hips')!;
    const hipsPosition: [number, number, number] = [hips.position.x, hips.position.y, hips.position.z];
    const modelPosition: [number, number, number] = [this.character.model.position.x, this.character.model.position.y, this.character.model.position.z];
    const pose = { name, category: this.entry?.category ?? 'action', bones,
      positions, hipsPosition, modelPosition };
    this.release();
    return pose;
  }
  private release() {
    this.playing = false;
    this.mixer.stopAllAction();
    if (this.clip) this.mixer.uncacheClip(this.clip);
    this.action = undefined;
    this.clip = undefined;
    this.entry = undefined;
    this.time = 0;
  }
  dispose() { this.generation++; this.release(); this.mixer.uncacheRoot(this.character.model); }
}
