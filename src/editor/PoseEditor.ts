import * as THREE from 'three';
import type { Character } from '../character/CharacterLoader';
import type { StaticPose } from '../character/SkeletonAdapter';
import { clampJointRotation } from './limits';

type QuaternionValues = [number, number, number, number];
type PositionValues = [number, number, number];
type Snapshot = { bones: Record<string, QuaternionValues>; hipsPosition: PositionValues; modelPosition: PositionValues };

export const EDITABLE_JOINTS = [
  ['mixamorig:Hips', 'Pelvis'], ['mixamorig:Spine', 'Columna'],
  ['mixamorig:Spine2', 'Pecho'], ['mixamorig:Neck', 'Cuello'], ['mixamorig:Head', 'Cabeza'],
  ['mixamorig:LeftShoulder', 'Hombro izquierdo'], ['mixamorig:RightShoulder', 'Hombro derecho'],
  ['mixamorig:LeftArm', 'Brazo izquierdo'], ['mixamorig:RightArm', 'Brazo derecho'],
  ['mixamorig:LeftForeArm', 'Antebrazo izquierdo'], ['mixamorig:RightForeArm', 'Antebrazo derecho'],
  ['mixamorig:LeftHand', 'Mano izquierda'], ['mixamorig:RightHand', 'Mano derecha'],
  ['mixamorig:LeftUpLeg', 'Muslo izquierdo'], ['mixamorig:RightUpLeg', 'Muslo derecho'],
  ['mixamorig:LeftLeg', 'Pierna izquierda'], ['mixamorig:RightLeg', 'Pierna derecha'],
  ['mixamorig:LeftFoot', 'Pie izquierdo'], ['mixamorig:RightFoot', 'Pie derecho'],
] as const;

function equal(a: Snapshot, b: Snapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class PoseEditor {
  private baseline: Snapshot;
  private history: Snapshot[];
  private historyIndex = 0;
  selected = 'mixamorig:Hips';
  private preservePlacement = false;

  constructor(private readonly character: Character) {
    this.baseline = this.capture();
    this.history = [this.baseline];
  }

  get bone() { return this.character.skeleton.bones.get(this.selected); }
  get canUndo() { return this.historyIndex > 0; }
  get canRedo() { return this.historyIndex < this.history.length - 1; }

  beginPose(preservePlacement = false) {
    this.preservePlacement = preservePlacement;
    this.baseline = this.capture();
    this.history = [this.baseline];
    this.historyIndex = 0;
    this.selected = 'mixamorig:Hips';
  }

  select(name: string) {
    if (!EDITABLE_JOINTS.some(([bone]) => bone === name) || !this.character.skeleton.bones.has(name)) {
      throw new Error(`Articulación no editable: ${name}.`);
    }
    this.selected = name;
  }

  capture(): Snapshot {
    const bones: Record<string, QuaternionValues> = {};
    for (const [name, bone] of this.character.skeleton.bones) {
      bones[name] = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w];
    }
    const hips = this.character.skeleton.bones.get('mixamorig:Hips');
    if (!hips) throw new Error('El modelo no tiene pelvis.');
    return { bones, hipsPosition: [hips.position.x, hips.position.y, hips.position.z], modelPosition: this.character.model.position.toArray() as PositionValues };
  }

  clampSelected() {
    const bone = this.bone;
    if (!bone) return;
    const base = this.baseline.bones[this.selected];
    if (!base) return;
    bone.quaternion.copy(clampJointRotation(this.selected, new THREE.Quaternion(...base), bone.quaternion));
    if (this.selected === 'mixamorig:Hips') {
      for (let axis = 0; axis < 3; axis++) {
        const key = (['x', 'y', 'z'] as const)[axis];
        bone.position[key] = THREE.MathUtils.clamp(bone.position[key], this.baseline.hipsPosition[axis]! - .65,
          this.baseline.hipsPosition[axis]! + .65);
      }
    }
    this.character.root.updateMatrixWorld(true);
    if (!this.preservePlacement) this.character.placeOnFloor();
  }

  commit() {
    this.clampSelected();
    const current = this.capture();
    if (equal(current, this.history[this.historyIndex]!)) return false;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(current);
    if (this.history.length > 60) this.history.shift();
    this.historyIndex = this.history.length - 1;
    return true;
  }

  rotateSelected(axis: 'x' | 'y' | 'z', degrees: number) {
    const bone = this.bone;
    if (!bone || !Number.isFinite(degrees)) return false;
    const direction = axis === 'x' ? new THREE.Vector3(1, 0, 0)
      : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(direction, degrees * Math.PI / 180));
    return this.commit();
  }

  private restore(snapshot: Snapshot) {
    for (const [name, values] of Object.entries(snapshot.bones)) {
      this.character.skeleton.bones.get(name)?.quaternion.fromArray(values);
    }
    this.character.skeleton.bones.get('mixamorig:Hips')!.position.fromArray(snapshot.hipsPosition);
    this.character.model.position.fromArray(snapshot.modelPosition);
    this.character.root.updateMatrixWorld(true);
  }

  undo() {
    if (!this.canUndo) return false;
    this.restore(this.history[--this.historyIndex]!);
    return true;
  }
  redo() {
    if (!this.canRedo) return false;
    this.restore(this.history[++this.historyIndex]!);
    return true;
  }
  resetJoint() {
    const base = this.baseline.bones[this.selected];
    if (!base || !this.bone) return;
    this.bone.quaternion.fromArray(base);
    if (this.selected === 'mixamorig:Hips') this.bone.position.fromArray(this.baseline.hipsPosition);
    this.commit();
  }
  resetPose() {
    this.restore(this.baseline);
    this.commit();
  }

  exportPose(name: string, category: string): StaticPose & { hipsPosition: PositionValues } {
    const snapshot = this.capture();
    const bones: Record<string, QuaternionValues> = {};
    for (const [boneName, values] of Object.entries(snapshot.bones)) {
      const q = new THREE.Quaternion(...values).normalize();
      bones[boneName] = [q.x, q.y, q.z, q.w];
    }
    return {
      name: name.trim() || 'mi-pose', category,
      bones, positions: { 'mixamorig:Hips': snapshot.hipsPosition },
      hipsPosition: snapshot.hipsPosition,
      modelPosition: [this.character.model.position.x, this.character.model.position.y, this.character.model.position.z],
    };
  }
}
