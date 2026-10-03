import * as THREE from 'three';

export const CAMERA_PRESETS = ['Frente', 'Perfil izquierdo', 'Perfil derecho', '3/4 izquierdo', '3/4 derecho', 'Espalda', 'Picado', 'Contrapicado'];
export function cameraPosition(name: string) {
  const positions: Record<string, number[]> = {
    Frente: [0, 2.05, 4.9], 'Perfil izquierdo': [-4.9, 2.05, 0], 'Perfil derecho': [4.9, 2.05, 0],
    '3/4 izquierdo': [-3.5, 2.05, 3.5], '3/4 derecho': [3.5, 2.05, 3.5], Espalda: [0, 2.05, -4.9],
    Picado: [0, 5.6, 2.5], Contrapicado: [0, .1, 4.9],
  };
  const aliases: Record<string, string> = { Frontal: 'Frente', Lateral: 'Perfil derecho', 'Tres cuartos': '3/4 derecho', Posterior: 'Espalda' };
  return new THREE.Vector3().fromArray(positions[aliases[name] ?? name] ?? positions.Frente!);
}
export function focalFov(mm: number) {
  if (![24, 35, 50, 85].includes(mm)) throw new Error('Focal no admitida.');
  return THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * mm)));
}
export type MaterialMode = 'Normal' | 'Gris' | 'Silueta' | 'Wireframe';
export class ReferenceMaterials {
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private materials = {
    Gris: new THREE.MeshStandardMaterial({ color: '#a9a9a9', roughness: .85 }),
    Silueta: new THREE.MeshBasicMaterial({ color: '#151515' }),
    Wireframe: new THREE.MeshBasicMaterial({ color: '#353535', wireframe: true }),
  };
  constructor(meshes: THREE.Mesh[]) { meshes.forEach(mesh => this.originals.set(mesh, mesh.material)); }
  set(mode: MaterialMode) { for (const [mesh, original] of this.originals) mesh.material = mode === 'Normal' ? original : this.materials[mode]; }
  dispose() { this.set('Normal'); Object.values(this.materials).forEach(material => material.dispose()); this.originals.clear(); }
}
