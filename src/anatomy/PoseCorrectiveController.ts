import { Quaternion, Vector3 } from 'three';
import type { Bone, Object3D } from 'three';
import type { BodyMorphController } from './BodyMorphController';
import { POSE_CORRECTIVES } from './correctives';
import type { PoseCorrective } from './correctives';

export type CorrectiveState = {
  id: string; joint: string; morph: string; active: boolean;
  reason: string | null; angle: number | null; influence: number;
};
type Sensor =
  | { type: 'bend'; a: Bone; b: Bone; c: Bone }
  | { type: 'local-axis'; bone: Bone; inverseRest: Quaternion; axis: Vector3; direction: number };
type Binding = { sensor: Sensor; start: number; full: number; max: number; state: CorrectiveState };
const finiteTuple = (values: readonly number[], length: number) => values.length === length && values.every(Number.isFinite);
const ancestorOf = (parent: Bone, child: Bone) => {
  let ancestor = child.parent;
  while (ancestor && ancestor !== parent) ancestor = ancestor.parent;
  return ancestor === parent;
};

/** Explicit updates only. Owns configured corrective influences, never bones or body presets. */
export class PoseCorrectiveController {
  private readonly bindings: Binding[] = [];
  private readonly states: CorrectiveState[] = [];
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  private readonly rotation = new Quaternion();

  constructor(
    private readonly root: Object3D,
    bones: ReadonlyMap<string, Bone>,
    private readonly morphs: BodyMorphController,
    configs: readonly PoseCorrective[] = POSE_CORRECTIVES,
  ) {
    const available = new Map(morphs.getAvailableMorphs().map(morph => [morph.name, morph]));
    const ids = new Set<string>(); const targets = new Set<string>();
    for (const config of configs) {
      if (!config.id || !config.joint || !config.morph || ids.has(config.id) || targets.has(config.morph)
        || !Number.isFinite(config.startAngle) || !Number.isFinite(config.fullAngle)
        || config.startAngle < 0 || config.fullAngle > 180 || config.fullAngle <= config.startAngle) {
        throw new Error('Correctivo inválido: IDs/targets únicos y umbrales 0 ≤ inicio < máximo ≤ 180 requeridos.');
      }
      ids.add(config.id); targets.add(config.morph);
      const measurement = config.measurement;
      let sensor: Sensor | undefined;
      let missingBone = false;
      const find = (name: string) => {
        const bone = bones.get(name);
        let ancestor: Object3D | null = bone ?? null;
        while (ancestor && ancestor !== root) ancestor = ancestor.parent;
        if (!bone?.isBone || ancestor !== root) { missingBone = true; return undefined; }
        return bone;
      };
      if (measurement.type === 'bend') {
        if (!measurement.boneA || !measurement.boneB || !measurement.boneC
          || new Set([measurement.boneA, measurement.boneB, measurement.boneC]).size !== 3) {
          throw new Error(`Tres huesos distintos requeridos en ${config.id}.`);
        }
        const a = find(measurement.boneA), b = find(measurement.boneB), c = find(measurement.boneC);
        if (a && b && c) {
          if (!ancestorOf(a, b) || !ancestorOf(b, c)) throw new Error(`Cadena articular fuera de orden en ${config.id}.`);
          sensor = { type: 'bend', a, b, c };
        }
      } else if (measurement.type === 'local-axis') {
        if (!finiteTuple(measurement.axis, 3) || !Number.isFinite(Math.hypot(...measurement.axis)) || Math.hypot(...measurement.axis) < 1e-8
          || !finiteTuple(measurement.restQuaternion, 4) || !Number.isFinite(Math.hypot(...measurement.restQuaternion))
          || Math.hypot(...measurement.restQuaternion) < 1e-8
          || ![1, -1].includes(measurement.direction)) throw new Error(`Calibración local inválida en ${config.id}.`);
        const bone = find(measurement.bone);
        if (bone) sensor = {
          type: 'local-axis', bone, direction: measurement.direction,
          axis: new Vector3().fromArray(measurement.axis).divideScalar(Math.hypot(...measurement.axis)),
          inverseRest: new Quaternion().fromArray(measurement.restQuaternion.map(value => value / Math.hypot(...measurement.restQuaternion))).invert(),
        };
      } else throw new Error(`Medición desconocida en ${config.id}.`);
      const morph = available.get(config.morph);
      if (morph && morph.range.min !== 0) throw new Error(`El correctivo ${config.morph} debe admitir influencia 0.`);
      const reason = !morph ? 'Morph ausente' : missingBone ? 'Hueso ausente o ajeno al personaje' : null;
      const state: CorrectiveState = {
        id: config.id, joint: config.joint, morph: config.morph, active: reason === null,
        reason, angle: null, influence: 0,
      };
      this.states.push(state);
      if (sensor && morph && state.active) this.bindings.push({ sensor, state, start: config.startAngle, full: config.fullAngle, max: morph.range.max });
    }
  }

  private measure(sensor: Sensor): number | null {
    if (sensor.type === 'bend') {
      this.a.setFromMatrixPosition(sensor.a.matrixWorld);
      this.b.setFromMatrixPosition(sensor.b.matrixWorld);
      this.c.setFromMatrixPosition(sensor.c.matrixWorld);
      this.a.sub(this.b); this.c.sub(this.b);
      const length = this.a.length() * this.c.length();
      if (!Number.isFinite(length) || length < 1e-12) return null;
      const cosine = this.a.dot(this.c) / length;
      if (!Number.isFinite(cosine)) return null;
      return 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
    }
    const q = sensor.bone.quaternion;
    if (!Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z) || !Number.isFinite(q.w)
      || !Number.isFinite(q.lengthSq()) || q.lengthSq() < 1e-16) return null;
    this.rotation.copy(q).normalize().premultiply(sensor.inverseRest);
    const projection = this.rotation.x * sensor.axis.x + this.rotation.y * sensor.axis.y + this.rotation.z * sensor.axis.z;
    if (Math.hypot(projection, this.rotation.w) < 1e-8) return null;
    let angle = 2 * Math.atan2(projection, this.rotation.w);
    if (angle > Math.PI) angle -= 2 * Math.PI;
    if (angle < -Math.PI) angle += 2 * Math.PI;
    return Math.max(0, sensor.direction * angle * 180 / Math.PI);
  }

  update(): void {
    if (!this.bindings.length) return;
    this.root.updateWorldMatrix(true, true);
    for (const binding of this.bindings) {
      const angle = this.measure(binding.sensor);
      const value = angle === null ? 0 : Math.max(0, Math.min(1, (angle - binding.start) / (binding.full - binding.start)));
      binding.state.angle = angle;
      binding.state.reason = angle === null ? 'Ángulo inválido o segmento degenerado' : null;
      binding.state.influence = this.morphs.setMorph(binding.state.morph, value * binding.max);
    }
  }

  /** Clear only influences owned by active bindings; unrelated body morphs remain intact. */
  reset(): void {
    for (const { state } of this.bindings) {
      this.morphs.setMorph(state.morph, 0);
      state.angle = null; state.influence = 0; state.reason = null;
    }
  }

  getStates(): CorrectiveState[] { return this.states.map(state => ({ ...state })); }
}
