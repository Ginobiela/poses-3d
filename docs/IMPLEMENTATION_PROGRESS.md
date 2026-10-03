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

### Fase 3 — Presets corporales

Estado: COMPLETADA. Aprobación recibida: «continua fase 3».

Commit: `anatomy-phase-3` — etiqueta Git del único commit de esta fase, con asunto `feat(anatomy): phase 3 body presets`. Resolver con `git rev-parse anatomy-phase-3`.

Resultado y decisiones:

- Cuatro presets: Neutral, Delgado, Atlético y Musculoso, con siete morphs exactos y efectivos del GLB. Pesos concretos y criterios en BODY_PRESETS.md.
- Influencias moderadas, sin cambios de altura, longitud de extremidades o sexo. Se conserva skeleton y transformación del personaje.
- Integración de un BodyMorphController sobre los SkinnedMesh existentes; no hay recarga ni copias de personaje.
- Cambio de preset validado antes de escribir. Se limpian los siete pesos anteriores; Neutral restaura sus valores base de 0. Otros morphs permanecen intactos.
- Selector «Preset corporal» en las herramientas existentes. Ningún slider, persistencia corporal, correctivo, cambio de cámara, materiales o iluminación.
- Poses y animaciones mantienen el cuerpo seleccionado; cambiar el cuerpo conserva editor, historial, props y frame de animación.

Archivos principales modificados:

- `src/anatomy/bodyPresets.ts`
- `src/anatomy/bodyPresets.test.mjs`
- `src/viewer/viewer.ts`
- `src/referenceTools.ts`
- `e2e/body-presets.spec.ts`
- `docs/BODY_PRESETS.md`, `docs/BODY_MORPHS.md` y este registro.

Tests y verificaciones ejecutados:

- `pnpm test`: 30 tests aprobados en 11 archivos; 6 nuevos tests de presets sobre el GLB real.
- `pnpm build`: aprobado, 28 módulos; JS 697.04 kB (+3.89 kB), CSS 13.64 kB sin cambio. Advertencia previa de chunk mayor a 500 kB sigue presente. Sin nuevas dependencias.
- `pnpm exec playwright test e2e/body-presets.spec.ts`: 2 tests aprobados, incluida carga única del modelo, conservación de instancias y estado del visor, editor, props, animación y UI de escritorio/móvil. Consola sin errores.
- `pnpm exec playwright test e2e/animations.spec.ts`: 3 tests aprobados, con clips, congelar/exportar/importar, sesiones cronometradas y controles móviles.
- `pnpm exec playwright test e2e/rigged-character.spec.ts`: 2 tests aprobados, incluidos tres poses sin recarga del GLB y fallo de carga controlado.
- Revisión de capturas: cuatro presets en De pie 01, Neutral/Musculoso con brazos elevados y Neutral/Atlético sentados con silla en móvil.
- Test de auditoría sigue pasando: el asset y su SHA-256 permanecen intactos.

Problemas encontrados:

- El primer test de navegador usaba «walking» en vez del ID existente «walk-01». Se corrigió la prueba y pasó; no fue necesario modificar la biblioteca de animaciones.
- El modelo mantiene una definición muscular suave. Estos presets cambian volumen sin añadir superficie anatómica ni correctivos.
- La muestra sentada muestra intersección con la silla también con Neutral; se deja anotada para Fase 6, sin cambios ajenos a esta fase.

Tareas pendientes de esta fase: ninguna. Cambios listos para build estático; commit local sin nuevo despliegue.

### Fase 4 — Controles manuales de cuerpo

Estado: COMPLETADA. Aprobación recibida: «continuar fase 4».

Commit: `anatomy-phase-4` — etiqueta Git del único commit de esta fase, con asunto `feat(anatomy): phase 4 manual body controls`. Resolver con `git rev-parse anatomy-phase-4`.

Resultado y decisiones:

