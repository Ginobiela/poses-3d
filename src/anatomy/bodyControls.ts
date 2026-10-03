import type { BodyMorphController } from './BodyMorphController';
import { BODY_PRESET_MORPHS } from './bodyPresets';

type Control = Readonly<{ id: string; label: string; positive: readonly string[]; negative: readonly string[]; max: number; step: number }>;
const control = (id: string, label: string, positive: string[], negative: string[] = [], max = .35, step = .01): Control =>
  Object.freeze({ id, label, positive: Object.freeze(positive), negative: Object.freeze(negative), max, step });

/** Operational UI caps, not anatomical measurements. Exact targets from MODEL_AUDIT.md. */
export const BODY_CONTROLS: readonly Control[] = Object.freeze([
  control('muscle', 'Musculatura', ['bodyMuscular'], [], .65),
  control('weight', 'Peso / grasa', ['bodyHeavier'], ['bodyThinner'], .65),
  control('height', 'Altura (ajuste leve)', ['heightTaller'], ['heightShorter'], .04, .002),
  control('shoulders', 'Hombros', ['shouldersWider'], ['shouldersNarrower']),
  control('chest', 'Pecho', ['chestWider'], ['chestNarrower']),
  control('torso', 'Torso', ['torsoLatsWider'], ['torsoLatsNarrower']),
  control('waist', 'Cintura', ['waistWider'], ['waistNarrower']),
  control('hips', 'Caderas', ['hipsWider'], ['hipsNarrower']),
  control('arms', 'Brazos', ['armsThicker'], ['armsThinner']),
  control('legs', 'Piernas', ['thighsThicker', 'calvesThicker'], ['thighsThinner', 'calvesThinner']),
]);

export type BodyControlState = { id: string; label: string; min: number; max: number; step: number; value: number };

function supported(controller: BodyMorphController): Control[] {
  const available = new Map(controller.getAvailableMorphs().map(morph => [morph.name, morph.range]));
  return BODY_CONTROLS.filter(item => [...item.positive, ...item.negative].every(name => {
    const range = available.get(name);
    return range && range.min === 0 && range.max >= item.max;
  }));
}

export function getBodyControlStates(controller: BodyMorphController): BodyControlState[] {
  return supported(controller).map(item => ({
    id: item.id, label: item.label, min: item.negative.length ? -item.max : 0, max: item.max, step: item.step,
    value: controller.getMorph(item.positive[0]!) - (item.negative.length ? controller.getMorph(item.negative[0]!) : 0),
  }));
}

export function setBodyControl(controller: BodyMorphController, id: string, value: number): number {
  const item = supported(controller).find(item => item.id === id);
  if (!item) throw new Error(`Control corporal ausente o no compatible: ${id}.`);
  if (!Number.isFinite(value)) throw new Error('El ajuste corporal debe ser un número finito.');
  const applied = Math.max(item.negative.length ? -item.max : 0, Math.min(item.max, value));
  for (const name of item.positive) controller.setMorph(name, Math.max(0, applied));
  for (const name of item.negative) controller.setMorph(name, Math.max(0, -applied));
  return applied;
}

/** A new preset clears manual dimensions while preserving its seven preset weights. */
export function clearManualBodyControls(controller: BodyMorphController): void {
  const presetNames = new Set(BODY_PRESET_MORPHS);
  for (const item of supported(controller)) {
    for (const name of [...item.positive, ...item.negative]) if (!presetNames.has(name)) controller.setMorph(name, 0);
  }
}
