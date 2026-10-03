import './styles.css';
import { filterPoses, loadPoseCatalog, shuffledCycle, type Pose } from './catalog/poses';
import { SessionEngine, formatTime, validDuration } from './session/engine';
import { loadPreferences, savePreferences, type Preferences } from './storage/preferences';
import { PoseViewer } from './viewer/viewer';
import { EDITABLE_JOINTS } from './editor/PoseEditor';
import { installReferenceTools } from './referenceTools';
import { loadCustomPoses } from './storage/customPoses';
import { expandPlan, gesturePlan } from './session/plans';

const app = document.querySelector<HTMLDivElement>('#app')!;
const categories = ['Todas', 'De pie', 'Sentada', 'Agachada', 'En movimiento', 'Standing', 'Sitting', 'Action', 'Run', 'Fight', 'Dynamic', 'Custom'];
const countPresets = [1, 2, 3, 5, 10, 20];
const cameras = ['Frontal', 'Tres cuartos', 'Lateral', 'Posterior', 'Aleatoria'];
const presets = [30, 60, 90, 120, 300, 600];
let prefs: Preferences = loadPreferences();
let viewer: PoseViewer | undefined;
let engine: SessionEngine | undefined;
let deck: Pose[] = [];
let tickId = 0;
let shownIndex = -1;
let soundCtx: AudioContext | undefined;
let previousState = '';
let catalogError = '';
let editMode = false;
let disposeReference: (() => void) | undefined;
let schedule: number[] | undefined;
let randomOrder = true;
let randomAngle = false;
let includeCustom = false;
function availablePoses(): Pose[] {
  const custom: Pose[] = loadCustomPoses().map(pose => ({ id: pose.id, name: pose.name, category: 'Custom', data: pose }));
  if (prefs.category === 'Custom') return custom;
  return [...filterPoses(prefs.category), ...(includeCustom ? custom : [])];
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = app.querySelector<T>(selector);
  if (!found) throw new Error(`Falta un control: ${selector}`);
  return found;
}

function persist() { savePreferences(prefs); }
function themeIcon() { return prefs.theme === 'dark' ? '☼' : '☾'; }
function header() {
  return `<header class="brand"><div class="brand-mark">✳</div><h1>Estudio de poses</h1><button class="icon-button theme-toggle" aria-label="Cambiar tema">${themeIcon()}</button></header>`;
}
function bindTheme() { el<HTMLButtonElement>('.theme-toggle').onclick = toggleTheme; }
function toggleTheme() {
  prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = prefs.theme;
  el<HTMLButtonElement>('.theme-toggle').textContent = themeIcon();
  viewer?.setTheme(prefs.theme === 'dark');
  persist();
}

function cleanupPractice() {
  window.clearInterval(tickId);
  tickId = 0;
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('keydown', onKey);
  disposeReference?.(); disposeReference = undefined;
  viewer?.dispose();
  viewer = undefined;
  engine = undefined;
  previousState = '';
  shownIndex = -1;
  editMode = false;
}