- Panel plegable «Tipo de cuerpo», con el selector existente y diez sliders para musculatura, peso/grasa, altura, hombros, pecho, torso, cintura, caderas, brazos y piernas.
- Catálogo separado de morphs reales; solo se muestran controles con todos sus targets y rangos disponibles. Sin nuevos assets ni geometría procedural.
- Sliders bidireccionales para targets opuestos, sin acumular ambos sentidos. Piernas controla muslos y pantorrillas. Musculatura ajusta el target general conservando los regionales del preset.
- Altura limitada a ±0.04 de influencia porque no adapta el rig; límites de UI documentados, sin asumir rangos anatómicos declarados por el GLB.
- Cambios inmediatos mediante input; «Personalizado» indica edición manual. Elegir un preset limpia ajustes adicionales y sincroniza los sliders.
- Se mantienen el único personaje, JSON lazy, pose/editor/historial, props, cámara, luces, temporizador y AnimationMixer. No se añadió localStorage corporal ni botón de reset de Fase 5.

Archivos principales modificados:

- `src/anatomy/bodyControls.ts` y `src/anatomy/bodyControls.test.mjs`
- `src/viewer/viewer.ts`
- `src/referenceTools.ts`
- `e2e/body-presets.spec.ts`
- `docs/BODY_CONTROLS.md`, `docs/BODY_PRESETS.md`, `docs/BODY_MORPHS.md` y este registro.

Tests y verificaciones ejecutados:

- `pnpm test`: 35 tests aprobados en 12 archivos; 5 nuevos tests del catálogo y controles sobre el GLB real.
- `pnpm exec playwright test e2e/body-presets.spec.ts e2e/rigged-character.spec.ts e2e/animations.spec.ts`: 7 tests aprobados. La suite de cuerpo volvió a pasar tras ampliar la comprobación de controles durante un frame de animación.
- Desktop 1280×800 y móvil 390×844: sliders, salida numérica, selector, persistencia durante cambio de pose, limpieza por preset y continuidad del temporizador. Una solicitud del GLB y consola sin errores.
- Comparación de estado del visor antes/después: misma pose editada, historial, selección, props, cámara, luces, personaje, editor y mixer; frame pausado conservado también con ajustes manuales.
- Capturas de UI y personaje revisadas en escritorio/móvil con combinaciones de máximos.
- `pnpm build`: aprobado; 29 módulos, JS 700.12 kB (+3.08 kB), gzip 181.08 kB y CSS 13.64 kB sin cambios. Permanece la advertencia previa de chunk mayor a 500 kB.
- La auditoría automatizada sigue pasando: asset y SHA-256 intactos.

Problemas y limitaciones:

- Se actualizó la prueba de visibilidad del selector para abrir el nuevo panel, que comienza plegado. No hubo fallos introducidos en el funcionamiento del visor.
- Altura cambia superficie sin mover joints; se mantiene un rango pequeño y se documenta que no proporciona escalado anatómico completo ni garantiza contacto idéntico con el suelo.
- La combinación de morphs sigue limitada por la malla suave y sin normales/correctivos auditados anteriormente. La revisión completa de deformaciones pertenece a Fase 6.

Tareas pendientes de esta fase: ninguna. Build estático listo; commit local sin nuevo despliegue.

### Fase 5 — Persistencia y restablecer cuerpo

Estado: COMPLETADA. Solicitud recibida: «continua fase 5 y 6». Se ejecutó únicamente Fase 5 conforme a la regla obligatoria de una fase por ejecución.

Commit: `anatomy-phase-5` — etiqueta Git del único commit de esta fase, con asunto `feat(anatomy): phase 5 body configuration persistence`. Resolver con `git rev-parse anatomy-phase-5`.

Resultado y decisiones:

- Guardado automático en la clave independiente `poses.body.v1`: versión 1, preset base y overrides por ID de control.
- Se conserva el preset base al editar manualmente, para recuperar también sus morphs regionales que no tienen slider. «Personalizado» es un estado visual, no un preset almacenado.
- Los valores cero y negativos se guardan y restauran. Al cargar se aplica primero el preset y después los overrides al mismo personaje.
- Validación de versión, preset, IDs, valores finitos y rangos de UI. JSON inválido o lectura bloqueada devuelve Neutral sin impedir la carga.
- Escritura por cambio de preset/slider o reset, sin callbacks por frame. Una escritura fallida mantiene el visor funcional y se informa en el status existente.
- Botón «Restablecer cuerpo»: Neutral, limpieza de ajustes, sliders/selector sincronizados y configuración Neutral persistida. Conserva otras claves, incluidas poses personalizadas.
- Sin cambios en assets, poses JSON, retargeting, skeleton, cámara, luces, props, temporizador, editor o AnimationMixer. Fase 6 no iniciada.

