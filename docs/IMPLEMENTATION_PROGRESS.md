# Implementation Progress

## Regla de ejecución

Trabajar únicamente una fase por ejecución. Al terminar, ejecutar sus pruebas, verificar build, crear un commit independiente y detenerse hasta aprobación explícita. Leer este archivo, la documentación relevante y el estado Git al retomar. No repetir fases completadas ni empezar la siguiente automáticamente.

## Completadas

### Fase 1 — Auditoría completa del GLB actual

Estado: COMPLETADA.

Commit: `anatomy-phase-1` — etiqueta Git que referencia el único commit de esta fase, con asunto `docs(anatomy): phase 1 model audit`. Obtener su hash mediante `git rev-parse anatomy-phase-1`. Se usa una referencia Git para evitar incluir en el archivo el hash circular de su propio commit.

Resultado:

- 4 meshes: Body, Eyes, Teeth y Tongue; todos SkinnedMesh.
- 15.066 entradas de vértices POSITION y 27.676 triángulos.
- 1 skin ParametricSkin; 52 huesos mixamorig, inventariados con nombres originales y padres.
- 306 nombres únicos de morph targets y 395 slots repartidos entre los cuatro meshes.
- 388 slots con deltas efectivos y 7 slots nulos en meshes auxiliares. Todos los targets de Body tienen deltas no nulos.
- Morphs reales de musculatura, peso, altura, hombros, pecho, torso, cintura, caderas, brazos y piernas. La tabla completa registra nombre, mesh, índice, vértices afectados y desplazamiento máximo.
- 4 materiales PBR, sin imágenes, texturas ni normal maps. Los targets contienen POSITION, sin NORMAL o TANGENT.
- El GLB no declara rangos de influencia ni restricciones entre morphs opuestos. Todos sus pesos iniciales son 0.
- Sin cambios en human.glb, src, UI, poses, animaciones ni arquitectura de carga.

Decisiones técnicas:

- Leer el JSON glTF y decodificar el GLB real con el GLTFLoader instalado para comprobar los datos efectivos, incluidos accessors sparse.
- Mantener la auditoría como herramienta de desarrollo, fuera del bundle del sitio.
- Generar MODEL_AUDIT.md de forma reproducible; el test verifica que el informe coincide con el asset inspeccionado.
- Distinguir nombres únicos de slots por mesh y targets nulos de targets efectivos.
- No asumir límites anatómicos 0–1 ni calidad visual por el nombre de un morph.
- No aplicar morphs, diseñar presets ni conectar correctivos durante esta fase.

Archivos principales añadidos:

- `docs/MODEL_AUDIT.md`
- `docs/IMPLEMENTATION_PROGRESS.md`
- `scripts/audit-model.mjs`
- `scripts/audit-model.test.mjs`

Tests y verificaciones ejecutados:

- `node scripts/audit-model.mjs --report docs/MODEL_AUDIT.md`: informe generado desde el GLB real.
- `pnpm test`: 17 tests aprobados en 9 archivos, incluido el test de auditoría.
- `pnpm exec playwright test e2e/rigged-character.spec.ts`: 2 tests aprobados; carga del rig, tres poses, una solicitud del GLB, escritorio, móvil, consola sin errores y manejo de fallo de carga.
- `pnpm build`: aprobado; 26 módulos, JS 693,15 kB y CSS 13,64 kB. Los nombres de los assets de producción siguen siendo index-BnlwZps7.js e index-CpUq2J1K.css, iguales a la versión previa; sin incremento del bundle.
- SHA-256 del modelo: `6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18`, coincide con SOURCE.txt y con la versión anterior.

Problemas encontrados:

- La primera comprobación de tests suponía que todos los slots tenían deltas. La inspección reveló los 7 slots auxiliares nulos; se corrigió la expectativa y se documentó la lista exacta. No se alteró el asset.
- Los cambios de forma no incluyen deltas de normales, lo que puede limitar la lectura de volumen en modificaciones grandes.
- Algunos nombres compartidos afectan los cuatro meshes; modificarlos solo en Body puede desalinear partes de la cabeza.
- Cambios de altura y longitudes deforman la malla sin mover el skeleton; habrá que evaluar combinaciones seguras cuando corresponda.
- No se encontraron nombres explícitos de correctivos articulares. No se deduce su existencia a partir de morphs generales de musculatura.

Tareas pendientes de esta fase: ninguna. La auditoría de deformaciones y de anatomía superficial pertenece a fases posteriores. Esta fase documental no necesita un nuevo despliegue del sitio.

### Fase 2 — BodyMorphController

Estado: COMPLETADA. Aprobación recibida: «continua a fase 2».

Commit: `anatomy-phase-2` — etiqueta Git del único commit de esta fase, con asunto `feat(anatomy): phase 2 body morph controller`. Resolver con `git rev-parse anatomy-phase-2`.

