import * as THREE from 'three';

export type PropType = 'chair' | 'bench' | 'box' | 'platform';
export type PropDefinition = {
  type: PropType;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
};

const TYPES = new Set<PropType>(['chair', 'bench', 'box', 'platform']);

function vector(values: unknown, fallback: [number, number, number], label: string): [number, number, number] {
  if (values === undefined) return fallback;
  if (!Array.isArray(values) || values.length !== 3 || values.some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10)) {
    throw new Error(`Vector inválido en prop: ${label}.`);
  }
  return values as [number, number, number];
}

export function validateProps(value: unknown): PropDefinition[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) throw new Error('Lista de props inválida.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || !TYPES.has((item as PropDefinition).type)) throw new Error('Tipo de prop desconocido.');
    const prop = item as PropDefinition;
    const position = vector(prop.position, [0, 0, 0], 'position');
    const rotation = vector(prop.rotation, [0, 0, 0], 'rotation');
    const scale = vector(prop.scale, [1, 1, 1], 'scale');
    if (scale.some(value => value <= 0)) throw new Error('La escala de un prop debe ser positiva.');
    return { type: prop.type, position, rotation, scale };
  });
}

function piece(group: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

export function createProp(definition: PropDefinition): THREE.Group {
  const prop = validateProps([definition])[0]!;
  const group = new THREE.Group();
  group.name = `prop:${prop.type}`;
  const material = new THREE.MeshStandardMaterial({ color: '#b6a18b', roughness: .88, metalness: 0 });
  if (prop.type === 'chair' || prop.type === 'bench') {
    const bench = prop.type === 'bench';
    const width = bench ? 1.15 : .64;
    const depth = bench ? .46 : .58;
    const seat = bench ? .51 : .56;
    piece(group, [width, .09, depth], [0, seat - .045, 0], material);
    const x = width / 2 - .07;
    const z = depth / 2 - .07;
    for (const sideX of [-x, x]) for (const sideZ of [-z, z]) {
      piece(group, [.09, seat - .08, .09], [sideX, (seat - .08) / 2, sideZ], material);
    }
    if (!bench) {
      piece(group, [width, .08, .08], [0, 1.12, -depth / 2 + .025], material);
      for (const sideX of [-x, x]) piece(group, [.08, .61, .08], [sideX, .84, -depth / 2 + .025], material);
    }
  } else if (prop.type === 'box') {
    piece(group, [.6, .6, .6], [0, .3, 0], material);
  } else {
    piece(group, [1.5, .08, 1.1], [0, .04, 0], material);
  }
  group.position.set(...prop.position!);
  group.rotation.set(...prop.rotation!);
  group.scale.set(...prop.scale!);
  group.userData.propType = prop.type;
  return group;
}

export function disposeProp(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
      else materials.add(object.material);
    }
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  group.removeFromParent();
}
