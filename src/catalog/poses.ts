import type { StaticPose } from '../character/SkeletonAdapter';
export type PoseCategory = 'De pie' | 'Sentada' | 'Agachada' | 'En movimiento' | 'Action' | 'Run' | 'Fight' | 'Dynamic' | 'Custom';
export type Pose = { id: string; name: string; category: PoseCategory; sourceCategory?: string; data?: StaticPose };

export const poses: Pose[] = [];

const categories: Record<string, PoseCategory> = {
  standing: 'De pie',
  sitting: 'Sentada',
  crouching: 'Agachada',
  action: 'En movimiento',
  dynamic: 'En movimiento',
};

export async function loadPoseCatalog() {
  const response = await fetch(`${import.meta.env.BASE_URL}poses/manifest.json`);
  if (!response.ok) throw new Error(`No se pudo leer el catálogo de poses (${response.status}).`);
  const manifest = await response.json() as { poses: { id: string; name: string; category: string; type: string; file: string }[] };
  const loaded = manifest.poses.filter(entry => entry.type === 'static' && categories[entry.category] && entry.file.endsWith('.json'));
  if (!loaded.length) throw new Error('El catálogo no contiene poses riggeadas compatibles.');
  if (new Set(loaded.map(entry => entry.id)).size !== loaded.length) throw new Error('El catálogo contiene identificadores de pose repetidos.');
  poses.splice(0, poses.length, ...loaded.map(entry => ({ id: entry.id, name: entry.name, category: categories[entry.category]!, sourceCategory: entry.category })));
}

export function filterPoses(category: string) {
  const aliases: Record<string, string> = { Standing: 'standing', Sitting: 'sitting', Action: 'action', Dynamic: 'dynamic' };
  return category === 'Todas' ? poses : poses.filter(pose => pose.category === category || pose.sourceCategory === aliases[category]
    || (category === 'Run' && /run|running|correr|carrera/i.test(pose.name))
    || (category === 'Fight' && /fight|punch|kick|lucha|patada|guardia/i.test(pose.name)));
}

export function shuffledCycle<T>(items: T[], random = Math.random, last?: T): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.length > 1 && last !== undefined && out[0] === last) [out[0], out[1]] = [out[1]!, out[0]!];
  return out;
}
