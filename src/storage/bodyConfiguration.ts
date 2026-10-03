import { BODY_PRESETS, type BodyPresetId } from '../anatomy/bodyPresets';
import { BODY_CONTROLS } from '../anatomy/bodyControls';

export const BODY_CONFIGURATION_KEY = 'poses.body.v1';
export type BodyConfiguration = { version: 1; preset: BodyPresetId; manual: Record<string, number> };
export const neutralBodyConfiguration = (): BodyConfiguration => ({ version: 1, preset: 'neutral', manual: {} });

/** Validate persisted overrides against the same limits used by the sliders. */
export function validateBodyConfiguration(value: unknown): BodyConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuración corporal inválida.');
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || typeof data.preset !== 'string' || !Object.hasOwn(BODY_PRESETS, data.preset)
    || !data.manual || typeof data.manual !== 'object' || Array.isArray(data.manual)) {
    throw new Error('Versión o preset corporal inválido.');
  }
  const manual: Record<string, number> = {};
  for (const [id, value] of Object.entries(data.manual)) {
    const control = BODY_CONTROLS.find(item => item.id === id);
    if (!control || typeof value !== 'number' || !Number.isFinite(value)
      || value < (control.negative.length ? -control.max : 0) || value > control.max) {
      throw new Error(`Ajuste corporal guardado inválido: ${id}.`);
    }
    manual[id] = value;
  }
  return { version: 1, preset: data.preset as BodyPresetId, manual };
}

export function loadBodyConfiguration(): BodyConfiguration {
  try {
    const saved = localStorage.getItem(BODY_CONFIGURATION_KEY);
    return saved === null ? neutralBodyConfiguration() : validateBodyConfiguration(JSON.parse(saved));
  } catch { return neutralBodyConfiguration(); }
}

/** A denied/quota-limited storage must not prevent editing the current character. */
export function saveBodyConfiguration(configuration: BodyConfiguration): boolean {
  const validated = validateBodyConfiguration(configuration);
  try { localStorage.setItem(BODY_CONFIGURATION_KEY, JSON.stringify(validated)); return true; }
  catch { return false; }
}
