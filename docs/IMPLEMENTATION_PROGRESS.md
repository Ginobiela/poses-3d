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

## Actual

### Fase 2 — BodyMorphController

Estado: PENDIENTE DE APROBACIÓN EXPLÍCITA.

No iniciada. Los candidatos reales están documentados en MODEL_AUDIT.md. Antes de implementar, revisar su inventario, las ocurrencias compartidas y la ausencia de rangos declarados. No implementar nada hasta que el usuario responda «Continuar» o apruebe específicamente esta fase.

## Pendientes

- Fase 2 — Exponer morph targets útiles mediante BodyMorphController.
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
