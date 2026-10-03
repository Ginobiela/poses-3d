import type { StaticPose } from '../character/SkeletonAdapter';

export type CustomPose = StaticPose & { id: string; date: string; hipsPosition: [number, number, number]; animationSource?: string; animationProgress?: number };
const key = 'poses.custom.v1';
export function validateCustomPose(pose: CustomPose) {
  if (!pose.id || !pose.name || !pose.bones?.['mixamorig:Hips'] || !Array.isArray(pose.hipsPosition)) throw new Error('La pose necesita nombre y pelvis.');
  for (const [name, q] of Object.entries(pose.bones)) {
    if (!name.startsWith('mixamorig:') || q.length !== 4 || !q.every(Number.isFinite) || Math.abs(Math.hypot(...q) - 1) > 1e-5) throw new Error(`Quaternion inválido: ${name}`);
  }
  for (const p of [pose.hipsPosition, pose.modelPosition, ...Object.values(pose.positions ?? {})]) {
    if (p && (p.length !== 3 || !p.every(n => Number.isFinite(n) && Math.abs(n) < 10))) throw new Error('Posición inválida.');
  }
  return pose;
}
export function loadCustomPoses(): CustomPose[] {
  try { return (JSON.parse(localStorage.getItem(key) ?? '[]') as CustomPose[]).map(validateCustomPose); }
  catch { return []; }
}
export function saveCustomPose(pose: CustomPose) {
  validateCustomPose(pose);
  const all = loadCustomPoses().filter(item => item.id !== pose.id);
  localStorage.setItem(key, JSON.stringify([...all, pose]));
}
export function deleteCustomPose(id: string) {
  localStorage.setItem(key, JSON.stringify(loadCustomPoses().filter(item => item.id !== id)));
}