Resultado:

- API setMorph, getMorph, resetMorph, resetAll y getAvailableMorphs sobre los SkinnedMesh ya cargados.
- 306 nombres reales y 395 ocurrencias descubiertos en el GLB; nombres compartidos sincronizados en los cuatro meshes.
- Escritura únicamente en morphTargetInfluences; sin modificar geometría, materiales, skeleton ni pose.
- Validación de índices, configuración y valores finitos; errores útiles para nombres ausentes, valores inválidos y desincronización externa.
- Reset a la captura inicial por ocurrencia, incluido un estado inicial distinto de 0.
- Metadatos devueltos como copias, sin referencias a meshes o estructuras internas mutables.

Decisiones técnicas:

- Rango operativo predeterminado 0–1 porque el asset no declara límites; se documenta como política de no extrapolación, sin garantía anatómica de combinaciones. Admite topes menores configurables por nombre, validados antes de escribir.
- Mantener los slots nulos como ocurrencias válidas y sincronizarlos con sus nombres compartidos.
- Módulo independiente que recibe character.skinnedMeshes; no necesita otra carga ni cambios en CharacterLoader. Los presets y la integración visual permanecen en sus fases respectivas.
- Ninguna nueva dependencia ni callback por frame.

Archivos principales añadidos:

- `src/anatomy/BodyMorphController.ts`
- `src/anatomy/BodyMorphController.test.mjs`
- `docs/BODY_MORPHS.md`
- Actualización de `docs/IMPLEMENTATION_PROGRESS.md`.

Tests y verificaciones ejecutados:

- `pnpm test`: 24 tests aprobados en 10 archivos; 7 nuevos tests del controlador sobre el GLB real.
- `pnpm build`: aprobado; 26 módulos, JS 693,15 kB y CSS 13,64 kB. Assets index-BnlwZps7.js e index-CpUq2J1K.css iguales a la fase anterior; el módulo independiente aún no forma parte de la UI ni aumenta el bundle.
- `pnpm exec playwright test e2e/rigged-character.spec.ts`: 2 tests aprobados, con carga única del GLB, tres poses, escritorio, móvil, consola sin errores y fallo de carga controlado.
- El test de auditoría de Fase 1 sigue pasando y confirma que human.glb conserva su SHA-256 e inventario.

Problemas encontrados y corregidos:

- La configuración TypeScript del frontend no dispone de declaraciones node:fs/promises. Las pruebas que leen el GLB se dejaron en ESM .mjs, como la auditoría previa, evitando agregar dependencias al proyecto. Se corrigieron las anotaciones TypeScript restantes al convertir el test.
- Los límites anatómicos y las combinaciones seguras siguen sin estar declarados por el asset. No se inventaron restricciones específicas de presets en esta fase.

Tareas pendientes de esta fase: ninguna. No se añadieron presets, sliders, persistencia corporal, correctivos ni cambios visuales. No hace falta desplegar una UI nueva en esta fase.

## Actual

### Fase 3 — Presets corporales

Estado: PENDIENTE DE APROBACIÓN EXPLÍCITA.

No iniciada. Leer MODEL_AUDIT.md y BODY_MORPHS.md antes de diseñar los presets con morphs reales. Los valores requieren evaluación y deben conservar pose, skeleton, cámara y demás funciones existentes. Esperar «Continuar» o aprobación explícita de la Fase 3.

## Pendientes

- Fase 3 — Presets corporales con morphs reales.
- Fase 4 — Controles manuales de cuerpo.
- Fase 5 — Persistencia y restablecer cuerpo.
- Fase 6 — Auditoría de deformaciones en las 20 poses.
- Fase 7 — Arquitectura de corrective morphs disponibles.
- Fase 8 — Documentar faltantes sin generar anatomía procedural.
- Fase 9 — Especificación de corrective shapes para Blender.
- Fase 10 — Auditoría de anatomía superficial.
- Fase 11 — Modo visual Anatomía.
- Fase 12 — Presets opcionales de iluminación.
- Fase 13 — Verificación de compatibilidad con funciones existentes.
- Fase 14 — Actualización de correctivos durante edición manual.
- Fase 15 — Verificación de rendimiento y un único personaje.
- Fase 16 — Tests de las funcionalidades anatómicas implementadas.
- Fase 17 — Comparación visual antes/después para desarrollo.
- Fase 18 — Evaluación de suficiencia del modelo; no reemplazarlo automáticamente.
- Fase 19 — Validación final y entrega.

Las restricciones de no generar musculatura falsa, no reemplazar el GLB automáticamente y no rehacer la arquitectura se aplican durante todas las fases, aunque sus revisiones formales estén pendientes.
