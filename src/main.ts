import './styles.css';
import { filterPoses, shuffledCycle, type Pose } from './catalog/poses';
import { SessionEngine, formatTime, validDuration } from './session/engine';
import { loadPreferences, savePreferences, type Preferences } from './storage/preferences';
import { PoseViewer } from './viewer/viewer';

const app = document.querySelector<HTMLDivElement>('#app')!;
const categories = ['Todas', 'De pie', 'Sentada', 'Agachada', 'En movimiento'];
const cameras = ['Frontal', 'Tres cuartos', 'Lateral', 'Posterior', 'Aleatoria'];
const presets = [30, 60, 90, 120, 300];
let prefs: Preferences = loadPreferences();
let viewer: PoseViewer | undefined;
let engine: SessionEngine | undefined;
let deck: Pose[] = [];
let tickId = 0;
let shownIndex = -1;
let soundCtx: AudioContext | undefined;
let previousState = '';

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
  viewer?.dispose();
  viewer = undefined;
  engine = undefined;
  previousState = '';
  shownIndex = -1;
}

function setup() {
  cleanupPractice();
  app.innerHTML = `<main class="shell setup-shell">
    ${header()}
    <section class="intro"><h2>Configurar práctica</h2></section>
    <section class="setup-card" aria-label="Configurar práctica">
      <div class="field-group"><p class="field-label">TIEMPO POR POSE</p><div class="choice-row" id="duration-options">${presets.map(n => `<button type="button" data-duration="${n}" class="choice ${prefs.duration === n ? 'selected' : ''}">${n === 90 ? '1m 30s' : n < 60 ? `${n}s` : `${n / 60}m`}</button>`).join('')}</div><label class="custom-row" for="custom-duration"><span>Otra duración</span><input id="custom-duration" type="number" min="5" max="1800" value="${presets.includes(prefs.duration) ? '' : prefs.duration}" placeholder="segundos"></label></div>
      <div class="field-group"><p class="field-label">CANTIDAD DE POSES</p><div class="choice-row">${[5, 10, 20].map(n => `<button type="button" data-count="${n}" class="choice ${prefs.count === n ? 'selected' : ''}">${n} <small>poses</small></button>`).join('')}</div></div>
      <div class="field-pair"><div class="field-group"><label class="field-label" for="category">TIPO DE POSE</label><select id="category">${categories.map(c => `<option ${prefs.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div class="field-group"><label class="field-label" for="camera">VISTA INICIAL</label><select id="camera">${cameras.map(c => `<option ${prefs.camera === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
      <div class="summary-line"><span><b id="total"></b> poses · <b id="estimate"></b> aprox.</span><label class="switchline"><input id="sound" type="checkbox" ${prefs.sound ? 'checked' : ''}> Sonido</label></div>
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
  el<HTMLSelectElement>('#category').onchange = event => { prefs.category = (event.target as HTMLSelectElement).value; updateEstimate(); persist(); };
  el<HTMLSelectElement>('#camera').onchange = event => { prefs.camera = (event.target as HTMLSelectElement).value; persist(); };
  el<HTMLInputElement>('#sound').onchange = event => { prefs.sound = (event.target as HTMLInputElement).checked; persist(); };
  el<HTMLButtonElement>('#start').onclick = startSession;
  updateEstimate();
}

function updateEstimate() {
  const available = filterPoses(prefs.category).length;
  const count = available ? prefs.count : 0;
  el('#total').textContent = String(count);
  el('#estimate').textContent = `${Math.ceil(count * prefs.duration / 60)} min`;
  el<HTMLButtonElement>('#start').disabled = !available || !validDuration(prefs.duration * 1000) || !Number.isInteger(prefs.duration);
  el('#setup-error').textContent = available ? (!validDuration(prefs.duration * 1000) || !Number.isInteger(prefs.duration) ? 'Elegí entre 5 y 1800 segundos.' : '') : 'No hay poses en esta categoría.';
}

function startSession() {
  if (!validDuration(prefs.duration * 1000) || !Number.isInteger(prefs.duration)) { updateEstimate(); return; }
  const available = filterPoses(prefs.category);
  if (!available.length) { updateEstimate(); return; }
  deck = [];
  let previous: Pose | undefined;
  while (deck.length < prefs.count) {
    const cycle = shuffledCycle(available, Math.random, previous);
    deck.push(...cycle.slice(0, prefs.count - deck.length));
    previous = deck.at(-1);
  }
  persist();
  practice();
}

function practice() {
  cleanupPractice();
  app.innerHTML = `<main class="practice-shell"><header class="practice-top"><button class="wordmark" id="home-wordmark" aria-label="Volver a configuración">✳ <span>ESTUDIO DE POSES</span></button><div class="top-status"><span class="status-dot"></span><span id="state-label">CUENTA REGRESIVA</span></div><div class="top-actions"><button class="icon-button theme-toggle" aria-label="Cambiar tema">${themeIcon()}</button><button class="icon-button" id="fullscreen" aria-label="Pantalla completa" title="Pantalla completa">⛶</button><button class="text-button" id="exit">Salir ×</button></div></header>
  <section class="work-area"><div class="viewport-wrap"><div class="viewport" id="viewport"><div class="canvas-caption"><span id="view-label">VISTA ${prefs.camera.toUpperCase()}</span></div><p class="loading-error" role="status"></p></div><div class="pose-title"><span class="pose-index" id="pose-index">01 / ${String(deck.length).padStart(2, '0')}</span><h2 id="pose-name"></h2></div><div class="camera-controls"><button data-cam="Frontal" aria-label="Vista frontal" title="Frontal">F</button><button data-cam="Tres cuartos" aria-label="Vista tres cuartos" title="Tres cuartos">¾</button><button data-cam="Lateral" aria-label="Vista lateral" title="Lateral">L</button><button data-cam="Posterior" aria-label="Vista posterior" title="Posterior">P</button><button id="reset-view" aria-label="Restablecer vista" title="Restablecer">⟳</button></div></div>
  <aside class="session-panel"><div class="panel-heading"><span class="session-count" id="session-count"></span></div><div class="timer" id="timer" role="timer">${formatTime(prefs.duration * 1000)}</div><p class="timer-caption">TIEMPO RESTANTE</p><div class="progress-track"><div id="progress" class="progress-fill"></div></div><p class="progress-caption"><span id="progress-label"></span><span id="percent">0%</span></p><div class="divider"></div><div class="control-stack"><button id="pause" class="secondary-button">Ⅱ Pausar <kbd>Espacio</kbd></button><button id="skip" class="secondary-button">↠ Siguiente pose <kbd>→</kbd></button></div></aside></section>
  <div id="overlay" class="overlay hidden"><div class="overlay-card"><span class="overlay-glyph">✳</span><h2 id="overlay-title"></h2><div id="countdown" class="countdown"></div><button id="overlay-action" class="primary-button"></button></div></div></main>`;
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
  engine = new SessionEngine(prefs.duration * 1000, deck.length);
  shownIndex = -1;
  syncPose();
  el<HTMLButtonElement>('#home-wordmark').onclick = setup;
  el<HTMLButtonElement>('#exit').onclick = setup;
  el<HTMLButtonElement>('#fullscreen').onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); };
  el<HTMLButtonElement>('#reset-view').onclick = () => { viewer?.setCamera(prefs.camera === 'Aleatoria' ? 'Frontal' : prefs.camera); el('#view-label').textContent = `VISTA ${prefs.camera === 'Aleatoria' ? 'FRONTAL' : prefs.camera.toUpperCase()}`; };
  app.querySelectorAll<HTMLButtonElement>('[data-cam]').forEach(button => button.onclick = () => { viewer?.setCamera(button.dataset.cam!); el('#view-label').textContent = `VISTA ${button.dataset.cam!.toUpperCase()}`; });
  el<HTMLButtonElement>('#pause').onclick = pauseToggle;
  el<HTMLButtonElement>('#skip').onclick = () => advance(false);
  el<HTMLButtonElement>('#overlay-action').onclick = () => { if (engine?.state === 'paused') { engine.resume(performance.now()); hideOverlay(); updatePauseButton(); renderTick(); } else if (engine?.state === 'finished') summary(); };
  engine.start(performance.now());
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKey);
  tickId = window.setInterval(renderTick, 100);
  renderTick();
}

function syncPose() {
  if (!engine || !viewer || shownIndex === engine.index || engine.index >= deck.length) return;
  shownIndex = engine.index;
  const pose = deck[engine.index]!;
  viewer.apply(pose);
  if (prefs.camera === 'Aleatoria') viewer.randomCamera();
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
  if (engine?.state !== 'running') return;
  engine.advance(performance.now(), completed);
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
  bindTheme(); el<HTMLButtonElement>('#again').onclick = startSession; el<HTMLButtonElement>('#home').onclick = setup;
}
function showOverlay(title: string, button: string) {
  el('#overlay-title').textContent = title;
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
  if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLButtonElement) && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); pauseToggle(); }
  if (event.key === 'ArrowRight' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); advance(false); }
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
setup();
