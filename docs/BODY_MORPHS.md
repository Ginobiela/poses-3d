# BodyMorphController — Fase 2

`src/anatomy/BodyMorphController.ts` controla los morph targets reales del personaje existente. Se construye con los SkinnedMesh que ya devuelve CharacterLoader, sin cargar otro GLB:

```ts
import { BodyMorphController } from './anatomy/BodyMorphController';

const bodyMorphs = new BodyMorphController(character.skinnedMeshes);
bodyMorphs.setMorph('bodyMuscular', 0.25);
const value = bodyMorphs.getMorph('bodyMuscular');
const available = bodyMorphs.getAvailableMorphs();
bodyMorphs.resetMorph('bodyMuscular');
bodyMorphs.resetAll();
```

Este ejemplo muestra la API; no define un preset corporal ni certifica una mejora anatómica. La aplicación todavía conserva su comportamiento visual anterior. La conexión con presets y controles del sitio corresponde a las siguientes fases, con aprobación independiente.

## API

- `new BodyMorphController(meshes, limits?)`: registra los nombres exactos de morphTargetDictionary, valida índices y capturas iniciales y evita registrar dos veces el mismo mesh. Meshes sin morphs se omiten. Un personaje sin morphs produce un catálogo vacío.
- `setMorph(name, value)`: limita el valor finito al rango operativo y escribe únicamente en morphTargetInfluences. Actualiza todas las ocurrencias del nombre y devuelve el valor aplicado. Rechaza NaN, infinitos y nombres inexistentes antes de escribir.
- `getMorph(name)`: devuelve la influencia actual. Si escrituras externas desincronizan los meshes o dejan un valor fuera de rango, informa el error en vez de ocultarlo.
- `resetMorph(name)`: restaura cada ocurrencia a su valor capturado al crear el controlador. No cambia otros morphs.
- `resetAll()`: restaura todas las ocurrencias registradas. No fuerza 0 cuando el controlador se creó sobre una configuración inicial distinta.
- `getAvailableMorphs()`: devuelve copias de los descriptores con nombre, rango y ocurrencias `{ meshName, meshId, index, initialValue }`. No expone los objetos mesh ni las estructuras internas mutables.

No se buscan coincidencias parciales ni se inventan nombres. Por ejemplo, `bodyMuscular` existe, pero `BodyMuscular` no. Un morph ausente genera un error útil; los futuros consumidores que necesiten omitir morphs opcionales pueden consultar primero el catálogo.

## Rangos operativos

El GLB auditado **no declara límites de influencia**. El controlador usa 0–1 como política conservadora para no extrapolar más allá de un target completo; no la presenta como un rango anatómicamente seguro para todos los morphs o sus combinaciones.

Se pueden configurar restricciones menores por nombre:

```ts
const bodyMorphs = new BodyMorphController(character.skinnedMeshes, {
  bodyMuscular: { min: 0, max: 0.35 },
});
```

Los límites deben ser finitos, cumplir `0 <= min <= max <= 1` y contener las influencias iniciales de todas sus ocurrencias. Un nombre desconocido en la configuración se rechaza, para detectar errores de escritura. Este ejemplo es una restricción técnica, no un preset ni un tope validado visualmente.

## Meshes compartidos y datos nulos

Hay 306 nombres únicos y 395 ocurrencias en Body, Eyes, Teeth y Tongue. El mismo nombre puede tener distintos índices locales: `heightTaller` aparece en los cuatro meshes. Se actualizan todos para mantener la configuración consistente.

Los 7 slots auxiliares con deltas nulos encontrados en MODEL_AUDIT.md siguen registrados porque son nombres válidos del asset. Aplicar una influencia a esas ocurrencias no mueve sus vértices. La misma operación sí afecta las ocurrencias con datos efectivos.

El controlador no modifica atributos POSITION, NORMAL, deltas de targets, materiales, huesos, transformaciones del personaje ni su skeleton. No crea geometría, copias de mesh, callbacks de render o listeners. Three.js aplica los deltas existentes mediante su soporte de morph targets.

## Limitaciones que siguen pendientes

- No hay deltas de normales en el asset: el controlador no los genera ni recompone la geometría.
- Los cambios grandes de altura y longitud no reposicionan las articulaciones. Sus valores y combinaciones deben evaluarse al diseñar presets y revisar deformaciones.
- No hay reglas de exclusión automática entre morphs opuestos ni correctivos dependientes de la pose en esta fase.
- El controlador captura los valores al construirse. Para que reset vuelva a la configuración base del GLB, construirlo antes de aplicar personalizaciones.

## Pruebas

`src/anatomy/BodyMorphController.test.mjs` usa GLTFLoader para cargar el GLB local real y comprobar el inventario, sincronización, límites, reset, datos inválidos y preservación de geometría/materiales/huesos. También evalúa una posición de vértice con Three.js para verificar que las influencias usan los deltas efectivos del modelo. Las pruebas no requieren WebGL ni nuevas dependencias.

Ejecutar `pnpm test`, `pnpm build` y la comprobación de navegador `pnpm exec playwright test e2e/rigged-character.spec.ts`.
