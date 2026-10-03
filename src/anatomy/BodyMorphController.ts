import type { SkinnedMesh } from 'three';

export type MorphRange = Readonly<{ min: number; max: number }>;
export type AvailableMorph = {
  name: string;
  range: MorphRange;
  occurrences: { meshName: string; meshId: string; index: number; initialValue: number }[];
};
type Occurrence = { mesh: SkinnedMesh; index: number; initialValue: number };
type Morph = { range: MorphRange; occurrences: Occurrence[] };

/** Operates on existing influences only. 0–1 is an application policy, not an anatomical guarantee. */
export class BodyMorphController {
  private readonly morphs = new Map<string, Morph>();

  constructor(meshes: readonly SkinnedMesh[], limits: Readonly<Record<string, MorphRange>> = {}) {
    for (const mesh of new Set(meshes)) {
      const dictionary = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dictionary && !influences) continue;
      if (!mesh.isSkinnedMesh || !dictionary || !influences) throw new Error(`Morphs incompletos en ${mesh.name}.`);
      const indices = new Set<number>();
      for (const [name, index] of Object.entries(dictionary)) {
        if (!Number.isInteger(index) || index < 0 || index >= influences.length || indices.has(index)
          || !mesh.geometry.morphAttributes.position?.[index]) {
          throw new Error(`Índice de morph inválido: ${mesh.name}/${name}.`);
        }
        indices.add(index);
        const configured = Object.hasOwn(limits, name) ? limits[name]! : { min: 0, max: 1 };
        if (!Number.isFinite(configured.min) || !Number.isFinite(configured.max)
          || configured.min < 0 || configured.max > 1 || configured.min > configured.max) {
          throw new Error(`Límites inválidos para ${name}; deben estar dentro de 0–1.`);
        }
        const initialValue = influences[index]!;
        if (!Number.isFinite(initialValue) || initialValue < configured.min || initialValue > configured.max) {
          throw new Error(`Influencia inicial fuera de rango: ${mesh.name}/${name}.`);
        }
        let morph = this.morphs.get(name);
        if (!morph) {
          morph = { range: { min: configured.min, max: configured.max }, occurrences: [] };
          this.morphs.set(name, morph);
        }
        morph.occurrences.push({ mesh, index, initialValue });
      }
    }
    for (const name of Object.keys(limits)) this.find(name);
  }

  private find(name: string): Morph {
    const morph = this.morphs.get(name);
    if (!morph) throw new Error(`No existe el morph «${name}» en este personaje.`);
    return morph;
  }

  setMorph(name: string, value: number): number {
    const morph = this.find(name);
    if (!Number.isFinite(value)) throw new Error(`La influencia de ${name} debe ser un número finito.`);
    const applied = Math.max(morph.range.min, Math.min(morph.range.max, value));
    for (const occurrence of morph.occurrences) occurrence.mesh.morphTargetInfluences![occurrence.index] = applied;
    return applied;
  }

  getMorph(name: string): number {
    const morph = this.find(name);
    const first = morph.occurrences[0]!;
    const value = first.mesh.morphTargetInfluences![first.index]!;
    if (!Number.isFinite(value) || value < morph.range.min || value > morph.range.max) {
      throw new Error(`Influencia fuera de rango para ${name}.`);
    }
    if (morph.occurrences.some(({ mesh, index }) => mesh.morphTargetInfluences![index] !== value)) {
      throw new Error(`Las influencias de ${name} están desincronizadas entre meshes.`);
    }
    return value;
  }

  resetMorph(name: string): void {
    for (const { mesh, index, initialValue } of this.find(name).occurrences) mesh.morphTargetInfluences![index] = initialValue;
  }

  resetAll(): void {
    for (const name of this.morphs.keys()) this.resetMorph(name);
  }

  getAvailableMorphs(): AvailableMorph[] {
    return [...this.morphs].map(([name, { range, occurrences }]) => ({
      name, range: { ...range },
      occurrences: occurrences.map(({ mesh, index, initialValue }) => ({ meshName: mesh.name, meshId: mesh.uuid, index, initialValue })),
    }));
  }
}
