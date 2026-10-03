import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type AnimationEntry = {
  id: string;
  name: string;
  category: string;
  file: string;
  source: string;
  license: string;
  skeleton: string;
  loop: boolean;
};

export class AnimationLibrary {
  private manifest?: Promise<AnimationEntry[]>;
  private readonly clips = new Map<string, Promise<THREE.AnimationClip>>();

  constructor(private readonly base = `${import.meta.env.BASE_URL}animations/`) {}

  async entries(): Promise<AnimationEntry[]> {
    this.manifest ??= fetch(`${this.base}manifest.json`).then(async response => {
      if (!response.ok) throw new Error(`No se pudo leer el catálogo de animaciones (${response.status}).`);
      const data = await response.json() as { skeleton: string; animations: AnimationEntry[] };
      if (data.skeleton !== 'mixamorig' || !Array.isArray(data.animations)) throw new Error('Catálogo de animaciones incompatible.');
      return data.animations;
    }).catch(error => { this.manifest = undefined; throw error; });
    return this.manifest;
  }

  async loadAnimation(id: string): Promise<{ entry: AnimationEntry; clip: THREE.AnimationClip }> {
    const entry = (await this.entries()).find(item => item.id === id);
    if (!entry || entry.skeleton !== 'mixamorig') throw new Error(`Animación incompatible o ausente: ${id}.`);
    if (!/^(walk|run|action|fight|jump|everyday)\/[a-z0-9-]+\.(json|glb)$/.test(entry.file)) {
      throw new Error(`Ruta de animación inválida: ${entry.file}.`);
    }
    let promise = this.clips.get(id);
    if (!promise) {
      const url = `${this.base}${entry.file}`;
      promise = entry.file.endsWith('.json')
        ? fetch(url).then(async response => {
          if (!response.ok) throw new Error(`No se pudo cargar ${entry.file} (${response.status}).`);
          return THREE.AnimationClip.parse(await response.json());
        })
        : new GLTFLoader().loadAsync(url).then(gltf => {
          // Only animation data is retained. The reference character remains the existing GLB.
          gltf.scene.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
              material.dispose();
            }
          });
          if (gltf.animations.length !== 1) throw new Error(`El GLB ${entry.file} debe contener una animación.`);
          return gltf.animations[0]!;
        });
      this.clips.set(id, promise);
      promise.catch(() => this.clips.delete(id));
    }
    return { entry, clip: await promise };
  }
}