Archivos principales modificados:

- `src/storage/bodyConfiguration.ts` y `src/storage/bodyConfiguration.test.ts`
- `src/anatomy/restoreBodyConfiguration.ts` y `src/anatomy/bodyControls.test.mjs`
- `src/viewer/viewer.ts` y `src/referenceTools.ts`
- `e2e/body-persistence.spec.ts` y `e2e/body-presets.spec.ts`
- `docs/BODY_CONFIGURATION.md`, `docs/BODY_CONTROLS.md`, `docs/BODY_PRESETS.md` y este registro.

Tests y verificaciones ejecutados:

- `pnpm test`: 43 tests aprobados en 13 archivos; 6 nuevos de almacenamiento y 2 de restauración con el GLB real.
- `pnpm exec playwright test e2e/body-persistence.spec.ts e2e/body-presets.spec.ts e2e/rigged-character.spec.ts e2e/animations.spec.ts`: 10 tests aprobados.
- Desktop 1280×844 y móvil 390×844: preset tras recarga, overrides tras otra recarga, selección/valores correctos, reset persistente, otras claves intactas y continuidad del temporizador.
- Una solicitud del GLB por carga de página; ningún modelo adicional al editar o resetear. Consola sin errores en los recorridos normales.
- JSON corrupto y escritura bloqueada comprobados en navegador sin bloquear humano, edición, reset o práctica.
- Restauración de todas las influences y superficie idéntica en muestras de vértices de los cuatro meshes. Reset mantiene pose editada, historial, selección, props, cámara, luces e instancias del visor.
- Capturas de configuración restaurada revisadas en escritorio y móvil.
- `pnpm build`: aprobado, 31 módulos; JS 702.22 kB (+2.10 kB), gzip 181.66 kB; CSS 13.64 kB sin cambio. Continúa la advertencia previa de chunk mayor a 500 kB.
- Auditoría automatizada sigue pasando: human.glb y SHA-256 intactos.

Problemas y limitaciones:

- Guardar solo los sliders perdería la musculatura regional del preset al restaurar «Personalizado». Se conserva explícitamente el preset base y se aplican overrides después.
- Una escritura rechazada no puede garantizar persistencia; se informa el fallo y los cambios actuales siguen funcionando. No se sobrescriben datos válidos con valores inválidos.
- Persistencia local del navegador, sin backend ni cuentas. La exportación de poses no incorpora configuración corporal.

Tareas pendientes de esta fase: ninguna. Build estático listo; commit local sin nuevo despliegue.

### Fase 6 — Evaluar problemas de deformación

Estado: COMPLETADA. Aprobación recibida: «continua fase 6».

Commit: `anatomy-phase-6` — etiqueta Git del único commit de esta fase, con asunto `docs(anatomy): phase 6 deformation audit`. Resolver con `git rev-parse anatomy-phase-6`.

Resultado y decisiones:

- DEFORMATION_AUDIT.md: evaluación por región de aceptación, pérdida aparente de volumen, pinzamiento/colapso, estiramiento, candidatos de correctivos y posibilidades de mejora con pesos.
- Las 20 poses revisadas en los cuatro cuerpos; Neutral desde frente, ambos perfiles y espalda. 80 combinaciones, 140 capturas principales, 4 diagnósticas sin props y 5 móviles: 149 PNG originales.
- Nueve hojas de contacto WebP, siete detalles y mediciones versionadas en docs/audit/deformation. Capturas originales permanecen en resultados de Playwright, ignorados por Git.
- Prioridades: transición hombro/clavícula/axila, cintura en torsión, ingle en abducción extrema y flexiones fuertes. Presets modifican volumen, sin resolver esos defectos automáticamente.
- Problemas de apoyo separados del skinning: silla atraviesa parte de muslos/pelvis en 12; banco queda detrás del cuerpo sin sostenerlo en 13. Diagnóstico sin props no confirma colapso grave del glúteo.
- Observaciones visuales diferenciadas de hipótesis: no se calculó volumen cerrado ni colisiones entre triángulos. Antes de esculpir un correctivo se recomienda verificar pose, orientación y distribución de pesos.
- Los encuadres y la ocultación temporal de props existen exclusivamente en el entorno de pruebas. No se modificaron archivos src, assets, rig, poses, cámara/iluminación del producto o UI. No se comenzó Fase 7.

