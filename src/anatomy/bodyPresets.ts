import type { BodyMorphController } from './BodyMorphController';

export type BodyPresetId = 'neutral' | 'lean' | 'athletic' | 'muscular';
type BodyPreset = Readonly<{ name: string; morphs: Readonly<Record<string, number>> }>;
const preset = (name: string, morphs: Record<string, number>): BodyPreset =>
  Object.freeze({ name, morphs: Object.freeze(morphs) });

/** Exact names inspected in human.glb. No height or limb length changes. */
export const BODY_PRESETS: Readonly<Record<BodyPresetId, BodyPreset>> = Object.freeze({
  neutral: preset('Neutral', {}),
  lean: preset('Delgado', { bodyThinner: .65 }),
  athletic: preset('Atlético', {
    bodyThinner: .15, bodyMuscular: .35, armsMuscular: .15,
    thighsMuscular: .15, calvesMuscular: .1, chestPectorals: .1, bellyToned: .25,
  }),
  muscular: preset('Musculoso', {
    bodyMuscular: .65, armsMuscular: .3, thighsMuscular: .3,
    calvesMuscular: .2, chestPectorals: .2, bellyToned: .4,
  }),
});

export const BODY_PRESET_MORPHS: readonly string[] = Object.freeze(
  [...new Set(Object.values(BODY_PRESETS).flatMap(item => Object.keys(item.morphs)))],
);

/** Validate the whole change before writing. Switching clears previous preset weights only. */
export function applyBodyPreset(controller: BodyMorphController, id: BodyPresetId): void {
  if (!Object.hasOwn(BODY_PRESETS, id)) throw new Error(`Preset corporal desconocido: ${id}.`);
  const available = new Map(controller.getAvailableMorphs().map(morph => [morph.name, morph.range]));
  const values = BODY_PRESET_MORPHS.map(name => {
    const value = BODY_PRESETS[id].morphs[name] ?? 0;
    const range = available.get(name);
    if (!range) throw new Error(`El preset necesita el morph «${name}», ausente en este personaje.`);
    if (!Number.isFinite(value) || value < range.min || value > range.max) {
      throw new Error(`Valor del preset fuera de rango para ${name}.`);
    }
    return { name, value };
  });
  for (const { name, value } of values) controller.setMorph(name, value);
}
