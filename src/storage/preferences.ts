export type Preferences = { theme: 'light' | 'dark'; sound: boolean; duration: number; count: number; category: string; camera: string };
const defaults: Preferences = { theme: 'light', sound: false, duration: 60, count: 3, category: 'Todas', camera: 'Frontal' };
export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem('poses.preferences.v1');
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      sound: parsed.sound === true,
      duration: Number.isInteger(parsed.duration) && parsed.duration! >= 5 && parsed.duration! <= 1800 ? parsed.duration! : defaults.duration,
      count: Number.isInteger(parsed.count) && parsed.count! >= 1 && parsed.count! <= 100 ? parsed.count! : defaults.count,
      category: ['Todas', 'De pie', 'Sentada', 'Agachada', 'En movimiento', 'Standing', 'Sitting', 'Action', 'Run', 'Fight', 'Dynamic', 'Custom'].includes(parsed.category ?? '') ? parsed.category! : defaults.category,
      camera: ['Frontal', 'Tres cuartos', 'Lateral', 'Posterior', 'Aleatoria'].includes(parsed.camera ?? '') ? parsed.camera! : defaults.camera,
    };
  } catch { return { ...defaults }; }
}
export function savePreferences(p: Preferences) { try { localStorage.setItem('poses.preferences.v1', JSON.stringify(p)); } catch { /* private browsing may disable storage */ } }
