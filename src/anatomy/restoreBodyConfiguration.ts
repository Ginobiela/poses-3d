import type { BodyMorphController } from './BodyMorphController';
import { applyBodyPreset } from './bodyPresets';
import { clearManualBodyControls, getBodyControlStates, setBodyControl } from './bodyControls';
import { validateBodyConfiguration, type BodyConfiguration } from '../storage/bodyConfiguration';

export function restoreBodyConfiguration(controller: BodyMorphController, configuration: BodyConfiguration): void {
  const validated = validateBodyConfiguration(configuration);
  const supported = new Set(getBodyControlStates(controller).map(item => item.id));
  for (const id of Object.keys(validated.manual)) {
    if (!supported.has(id)) throw new Error(`El modelo no admite el ajuste guardado: ${id}.`);
  }
  applyBodyPreset(controller, validated.preset);
  clearManualBodyControls(controller);
  for (const [id, value] of Object.entries(validated.manual)) setBodyControl(controller, id, value);
}
