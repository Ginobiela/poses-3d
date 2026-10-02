import * as THREE from 'three';

export type StaticPose = {
  name: string;
  category: string;
  bones: Record<string, [number, number, number, number]>;
  positions?: Record<string, [number, number, number]>;
};

const REQUIRED = ['Hips', 'Spine', 'Head', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg'];

export class SkeletonAdapter {
  readonly bones = new Map<string, THREE.Bone>();
  private readonly rest = new Map<string, THREE.Quaternion>();
  private readonly restPositions = new Map<string, THREE.Vector3>();

  constructor(readonly root: THREE.Object3D, skinnedMeshes: THREE.SkinnedMesh[]) {
    const register = (bone: THREE.Bone) => {
      // GLTFLoader sanitizes ':' in Object3D.name for animation binding.
      // It keeps the exact glTF joint name in userData.name.
      const name = typeof bone.userData.name === 'string' ? bone.userData.name : bone.name;
      if (name) this.bones.set(name, bone);
    };
    root.traverse(object => { if (object instanceof THREE.Bone) register(object); });
    for (const mesh of skinnedMeshes) mesh.skeleton.bones.forEach(register);
    const missing = REQUIRED.map(name => `mixamorig:${name}`).filter(name => !this.bones.has(name));
    if (missing.length) throw new Error(`El modelo no tiene los huesos Mixamo necesarios: ${missing.join(', ')}.`);
    for (const [name, bone] of this.bones) {
      this.rest.set(name, bone.quaternion.clone());
      this.restPositions.set(name, bone.position.clone());
    }
    console.info(`Esqueleto humano: ${this.bones.size} huesos`, [...this.bones.keys()]);
  }

  reset() {
    for (const [name, bone] of this.bones) {
      bone.quaternion.copy(this.rest.get(name)!);
      bone.position.copy(this.restPositions.get(name)!);
    }
    this.root.updateMatrixWorld(true);
  }

  apply(pose: StaticPose) {
    this.reset();
    for (const [name, values] of Object.entries(pose.bones)) {
      const bone = this.bones.get(name);
      if (!bone) throw new Error(`La pose ${pose.name} usa un hueso ausente: ${name}.`);
      if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
        throw new Error(`Quaternion inválido para ${name} en ${pose.name}.`);
      }
      bone.quaternion.fromArray(values).normalize();
    }
    for (const [name, values] of Object.entries(pose.positions ?? {})) {
      const bone = this.bones.get(name);
      if (!bone) throw new Error(`La pose ${pose.name} usa un hueso ausente: ${name}.`);
      if (values.length !== 3 || values.some(value => !Number.isFinite(value) || Math.abs(value) > 2.5)) {
        throw new Error(`Posición inválida para ${name} en ${pose.name}.`);
      }
      bone.position.fromArray(values);
    }
    this.root.updateMatrixWorld(true);
  }
}
