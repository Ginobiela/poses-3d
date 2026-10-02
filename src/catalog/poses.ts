export type PoseCategory = 'De pie' | 'Sentada' | 'Agachada' | 'En movimiento';
export type Pose = { id: string; name: string; category: PoseCategory; note: string; arms: [number, number]; elbows: [number, number]; legs: [number, number]; knees: [number, number]; lean?: number; crouch?: number; twist?: number; depth?: number };

// Angles are expressive drawing references, not anatomically scanned motion data.
export const poses: Pose[] = [
  { id:'01', name:'Contrapposto', category:'De pie', note:'Peso sobre una pierna, cadera desplazada.', arms:[-18,14], elbows:[10,-8], legs:[-7,9], knees:[5,-4], lean:-3 },
  { id:'02', name:'Alcance alto', category:'De pie', note:'Una mano busca el espacio por encima de la cabeza.', arms:[-22,165], elbows:[-8,18], legs:[-8,10], knees:[4,-3], lean:-8 },
  { id:'03', name:'Manos a la cintura', category:'De pie', note:'Silueta abierta y hombros relajados.', arms:[-92,92], elbows:[60,-60], legs:[-7,8], knees:[3,-3] },
  { id:'04', name:'Giro de torso', category:'De pie', note:'Hombros y caderas apuntan en direcciones distintas.', arms:[-24,26], elbows:[12,-12], legs:[-6,7], knees:[4,-3], twist:34, depth:18 },
  { id:'05', name:'Equilibrio', category:'De pie', note:'Una pierna sostiene el cuerpo; la otra se despega.', arms:[-58,46], elbows:[18,-20], legs:[-4,27], knees:[2,38], lean:4 },
  { id:'06', name:'Paso lateral', category:'En movimiento', note:'El cuerpo se desplaza hacia un lado.', arms:[62,-48], elbows:[-22,20], legs:[-35,29], knees:[22,-12], lean:9 },
  { id:'07', name:'Caminata', category:'En movimiento', note:'Contrapeso natural entre brazos y piernas.', arms:[28,-31], elbows:[-14,15], legs:[-23,25], knees:[18,-16], lean:5 },
  { id:'08', name:'Salto abierto', category:'En movimiento', note:'Extensión completa en el aire.', arms:[-67,69], elbows:[-13,14], legs:[-39,42], knees:[-8,10], lean:-2 },
  { id:'09', name:'Carrera', category:'En movimiento', note:'Inclinación hacia delante y brazos en oposición.', arms:[-35,41], elbows:[22,-26], legs:[34,-40], knees:[-22,27], lean:20 },
  { id:'10', name:'Caída controlada', category:'En movimiento', note:'El torso se inclina mientras los brazos equilibran.', arms:[70,-70], elbows:[-22,24], legs:[-27,20], knees:[24,-18], lean:-20 },
  { id:'11', name:'Sentada erguida', category:'Sentada', note:'Rodillas a la altura de la cadera, espalda vertical.', arms:[-18,18], elbows:[22,-22], legs:[70,-70], knees:[-72,72], crouch:.47 },
  { id:'12', name:'Sentada informal', category:'Sentada', note:'Una pierna cae y la otra se cruza.', arms:[-12,40], elbows:[12,-28], legs:[65,-45], knees:[-88,55], crouch:.46, twist:10 },
  { id:'13', name:'Sentada al borde', category:'Sentada', note:'Inclinación sutil hacia delante.', arms:[-30,30], elbows:[-18,18], legs:[45,-50], knees:[-35,42], crouch:.5, lean:12 },
  { id:'14', name:'Piernas cruzadas', category:'Sentada', note:'Una línea diagonal cruza la base de la pose.', arms:[-18,18], elbows:[10,-10], legs:[72,-55], knees:[-90,12], crouch:.46 },
  { id:'15', name:'En cuclillas', category:'Agachada', note:'Centro de gravedad bajo y brazos al frente.', arms:[-35,35], elbows:[-10,10], legs:[-52,52], knees:[100,-100], crouch:.62, lean:9 },
  { id:'16', name:'A una rodilla', category:'Agachada', note:'Una pierna doblada sostiene la figura.', arms:[-22,28], elbows:[12,-12], legs:[-18,74], knees:[12,-102], crouch:.25, lean:8 },
  { id:'17', name:'Inclinarse', category:'Agachada', note:'Bisagra en la cadera con brazos sueltos.', arms:[-18,24], elbows:[5,-8], legs:[-8,12], knees:[5,-6], lean:43 },
  { id:'18', name:'Tocar el suelo', category:'Agachada', note:'Un brazo continúa la línea del torso.', arms:[-24,118], elbows:[18,26], legs:[-24,30], knees:[48,-40], crouch:.28, lean:28 },
  { id:'19', name:'Extensión diagonal', category:'En movimiento', note:'Una línea larga organiza todo el gesto.', arms:[-125,65], elbows:[-18,20], legs:[-35,50], knees:[-12,14], lean:-10, twist:18 },
  { id:'20', name:'Contracción', category:'Agachada', note:'La silueta se recoge sobre sí misma.', arms:[-85,83], elbows:[90,-90], legs:[-48,49], knees:[76,-78], crouch:.52, lean:18 }
];

export function filterPoses(category: string) { return category === 'Todas' ? poses : poses.filter(p => p.category === category); }
export function shuffledCycle<T>(items: T[], random = Math.random, last?: T): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  if (out.length > 1 && last !== undefined && out[0] === last) [out[0], out[1]] = [out[1]!, out[0]!];
  return out;
}