Archivos principales añadidos/modificados:

- `docs/DEFORMATION_AUDIT.md`
- `docs/audit/deformation/`: evidencia y metrics.json
- `e2e/deformation-audit.spec.ts`
- `scripts/build_deformation_evidence.py`
- `scripts/deformation-evidence.test.mjs`
- Este registro de progreso.

Tests y verificaciones ejecutados:

- `pnpm exec playwright test e2e/deformation-audit.spec.ts e2e/rigged-character.spec.ts`: 3 tests aprobados. Auditoría completa incluso sin depender del orden aleatorio de sesiones.
- 80 muestras con 15.066 vértices deformados finitos cada una; 52 quaternions normalizados e influences dentro de 0–1. Misma pose completa y mismas instancias al cambiar cuerpo.
- Un GLB y veinte JSON solicitados individualmente bajo demanda; consola y respuestas HTTP sin errores. Cinco poses móviles a 390×844.
- `python scripts/build_deformation_evidence.py test-results/deformation-audit-audita-v-d8b45-pos-sin-modificar-el-modelo`: nueve hojas y siete detalles generados fielmente y revisados; ochenta registros de mediciones conservados.
- `pnpm test`: 44 tests aprobados en 14 archivos. Nuevo test verifica cobertura de las 20 entradas, cuatro presets por pose, integridad numérica, enlaces de evidencia y hashes contra el GLB y los veinte JSON actuales. El generador rechaza fuentes modificadas después de capturar las imágenes.
- `pnpm build`: aprobado; 31 módulos, JS index-R4gTJ_vj.js 702.22 kB y CSS index-CpUq2J1K.css 13.64 kB, idénticos a Fase 5. Sin incremento del bundle; continúa la advertencia previa de chunk mayor a 500 kB.
- Asset/SHA-256 intactos, corroborados por la auditoría de modelo y la nueva comprobación de evidencia.

Problemas y límites encontrados:

- La validez de quaternions y skin weights no certifica calidad anatómica: se encontraron problemas visuales aunque la validación técnica pase.
- Props y apoyo global ocultan superficie y pueden confundirse con pérdida de volumen; se agregaron capturas sin silla/banco para distinguirlo.
- La flexión por segmentos mundiales ayuda a localizar poses exigentes, pero no es un ángulo Euler local ni un límite anatómico certificado.
- No se repararon pesos, shape keys, apoyos, geometría o JSON. Los candidatos de correctivos quedan documentados para evaluación posterior, sin asumir targets ausentes.

Tareas pendientes de esta fase: ninguna. Informe completo y evidencias reproducibles. Sin cambios de producción ni necesidad de nuevo despliegue.

## Publicación hasta Fase 6 — Corrección de CI

Estado: corrección COMPLETADA; publicación solicitada por el usuario el 2026-10-03.

Commit: etiqueta `anatomy-ci-line-endings`, asunto `fix(ci): normalize pose audit hashes across platforms`.

- Se subieron a GitHub los seis commits y sus etiquetas. El primer despliegue se detuvo al comparar hashes de JSON con CRLF en Windows y LF en Linux.
- Captura, generador de evidencias y test ahora normalizan CRLF a LF antes del hash de texto. El hash binario del GLB permanece intacto.
- Se regeneraron las evidencias: las imágenes y mediciones permanecen idénticas; únicamente cambian los veinte hashes de JSON.
- Archivos: e2e/deformation-audit.spec.ts, scripts/build_deformation_evidence.py, scripts/deformation-evidence.test.mjs, docs/audit/deformation/metrics.json y documentación de auditoría/progreso.
- Verificaciones: auditoría Playwright aprobada (20 poses, cuatro presets); 44 tests unitarios aprobados; build aprobado y bundle sin cambios.
- Sin cambios de producción, modelo, skeleton, poses o UI. Fase 7 permanece pendiente de aprobación.

## Actual

### Fase 7 — Sistema de corrective morphs

Estado: PENDIENTE DE APROBACIÓN EXPLÍCITA.

No iniciada. Leer MODEL_AUDIT.md y DEFORMATION_AUDIT.md antes de preparar PoseCorrectiveController y configuración. Conectar únicamente morphs realmente presentes, sin inventar targets ni alterar la malla. Esperar aprobación explícita para Fase 7.

## Pendientes

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