function setup() {
  cleanupPractice();
  const availableCategories = categories.filter(category => category === 'Todas' || category === 'Custom' || filterPoses(category).length > 0);
  if (!availableCategories.includes(prefs.category)) prefs.category = 'Todas';

  app.innerHTML = `<main class="shell setup-shell">
    ${header()}
    <section class="intro"><h2>Configurar práctica</h2></section>
    <section class="setup-card" aria-label="Configurar práctica">
      <div class="field-group"><p class="field-label">TIEMPO POR POSE</p><div class="choice-row" id="duration-options">${presets.map(n => `<button type="button" data-duration="${n}" class="choice ${prefs.duration === n ? 'selected' : ''}">${n === 90 ? '1m 30s' : n < 60 ? `${n}s` : `${n / 60}m`}</button>`).join('')}</div><label class="custom-row" for="custom-duration"><span>Otra duración</span><input id="custom-duration" type="number" min="5" max="1800" value="${presets.includes(prefs.duration) ? '' : prefs.duration}" placeholder="segundos"></label></div>
      <div class="field-group"><p class="field-label">CANTIDAD DE POSES</p><div class="choice-row">${countPresets.map(n => `<button type="button" data-count="${n}" class="choice ${prefs.count === n ? 'selected' : ''}">${n} <small>${n === 1 ? 'pose' : 'poses'}</small></button>`).join('')}</div></div>
      <div class="field-pair"><div class="field-group"><label class="field-label" for="category">TIPO DE POSE</label><select id="category">${availableCategories.map(c => `<option ${prefs.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div class="field-group"><label class="field-label" for="camera">VISTA INICIAL</label><select id="camera">${cameras.map(c => `<option ${prefs.camera === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
      <label class="custom-row">Otra cantidad<input id="custom-count" type="number" min="1" max="100" value="${countPresets.includes(prefs.count) ? '' : prefs.count}"></label><div class="session-options"><label><input id="random-order" type="checkbox" ${randomOrder ? 'checked' : ''}> Orden aleatorio</label><label><input id="random-angle" type="checkbox" ${randomAngle ? 'checked' : ''}> Cambiar también ángulo de cámara</label><label><input id="include-custom" type="checkbox" ${includeCustom ? 'checked' : ''}> Incluir mis poses</label><label>Sesión<select id="session-plan"><option value="regular">Sesión de dibujo</option><option value="gesture">Gesture Drawing (20 poses · 26 min)</option></select></label></div><div class="summary-line"><span><b id="total"></b> poses · <b id="estimate"></b> aprox.</span><label class="switchline"><input id="sound" type="checkbox" ${prefs.sound ? 'checked' : ''}> Sonido</label></div>
      <button id="start" class="primary-button">Empezar a dibujar <span>↗</span></button><p id="setup-error" class="error" role="alert"></p>
    </section>
  </main>`;
  bindTheme();
  app.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach(button => button.onclick = () => {
    prefs.duration = Number(button.dataset.duration);
    el<HTMLInputElement>('#custom-duration').value = '';
    app.querySelectorAll('[data-duration]').forEach(item => item.classList.toggle('selected', item === button));
    updateEstimate(); persist();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(button => button.onclick = () => {
    prefs.count = Number(button.dataset.count);
    app.querySelectorAll('[data-count]').forEach(item => item.classList.toggle('selected', item === button));
    updateEstimate(); persist();
  });
  el<HTMLInputElement>('#custom-duration').oninput = event => {
    const raw = (event.target as HTMLInputElement).value;
    if (raw !== '') prefs.duration = Number(raw);
    app.querySelectorAll('[data-duration]').forEach(item => item.classList.remove('selected'));
    updateEstimate(); persist();
  };
  el<HTMLSelectElement>('#category').onchange = event => { prefs.category = (event.target as HTMLSelectElement).value; persist(); setup(); };
  el<HTMLSelectElement>('#camera').onchange = event => { prefs.camera = (event.target as HTMLSelectElement).value; persist(); };
  el<HTMLInputElement>('#sound').onchange = event => { prefs.sound = (event.target as HTMLInputElement).checked; persist(); };
  el<HTMLButtonElement>('#start').onclick = startSession;
  el<HTMLInputElement>('#custom-count').oninput = event => { prefs.count = Number((event.target as HTMLInputElement).value); updateEstimate(); persist(); };
  el<HTMLInputElement>('#random-order').onchange = event => { randomOrder = (event.target as HTMLInputElement).checked; };
  el<HTMLInputElement>('#random-angle').onchange = event => { randomAngle = (event.target as HTMLInputElement).checked; };
  el<HTMLInputElement>('#include-custom').onchange = event => { includeCustom = (event.target as HTMLInputElement).checked; updateEstimate(); };
  el<HTMLSelectElement>('#session-plan').onchange = () => updateEstimate();
  updateEstimate();
}

function updateEstimate() {
  const available = availablePoses().length;
  const gesture = el<HTMLSelectElement>('#session-plan').value === 'gesture';
  const count = gesture ? 20 : prefs.count;
  el('#total').textContent = String(count);
  el('#estimate').textContent = `${gesture ? 26 : Math.ceil(count * prefs.duration / 60)} min`;
  el<HTMLButtonElement>('#start').disabled = !available || !Number.isInteger(prefs.count) || prefs.count < 1 || prefs.count > 100 || !validDuration(prefs.duration * 1000) || !Number.isInteger(prefs.duration);
  el('#setup-error').textContent = available ? (!validDuration(prefs.duration * 1000) || !Number.isInteger(prefs.duration) ? 'Elegí entre 5 y 1800 segundos.' : '') : (catalogError || 'No hay poses en esta categoría.');
}

function startSession() {
  if (!validDuration(prefs.duration * 1000) || !Number.isInteger(prefs.duration)) { updateEstimate(); return; }
  const available = availablePoses();
  if (!available.length || !Number.isInteger(prefs.count) || prefs.count < 1 || prefs.count > 100) { updateEstimate(); return; }
  schedule = el<HTMLSelectElement>('#session-plan').value === 'gesture' ? expandPlan(gesturePlan) : undefined;
  const count = schedule?.length ?? prefs.count;
  deck = [];
  while (deck.length < count) deck.push(...(randomOrder ? shuffledCycle(available, Math.random, deck.at(-1)) : available));
  deck = deck.slice(0, count);
  persist();
  practice();
}

function practice() {
  cleanupPractice();
  app.innerHTML = `<main class="practice-shell"><header class="practice-top"><button class="wordmark" id="home-wordmark" aria-label="Volver a configuración">✳ <span>ESTUDIO DE POSES</span></button><div class="top-status"><span class="status-dot"></span><span id="state-label">CUENTA REGRESIVA</span></div><div class="top-actions"><button class="icon-button theme-toggle" aria-label="Cambiar tema">${themeIcon()}</button><button class="icon-button" id="fullscreen" aria-label="Pantalla completa" title="Pantalla completa">⛶</button><button class="text-button" id="exit">Salir ×</button></div></header>
  <section class="work-area"><div class="viewport-wrap"><div class="viewport" id="viewport"><div class="canvas-caption"><span id="view-label">VISTA ${prefs.camera.toUpperCase()}</span></div><p class="loading-error" role="status"></p></div><div class="pose-title"><span class="pose-index" id="pose-index">01 / ${String(deck.length).padStart(2, '0')}</span><h2 id="pose-name"></h2></div><div class="camera-controls"><button data-cam="Frontal" aria-label="Vista frontal" title="Frontal">F</button><button data-cam="Tres cuartos" aria-label="Vista tres cuartos" title="Tres cuartos">¾</button><button data-cam="Lateral" aria-label="Vista lateral" title="Lateral">L</button><button data-cam="Posterior" aria-label="Vista posterior" title="Posterior">P</button><button id="reset-view" aria-label="Restablecer vista" title="Restablecer">⟳</button></div></div>
  <aside class="session-panel"><div class="panel-heading"><span class="session-count" id="session-count"></span></div><div class="timer" id="timer" role="timer">${formatTime(prefs.duration * 1000)}</div><p class="timer-caption">TIEMPO RESTANTE</p><div class="progress-track"><div id="progress" class="progress-fill"></div></div><p class="progress-caption"><span id="progress-label"></span><span id="percent">0%</span></p><div class="divider"></div><div class="control-stack"><button id="pause" class="secondary-button">Ⅱ Pausar <kbd>Espacio</kbd></button><button id="skip" class="secondary-button">↠ Siguiente pose <kbd>→</kbd></button></div><button id="previous-pose" class="secondary-button">Anterior</button><button id="finish-session" class="secondary-button">Finalizar sesión</button><section class="pose-editor"><button id="editor-toggle" class="secondary-button" aria-pressed="false">Editar pose</button><div id="editor-tools" hidden><label class="field-label" for="joint-select">ARTICULACIÓN</label><select id="joint-select">${EDITABLE_JOINTS.map(([name, label]) => `<option value="${name}">${label}</option>`).join('')}</select><div class="joint-turn"><select id="turn-axis" aria-label="Eje de giro"><option value="x">Eje X</option><option value="y">Eje Y</option><option value="z">Eje Z</option></select><button id="turn-minus" class="editor-button">−5°</button><button id="turn-plus" class="editor-button">+5°</button></div><button id="hips-translate" class="editor-button" aria-pressed="false">Mover pelvis (X/Z)</button><div class="editor-actions"><button id="reset-joint" class="editor-button">Restablecer articulación</button><button id="reset-pose" class="editor-button">Restablecer pose completa</button><button id="undo-edit" class="editor-button" disabled>Deshacer</button><button id="redo-edit" class="editor-button" disabled>Rehacer</button></div><label class="field-label" for="export-name">NOMBRE DE LA POSE</label><input id="export-name" type="text" maxlength="80" value="mi-pose"><button id="duplicate-variant" class="editor-button">Duplicar como variante</button><button id="export-pose" class="secondary-button">Exportar pose</button><p id="editor-status" role="status"></p></div></section></aside></section>
  <div id="overlay" class="overlay hidden"><div class="overlay-card"><span class="overlay-glyph">✳</span><h2 id="overlay-title"></h2><p id="overlay-detail"></p><div id="countdown" class="countdown"></div><button id="overlay-action" class="primary-button"></button></div></div></main>`;
  bindTheme();
  try {
    viewer = new PoseViewer(el('#viewport'));
    viewer.setTheme(prefs.theme === 'dark');
  } catch {
    el('.loading-error').textContent = 'No se pudo iniciar el visor 3D. Revisá si tu navegador admite WebGL.';
    el<HTMLButtonElement>('#pause').disabled = true;
    el<HTMLButtonElement>('#skip').disabled = true;
    el<HTMLButtonElement>('#exit').onclick = setup;
    return;
  }
  const currentViewer = viewer;
  engine = new SessionEngine(prefs.duration * 1000, deck.length, schedule);
  shownIndex = -1;
  el<HTMLButtonElement>('#home-wordmark').onclick = setup;
  el<HTMLButtonElement>('#exit').onclick = setup;
  el<HTMLButtonElement>('#fullscreen').onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); };
  el<HTMLButtonElement>('#reset-view').onclick = () => { viewer?.setCamera(prefs.camera === 'Aleatoria' ? 'Frontal' : prefs.camera); el('#view-label').textContent = `VISTA ${prefs.camera === 'Aleatoria' ? 'FRONTAL' : prefs.camera.toUpperCase()}`; };
  app.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach(button => button.onclick = () => { viewer?.setCamera(button.dataset.cam!); el('#view-label').textContent = `VISTA ${button.dataset.cam!.toUpperCase()}`; });
  el<HTMLButtonElement>('#pause').onclick = pauseToggle;
  el<HTMLButtonElement>('#skip').onclick = () => advance(false);
  el<HTMLButtonElement>('#previous-pose').onclick = () => { engine?.previous(performance.now()); renderTick(); };
  el<HTMLButtonElement>('#finish-session').onclick = () => { engine?.finish(performance.now()); finish(); };
  const viewport = el('#viewport');
  viewport.addEventListener('poseedit', updateEditorControls);
  el<HTMLButtonElement>('#editor-toggle').onclick = () => {
    if (!viewer) return;
    editMode = el<HTMLButtonElement>('#editor-toggle').getAttribute('aria-pressed') !== 'true';
    viewer.setEditMode(editMode);
    el<HTMLButtonElement>('#editor-toggle').setAttribute('aria-pressed', String(editMode));
    el<HTMLElement>('#editor-tools').hidden = !editMode;
    updateEditorControls();
  };
  el<HTMLSelectElement>('#joint-select').onchange = event => {
    viewer?.selectJoint((event.target as HTMLSelectElement).value);
    viewer?.setHipsTranslation(false);
    el<HTMLButtonElement>('#hips-translate').setAttribute('aria-pressed', 'false');
  };
  el<HTMLButtonElement>('#hips-translate').onclick = () => {
    const button = el<HTMLButtonElement>('#hips-translate');
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    viewer?.setHipsTranslation(enabled);
    button.setAttribute('aria-pressed', String(enabled));
  };
  el<HTMLButtonElement>('#reset-joint').onclick = () => viewer?.resetJoint();
  const turn = (degrees: number) => viewer?.rotateJoint(el<HTMLSelectElement>('#turn-axis').value as 'x' | 'y' | 'z', degrees);
  el<HTMLButtonElement>('#turn-minus').onclick = () => turn(-5);
  el<HTMLButtonElement>('#turn-plus').onclick = () => turn(5);
  el<HTMLButtonElement>('#reset-pose').onclick = () => viewer?.resetPose();
  el<HTMLButtonElement>('#undo-edit').onclick = () => viewer?.undo();
  el<HTMLButtonElement>('#redo-edit').onclick = () => viewer?.redo();
  el<HTMLButtonElement>('#duplicate-variant').onclick = () => {
    const name = el('#pose-name').textContent?.trim() || 'Pose';
    el<HTMLInputElement>('#export-name').value = `${name} variante`;
    el('#editor-status').textContent = 'Variante local lista para editar y exportar.';
  };
  el<HTMLButtonElement>('#export-pose').onclick = () => {
    if (!viewer) return;
    const pose = viewer.exportCurrentPose(el<HTMLInputElement>('#export-name').value);
    const blob = new Blob([JSON.stringify(pose, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mi-pose.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    el('#editor-status').textContent = 'Pose exportada.';
  };
  el<HTMLButtonElement>('#overlay-action').onclick = () => { if (engine?.state === 'paused') { engine.resume(performance.now()); hideOverlay(); updatePauseButton(); renderTick(); } else if (engine?.state === 'finished') summary(); };
  el<HTMLButtonElement>('#pause').disabled = true;
  el<HTMLButtonElement>('#skip').disabled = true;
  el<HTMLButtonElement>('#editor-toggle').disabled = true;
  el<HTMLButtonElement>('#previous-pose').disabled = true;
  el<HTMLButtonElement>('#finish-session').disabled = true;
  showOverlay('Cargando modelo', '');
  void currentViewer.prepare(deck).then(() => {
    if (viewer !== currentViewer || !engine) return;
    disposeReference = installReferenceTools(currentViewer, () => { engine?.pause(performance.now()); hideOverlay(); updatePauseButton(); });
    engine.start(performance.now());
    syncPose();
    el<HTMLButtonElement>('#pause').disabled = false;
    el<HTMLButtonElement>('#skip').disabled = false;
    el<HTMLButtonElement>('#editor-toggle').disabled = false;
    el<HTMLButtonElement>('#previous-pose').disabled = false;
    el<HTMLButtonElement>('#finish-session').disabled = false;
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('keydown', onKey);
    tickId = window.setInterval(renderTick, 100);
    renderTick();
  }).catch(error => {
    if (viewer !== currentViewer) return;
    const message = error instanceof Error ? error.message : String(error);
    el('#state-label').textContent = 'ERROR DE CARGA';
    showOverlay('No se pudo cargar el modelo', 'Volver a configuración');
    el('#overlay-detail').textContent = message;
    el<HTMLButtonElement>('#overlay-action').onclick = setup;
  });
}

function syncPose() {
  if (!engine || !viewer || shownIndex === engine.index || engine.index >= deck.length) return;
  shownIndex = engine.index;
  const pose = deck[engine.index]!;
  viewer.apply(pose);
  el<HTMLInputElement>('#export-name').value = pose.name;
  el('#editor-status').textContent = '';
  el<HTMLButtonElement>('#hips-translate').setAttribute('aria-pressed', 'false');
  viewer.setHipsTranslation(false);
  updateEditorControls();
  if (prefs.camera === 'Aleatoria' || randomAngle) viewer.randomCamera();
  else viewer.setCamera(prefs.camera);
  el('#view-label').textContent = `VISTA ${prefs.camera.toUpperCase()}`;
  el('#pose-index').textContent = `${String(engine.index + 1).padStart(2, '0')} / ${String(deck.length).padStart(2, '0')}`;
  el('#session-count').innerHTML = `${String(engine.index + 1).padStart(2, '0')} <i>/ ${String(deck.length).padStart(2, '0')}</i>`;
  el('#pose-name').textContent = pose.name;
  if (prefs.sound && engine.index > 0) beep();
}

function renderTick() {
  if (!engine || !viewer || !el('#timer')) return;
  engine.tick(performance.now());
  if (engine.state === 'finished') { finish(); return; }
  syncPose();
  el('#timer').textContent = formatTime(engine.remainingMs);
  const progress = (engine.index + (engine.phase === 'running' ? (engine.durationMs - engine.remainingMs) / engine.durationMs : 0)) / deck.length * 100;
  el<HTMLElement>('#progress').style.width = `${Math.min(100, progress)}%`;
  el('#percent').textContent = `${Math.floor(progress)}%`;
  el('#progress-label').textContent = `POSE ${engine.index + 1} DE ${deck.length}`;
  if (engine.state === 'countdown') {
    const n = Math.ceil(engine.countdownRemaining / 1000);
    el('#state-label').textContent = 'CUENTA REGRESIVA';
    showOverlay('La sesión empieza en', '');
    el('#countdown').textContent = String(n);
    el<HTMLButtonElement>('#overlay-action').hidden = true;
  } else if (engine.state === 'running') {
    el('#state-label').textContent = 'EN CURSO';
    if (previousState === 'countdown') hideOverlay();
  }
  previousState = engine.state;
}

function updatePauseButton() { if (engine) el<HTMLButtonElement>('#pause').innerHTML = engine.state === 'paused' ? '▶ Continuar <kbd>Espacio</kbd>' : 'Ⅱ Pausar <kbd>Espacio</kbd>'; }
function pauseToggle() {
  if (!engine || engine.state === 'finished') return;
  if (engine.state === 'paused') {
    engine.resume(performance.now());
    hideOverlay();
  } else if (engine.state === 'running' || engine.state === 'countdown') {
    engine.pause(performance.now());
    showOverlay('Sesión en pausa', 'Continuar');
  }
  updatePauseButton();
  renderTick();
}
function advance(completed: boolean) {
  if (!engine || (engine.state !== 'running' && engine.state !== 'paused')) return;
  const paused = engine.state === 'paused';
  if (paused) engine.resume(performance.now());
  engine.advance(performance.now(), completed);
  if (paused && engine.index < engine.count) engine.pause(performance.now());
  if (engine.index >= engine.count) finish();
  else renderTick();
}
function finish() {
  if (!engine || engine.state !== 'finished' || !tickId) return;
  window.clearInterval(tickId); tickId = 0;
  document.removeEventListener('visibilitychange', onVisibility);
  document.removeEventListener('keydown', onKey);
  el('#timer').textContent = formatTime(engine.elapsedMs);
  el<HTMLElement>('#progress').style.width = '100%';
  el('#percent').textContent = '100%';
  showOverlay('Sesión completa', 'Ver resumen');
}
function summary() {
  if (!engine) return;
  const result = { completed: engine.completed, skipped: engine.skipped, elapsedMs: engine.elapsedMs };
  cleanupPractice();
  app.innerHTML = `<main class="summary-shell">${header()}<section class="summary-card"><h2>Resumen de sesión</h2><div class="stats-grid"><div><strong>${result.completed}</strong><span>POSES COMPLETADAS</span></div><div><strong>${result.skipped}</strong><span>POSES OMITIDAS</span></div><div><strong>${formatTime(result.elapsedMs)}</strong><span>TIEMPO DE SESIÓN</span></div></div><button class="primary-button" id="again">Otra sesión <span>↗</span></button><button class="quiet-button" id="home">Volver a configuración</button></section></main>`;
  bindTheme(); el<HTMLButtonElement>('#again').onclick = practice; el<HTMLButtonElement>('#home').onclick = setup;
}
function showOverlay(title: string, button: string) {
  el('#overlay-title').textContent = title;
  el('#overlay-detail').textContent = '';
  el<HTMLButtonElement>('#overlay-action').textContent = button;
  el<HTMLButtonElement>('#overlay-action').hidden = !button;
  el('#countdown').textContent = '';
  el('#overlay').classList.remove('hidden');
}
function hideOverlay() { el('#overlay').classList.add('hidden'); }
function onVisibility() {
  if (document.hidden && (engine?.state === 'running' || engine?.state === 'countdown')) {
    engine.pause(performance.now());
    showOverlay('Sesión pausada al cambiar de pestaña', 'Continuar');
    updatePauseButton();
  }
}
function onKey(event: KeyboardEvent) {
  if (editMode && (event.ctrlKey || event.metaKey) && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
    const key = event.key.toLowerCase();
    if (key === 'z' || key === 'y') {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) viewer?.redo(); else viewer?.undo();
      return;
    }
  }
  if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLButtonElement) && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); pauseToggle(); }
  if (event.key === 'ArrowRight' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); advance(false); }
}
function updateEditorControls() {
  if (!viewer || !app.querySelector('#joint-select')) return;
  const state = viewer.getEditState();
  el<HTMLSelectElement>('#joint-select').value = state.selected;
  el<HTMLButtonElement>('#undo-edit').disabled = !state.canUndo;
  el<HTMLButtonElement>('#redo-edit').disabled = !state.canRedo;
}
function beep() {
  try {
    soundCtx ??= new AudioContext();
    if (soundCtx.state === 'suspended') void soundCtx.resume();
    const oscillator = soundCtx.createOscillator(), gain = soundCtx.createGain();
    oscillator.frequency.value = 660; gain.gain.value = 0.035;
    oscillator.connect(gain); gain.connect(soundCtx.destination);
    oscillator.start(); oscillator.stop(soundCtx.currentTime + 0.12);
  } catch { /* El sonido es opcional. */ }
}

document.documentElement.dataset.theme = prefs.theme;
void loadPoseCatalog().catch(error => { catalogError = error instanceof Error ? error.message : String(error); console.warn('No se pudo cargar el catálogo de poses:', error); }).finally(setup);
