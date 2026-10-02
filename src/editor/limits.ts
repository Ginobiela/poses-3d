import * as THREE from 'three';

export type JointLimit = { x: [number, number]; y: [number, number]; z: [number, number] };
const symmetric = (x: number, y: number, z: number): JointLimit => ({ x: [-x, x], y: [-y, y], z: [-z, z] });

// Degrees relative to the loaded pose. These are UI safety bounds, not an
// anatomical solver; the source JSON remains unchanged.
export const JOINT_LIMITS: Record<string, JointLimit> = {
  LeftForeArm: symmetric(45, 25, 30), RightForeArm: symmetric(45, 25, 30),
  LeftLeg: symmetric(55, 20, 20), RightLeg: symmetric(55, 20, 20),
  Neck: symmetric(25, 35, 25), Head: symmetric(30, 40, 30),
  Spine: symmetric(22, 25, 22), Spine1: symmetric(22, 25, 22), Spine2: symmetric(25, 30, 25),
  LeftShoulder: symmetric(40, 45, 45), RightShoulder: symmetric(40, 45, 45),
  LeftArm: symmetric(80, 85, 85), RightArm: symmetric(80, 85, 85),
};

const radians = Math.PI / 180;
export function clampJointRotation(name: string, baseline: THREE.Quaternion, current: THREE.Quaternion): THREE.Quaternion {
  const shortName = name.replace(/^mixamorig:/, '');
  const limit = JOINT_LIMITS[shortName];
  if (!limit) return current.clone().normalize();
  const relative = baseline.clone().invert().multiply(current).normalize();
  const angles = new THREE.Euler().setFromQuaternion(relative, 'XYZ');
  angles.x = THREE.MathUtils.clamp(angles.x, limit.x[0] * radians, limit.x[1] * radians);
  angles.y = THREE.MathUtils.clamp(angles.y, limit.y[0] * radians, limit.y[1] * radians);
  angles.z = THREE.MathUtils.clamp(angles.z, limit.z[0] * radians, limit.z[1] * radians);
  return baseline.clone().multiply(new THREE.Quaternion().setFromEuler(angles)).normalize();
}
