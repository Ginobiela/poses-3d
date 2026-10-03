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

### Fase 7 — Sistema de corrective morphs

Estado: COMPLETADA. Aprobación recibida: «continua fase 7».

Commit: `anatomy-phase-7` — etiqueta Git del commit de esta fase, asunto `feat(anatomy): phase 7 pose corrective controller`. Resolver con `git rev-parse anatomy-phase-7`.

Resultado y decisiones:

- PoseCorrectiveController independiente, basado en el mapa de huesos existente y BodyMorphController; opera exclusivamente sobre influences.
- Sensores de flexión por tres centros articulares y giro local firmado con reposo/eje explícitos. No se deducen ejes ni bind poses de nombres.
- Umbrales configurables, interpolación limitada, topes del morph y reset de correctivos sin tocar morphs corporales o skeleton.
- Morphs/huesos ausentes desactivan la regla y ofrecen diagnóstico. Datos inválidos desactivan su influencia sin propagar NaN; recuperación en una pose válida.
- Configuración separada POSE_CORRECTIVES vacía: el inventario del GLB no identifica correctivos articulares. No se reutilizan morphs generales de musculatura como supuestos correctivos.
- update explícito reutiliza vectores/quaternions; sin callback por frame ni integración de eventos de Fase 14. No necesita instanciarse en producción mientras no haya bindings validados.

Archivos principales:

- src/anatomy/PoseCorrectiveController.ts y PoseCorrectiveController.test.mjs
- src/anatomy/correctives.ts
- e2e/pose-correctives.spec.ts
- docs/POSE_CORRECTIVES.md y este registro.

Tests y verificaciones:

- pnpm test: 55 tests en 15 archivos; 11 nuevos tests de correctivos, incluyendo GLB real y las veinte poses.
- pnpm exec playwright test e2e/pose-correctives.spec.ts e2e/rigged-character.spec.ts: 3 tests aprobados. Desktop/móvil, pose/edit/frame conservados, configuración vacía segura, una solicitud del GLB y consola sin errores.
- pnpm build: aprobado; mismos 31 módulos, JS index-R4gTJ_vj.js 702.22 kB y CSS index-CpUq2J1K.css 13.64 kB. Sin incremento de bundle ni dependencias; advertencia previa de chunk grande permanece.
- Auditoría automatizada confirma GLB, morphs y evidencias sin cambios.

Problemas y límites:

- No hay mejora visual de articulaciones todavía: faltan targets correctivos identificados y calibrados. La arquitectura se verifica mediante fixtures de test y el GLB real sin bindings.
- La flexión por segmentos no distingue hiperextensión; el giro local exige calibración y no es IK ni un solver anatómico. No se conectan umbrales hipotéticos en producción.
- Especificar shape keys faltantes corresponde a Fase 9; conectar actualizaciones manuales corresponde a Fase 14.

Tareas pendientes de esta fase: ninguna. Commit local; no se solicitó un nuevo despliegue.

### Fase 8 — No crear musculatura falsa desde código

Estado: COMPLETADA. Aprobación recibida: «continua con fase 8».

Commit: `anatomy-phase-8` — etiqueta Git del commit de esta fase, asunto `docs(anatomy): phase 8 corrective gaps`. Resolver con `git rev-parse anatomy-phase-8`.

Resultado y decisiones:

- CORRECTIVE_GAPS.md registra los 26 nombres propuestos ausentes de los cuatro meshes, verificados contra el inventario directo del GLB.
- Cada faltante se relaciona con la evidencia de Fase 6 o se marca como necesidad aún no demostrada; no se confunde ausencia de un target con obligación de crearlo.
- Se documenta cobertura pendiente de axila, abducción de cadera y cuello, sin inventar bindings ni activadores.
- Se aclara la función corporal de morphs reales de musculatura/alineación y la falta de correctivos articulares identificados y calibrados.
- La anatomía permanece en la malla/deltas del GLB. No se añaden músculos con primitivas, metaballs ni desplazamientos improvisados de vértices.
- Las primitivas existentes corresponden a props, suelo y marcador del editor; permanecen funcionales.
- Sin cambios en src, GLB, poses, assets, arquitectura o UI. La especificación de Blender pertenece a Fase 9 y no se inició.

Archivos principales:

- docs/CORRECTIVE_GAPS.md
- docs/IMPLEMENTATION_PROGRESS.md

Tests y verificaciones:

- auditModel() sobre el asset real: 306 nombres únicos, 26 candidatos comprobados y 0 coincidencias; SHA-256 intacto.
- pnpm test: 55 tests aprobados en 15 archivos, incluidos inventario/GLB, configuración vacía sobre veinte poses, presets y editor.
- pnpm build: aprobado; JS index-R4gTJ_vj.js 702.22 kB, CSS index-CpUq2J1K.css 13.64 kB y 31 módulos, idénticos a la fase anterior. Permanece la advertencia previa de chunk grande.
- Revisión de los usos de geometría e influences en código de producción; ninguna generación de superficie anatómica procedural.

Problemas y límites:

- Ausencia de nombres exactos comprobada; no se ha identificado un correctivo equivalente bajo otro nombre.
- La necesidad de biceps/quad/glute/calf y extensión posterior de hombro no queda certificada por las capturas actuales. Se conserva esa incertidumbre en el inventario.
- No hay cambios visuales en esta fase documental.

Tareas pendientes de esta fase: ninguna. Commit local; no se solicitó un nuevo despliegue.

### Fase 9 — Lista de corrective morphs recomendados

Estado: COMPLETADA. Aprobación recibida: «continua con fase 9».

Commit: `anatomy-phase-9` — etiqueta Git del commit de esta fase, asunto `docs(anatomy): phase 9 Blender corrective specification`. Resolver con `git rev-parse anatomy-phase-9`.

Resultado y decisiones:

- CORRECTIVE_SHAPES.md especifica los 26 nombres pedidos: región, pose de autoría en Blender, articulación/controlador y condiciones de influencia 0 y 1 para cada uno.
- Ángulos propuestos de trabajo claramente diferenciados de calibración medida; no se activan reglas hipotéticas ni se afirman shape keys creadas.
- Flujo de edición de keys relativas sobre Body, conservación de Basis/topología/rig, edición con armature visible y prevención de doble aplicación de deformación.
- Registro de referencia, ejes y quaternions en el espacio del GLB exportado; sin asumir equivalencia directa con bases locales de Blender.
- Distinción entre deformación geométrica y contracción/esfuerzo. Biceps/quad/glute/calf requieren validar necesidad y condiciones adicionales.
- Compatibilidad con sensores de Fase 7: codos/rodillas mediante bend, movimientos direccionales mediante local-axis calibrado; sumas de columna y gates de múltiples articulaciones quedan pendientes para una implementación posterior autorizada.
- Export candidato separado y criterios de aceptación antes de sustituir un asset. Manuales oficiales de Blender enlazados para shape keys, autoría y glTF.
- Sin modificación de modelo, shapes, src, presets, correctives.ts, arquitectura o UI. Fase 10 no iniciada.

Archivos principales:

- docs/CORRECTIVE_SHAPES.md
- docs/IMPLEMENTATION_PROGRESS.md

Tests y verificaciones:

- Comprobación de cobertura documental: los 26 correctivos tienen fila con región, pose, articulación e influencias 0/1.
- pnpm test: 55 tests aprobados en 15 archivos, incluidos auditoría del GLB y conservación de veinte poses con configuración de correctivos vacía.
- pnpm build: aprobado; mismos 31 módulos, JS index-R4gTJ_vj.js 702.22 kB y CSS index-CpUq2J1K.css 13.64 kB. Advertencia previa de chunk grande permanece.

Problemas y límites:

- El asset aún carece de los 26 targets propuestos. La especificación no certifica modelado ni validación visual en Blender.
- El controlador actual no calcula directamente el ángulo total distribuido entre segmentos de columna ni condiciones compuestas de hombro/cadera/tobillo. Se documenta esa limitación y no se conecta un sensor incorrecto.

Tareas pendientes de esta fase: ninguna. Commit local; sin nuevo despliegue solicitado.

### Fase 10 — Mejorar anatomía superficial

Estado: COMPLETADA. Aprobación recibida: «continua fase 10».

Commit: `anatomy-phase-10` — etiqueta Git del commit de esta fase, asunto `docs(anatomy): phase 10 surface anatomy audit`. Resolver con `git rev-parse anatomy-phase-10`.

Resultado y decisiones:

- ANATOMY_AUDIT.md clasifica los 18 grupos pedidos con observación, poses de evidencia y límites de interpretación.
- Revisión directa de las ocho hojas de vistas/cuerpos de Fase 6, la hoja móvil y los detalles de 19 desde espalda y 13 sin banco. Evidencia existente reutilizada sin retoques.
- Resultado visual: 0 bien representados, 6 reconocibles pero demasiado suaves, 10 poco representados y 2 ausentes de la lectura superficial observada (serrato/sóleo).
- Se distingue ausencia visual de ausencia de geometría, forma base de deformación por pose y sombra/oclusión de separación muscular.
- Neutral tiene revisión frontal/perfiles/espalda; otros presets tienen comparación frontal. No se extrapola mejora posterior de Musculoso a partir del frente.
- Prioridades documentadas para evaluar volumen existente con material/luz en fases 11–12 y revisar uniones sin interpretar defectos de skinning como detalles anatómicos.
- Sin modificación de malla, GLB, src, poses, iluminación, UI o cámara. Decisión de reemplazo reservada a Fase 18.

Archivos principales:

- docs/ANATOMY_AUDIT.md
- docs/IMPLEMENTATION_PROGRESS.md

Tests y verificaciones:

- Cobertura documental comprobada: 18 grupos, clasificación consistente 6/10/2 y enlaces locales existentes.
- pnpm test: 55 tests aprobados en 15 archivos, incluidos hash/inventario de GLB y vigencia de las evidencias de veinte poses.
- pnpm build: aprobado; mismos 31 módulos, JS index-R4gTJ_vj.js 702.22 kB y CSS index-CpUq2J1K.css 13.64 kB. Advertencia previa de chunk grande permanece.

Problemas y límites:

- Material, iluminación suave, tejido superficial, encuadre y resolución limitan la lectura de relieves. No se certifica anatomía interna ni se segmenta la malla por músculos.
- Los tests numéricos mantienen la vigencia de evidencia y funcionamiento; no certifican automáticamente la clasificación visual.
- El modelo conserva masas útiles para gesto, pero sus separaciones musculares resultan insuficientes para referencia anatómica detallada bajo el render actual.

Tareas pendientes de esta fase: ninguna. Commit local; sin nuevo despliegue solicitado.

### Fase 11 — Modo visual Anatomía

Estado: COMPLETADA. Aprobación recibida: «continua fase 11».

Commit: `anatomy-phase-11` — etiqueta Git del commit de esta fase, asunto `feat(anatomy): phase 11 anatomy visual mode`. Resolver con `git rev-parse anatomy-phase-11`.

Resultado y decisiones:

- Selector existente con Normal, Gris, Silueta, Anatomía y Wireframe, definido desde un catálogo común tipado.
- Material PBR gris #90969c, roughness 0.48 y metalness 0; compartido por los cuatro meshes y reutilizado al alternar modos.
- Mayor contraste del cuerpo contra el fondo en las capturas revisadas. La lectura de volumen aprovecha las luces existentes; no se agregan músculos, relieves ni texturas.
- Normal restaura exactamente los materiales originales. Pose, morphs, rig, geometría, editor, props, cámara, temporizador y animación conservados.
- Sin recarga del GLB, dependencias nuevas, sustitución de assets ni modificaciones de iluminación. Presets de luz reservados a Fase 12.

Archivos principales:

- src/viewer/reference.ts y reference.test.ts
- src/referenceTools.ts
- e2e/anatomy-material.spec.ts
- docs/ANATOMY_MODE.md y este registro.

Tests y verificaciones:

- pnpm test: 56 tests aprobados en 15 archivos, incluida reutilización/liberación del material y restauración exacta.
- pnpm exec playwright test e2e/anatomy-material.spec.ts e2e/rigged-character.spec.ts: 5 tests aprobados. Desktop 1280 px y móvil 390 px, edición, cambio de cuerpo/pose/material, temporizador, una carga de GLB y consola sin errores.
- Harness con pose sentada/props y walk-01 al 43 %: estado del personaje, historial, cámara, luces, exposición y animación conservados.
- Capturas Normal/Anatomía revisadas directamente en ambos tamaños.
- pnpm build: aprobado; 31 módulos, JS index-DV5kyEHL.js 702.31 kB (+0.09 kB), CSS index-CpUq2J1K.css 13.64 kB sin cambios. Advertencia previa de chunk grande permanece.
- Auditoría automatizada sigue confirmando GLB e inventario intactos.

Problemas y límites:

- El material no corrige deformaciones ni añade las separaciones musculares que faltan en la malla; la definición sigue siendo suave.
- No se encontraron errores nuevos en las verificaciones de esta fase.

Tareas pendientes de esta fase: ninguna. Commit local; sin nuevo despliegue solicitado.

### Fase 11B.1 — Candidato offline de forma base y comparación

Estado: COMPLETADA. Aprobación recibida para Fase 11B; división explícita comunicada antes de implementar. **La Fase 11B completa todavía no está terminada.**

Commit: `anatomy-phase-11b-1` — etiqueta Git del commit de esta subfase, asunto `feat(anatomy): phase 11b.1 offline model candidate comparison`. Resolver con `git rev-parse anatomy-phase-11b-1`.

División y criterios:

- 11B.1: generar un candidato reproducible con deltas anatómicos autorados existentes, comparar misma pose/cámara/render y conservar producción. Finaliza con GLB separado, comparador, pruebas y decisión explícita de aceptación.
- 11B.2: inspeccionar/corregir skinning demostrable y elaborar correctivos reales o preparar una malla superior con licencia clara si la autoría sobre esta base no resulta viable. Requiere nueva aprobación.

Resultado y decisiones:

- dev/models/human-current.glb es copia binaria del actual; human-anatomy-v2.glb hornea siete deltas reales de MakeHuman/MPFB2 en Body y recalcula normales. No se inventan formas ni ángulos.
- Rig de 52 huesos, transformaciones, inverse bind matrices, pesos, UV, índices, auxiliares y 306 nombres de morph conservados.
- Deltas de los siete sliders rebased para evitar duplicar su extremo completo. Deben revisarse presets/combinaciones antes de integración.
- Comparador exclusivo de desarrollo con las veinte poses, selección de modelo, cámaras sincronizadas, edición y frame de animación. Visor recibe una URL opcional; predeterminado de producción intacto.
- Cambios modestos en volumen de brazos/muslos/pantorrillas; el torso sigue suave y los pliegues de articulación persisten. **Candidato no aceptado para producción**: no cumple aún mejora de rodillas/poses flexionadas ni todas las regiones requeridas.
- Sin Blender encontrado en PATH/ubicaciones habituales; no se afirma escultura ni weight painting ejecutado. Skinning/correctivos pendientes de 11B.2; no se conectan deltas artificiales.
- No se concluye todavía que la topología deba reemplazarse: su límite con morphs existentes no prueba imposibilidad de mejora artística.

Archivos principales:

- scripts/anatomy-candidate.mjs y anatomy-candidate.test.mjs
- dev/compare.html, dev/compare.js y dev/models/ con ambos GLB/licencia/procedencia
- src/viewer/viewer.ts (URL opcional únicamente)
- e2e/anatomy-candidate.spec.ts
- docs/ANATOMY_CANDIDATE.md, docs/audit/anatomy-candidate/ y este registro.

Tests y verificaciones:

- pnpm test: 58 tests aprobados en 16 archivos; reconstrucción idéntica, cambios geométricos no nulos, normales unitarias, source hash y datos conservados.
- pnpm exec playwright test e2e/anatomy-candidate.spec.ts e2e/anatomy-material.spec.ts: 4 tests aprobados. Comparador comprobado nuevamente tras incluir min/max y sincronización de cámaras.
- Veinte poses en ambos modelos: vértices finitos, quaternions iguales, props, edición/exportación, walk-01 al 43 %, tres poses móviles, dos descargas únicas (una por modelo) y cero errores de consola.
- 24 comparaciones desktop (ocho poses, tres vistas) y seis móviles guardadas; revisión directa de los casos requeridos y de corrida móvil. Evidencias originales de fases previas intactas.
- pnpm build: aprobado; 31 módulos, JS 702.35 kB (+0.04 kB), CSS 13.64 kB sin cambio. dev/ y sus assets fuera de dist; advertencia previa de chunk grande permanece.
- Original 6.806.984 bytes; candidato 7.207.176 bytes (+5,88 %), topología sin subdivisiones. Hashes registrados en ANATOMY_CANDIDATE.md.

Problemas encontrados y corregidos:

- Favicon ausente en el comparador: favicon inline agregado.
- Comparación profunda de buffers agotaba el test: Buffer.equals conserva comprobación binaria exacta sin ese costo.
- Accessors sparse nuevos carecían de min/max: incluidos para evitar warnings de GLTFLoader.

Tareas pendientes de esta subfase: ninguna. 11B.2 pendiente; Fase 11B completa no se presenta como finalizada. Commit local, sin reemplazo ni despliegue.

### Fase 11B.2 — Blender, pesos y correctivos de volumen

Estado: COMPLETADA. Aprobación recibida: «continuar fase b2, ya instale blender». **Candidato experimental, no aprobado para integrar; Fase 11B completa pendiente de aceptación artística.**

Commit: `anatomy-phase-11b-2` — etiqueta del commit de esta subfase, asunto `feat(anatomy): phase 11b.2 Blender volume corrective experiment`. Resolver con `git rev-parse anatomy-phase-11b-2`.

Resultado y decisiones:

- Blender 5.2.2 LTS localizado y ejecutado mediante scripting; fuente 11B.1 importada con 14.517 vértices Body, 307 keys contando Basis y 52 huesos.
- Inspección focal de pesos: ningún vértice huérfano ni discrepancia de pesos en vértices coincidentes de los cuatro meshes. No se redistribuyen pesos sin un defecto anatómico demostrado.
- Contracción local de LBS comprobada en codos/rodillas. Cuatro keys reales: elbowFlex_L/R y kneeFlex_L/R, derivadas offline de Preserve Volume de Blender mediante inversión del skinning lineal. No son escultura muscular ni inflado por porcentajes.
- Transferencia mundial entre bases Blender/glTF verificada: error LBS máximo 4.38e-7 m; los tests reproducen puntos corregidos de Blender en Three.js con tolerancia 2e-6 m.
- GLB separado human-anatomy-correctives.glb con POSITION/NORMAL sparse. Basis, materiales, UV, índices, pesos, inverse bind matrices y rig intactos. human.glb, v2 y todas las poses de producción sin cambios.
- Comparador de desarrollo con toggle desactivado por defecto, detalle de articulación y actualizaciones de targets en poses/edición/frame de clip; reposición sobre Y=0.
- Decisión: recuperación de masa local, pero rodillas angulares y correctivos no validados para todas las torsiones/cuerpos. No se aprueba su integración. Hombros/axilas/torso/cadera requieren autoría artística; no se inventan shape keys anatómicas.
- Base actual conservada para autoría, sin declarar imposible mejorar su topología. Archivo editable dev/blender/anatomy-correctives.blend generado; carpeta ignorada y reconstruible con runner.

Archivos principales:

- scripts/blender/ (inspección, preparación, generación, export, runner y tests)
- dev/models/human-anatomy-correctives.glb, volume-correctives.json y SOURCE.txt
- dev/compare.js; e2e/volume-correctives.spec.ts; e2e/anatomy-candidate.spec.ts usa ?base para mantener comparaciones anteriores
- scripts/anatomy-candidate.mjs expone únicamente el cálculo de normales offline
- docs/BLENDER_CORRECTIVES.md, docs/audit/volume-correctives/, nota en ANATOMY_CANDIDATE.md y este registro
- .gitignore excluye intermediarios/archivo Blender generado.

Tests y verificaciones:

- Runner completo aprobado en Blender 5.2.2; detiene la exportación ante cualquier error y reconstruye el mismo hash de GLB.
- pnpm test: 60 tests aprobados en 17 archivos, incluyendo export binario reproducible, soporte local/normal finito y correspondencia Blender/Three.js.
- pnpm exec playwright test e2e/volume-correctives.spec.ts e2e/anatomy-material.spec.ts: 4 tests aprobados. Veinte poses con correctivos, Y=0, props, edición/exportación, walk-01 al 43 %, toggle/reset, tres poses móviles, una descarga por visor y consola sin errores.
- 56 PNG nuevas: 27 comparaciones, 18 on/off, ocho detalles y tres móviles, incluida pose Neutral; revisión directa de codos/rodillas y casos 06/08/13/20. Cuatro presets comprobados numéricamente sin perder pose. Informes/evidencias anteriores intactos.
- pnpm build: aprobado; JS index-CHVX4fXg.js 702.35 kB y CSS index-CpUq2J1K.css 13.64 kB, iguales a 11B.1. Asset/controlador dev fuera del bundle productivo.
- GLB experimental 7.233.036 bytes (+25.860 frente a v2), SHA-256 2859a2327aab883667670b257983dd287d06e8e7f16b1df066235b567003c363.

Problemas encontrados y corregidos:

- Reset in-place de matrices Blender no actualizaba correctamente la siguiente calibración; se asigna Matrix.Identity explícitamente. Pipeline con --python-exit-code 1 para no ocultar errores.
- Carga inicial del comparador excedió los cinco segundos de expectativa; test permite 30 segundos y comprueba errores.
- Nuevos targets requieren normales derivadas para evitar sombreado obsoleto y reposición Y=0 para evitar hundir el personaje al recuperar volumen.
- NORMAL en morphs duplica canales de la textura de morphs de Three.js: alrededor de 137 MiB Body frente a 68 MiB antes de padding. Debe optimizarse/profilarse antes de integración móvil; capturas móviles no certifican hardware físico.

Pendiente fuera de esta subfase: **11B.3 — aceptación artística y optimización del candidato**. Escultura/refinamiento de rodillas y hombros, validación multidireccional y corporal, memoria móvil y decisión de integración/reemplazo. No iniciada. Commit local; sin despliegue ni sustitución productiva.

## Trabajo en curso — Fase 11B.3A

Estado: **NO COMPLETADA — gate visual de hombros/axilas NO APROBADO.** Ensayo técnico funcional, probado y guardado en un commit independiente; no equivale a aceptación anatómica ni habilita la siguiente subfase.

Commit del ensayo: etiqueta `anatomy-phase-11b-3a-experiment`, asunto `chore(anatomy): phase 11b.3a shoulder experiments and visual gate`. Resolver con `git rev-parse anatomy-phase-11b-3a-experiment`.

Autorización: solicitud «FASE 11B.3 — corrección prioritaria de hombros, cintura y pelvis». Se anunció la división antes de implementar: 11B.3A hombros/axilas y 11B.3B cintura/pelvis. **Solo se trabajó en 11B.3A.** El usuario considera suficientemente aceptables los codos/rodillas de 11B.2: esta prioridad sustituye la intención anterior de seguir refinando rodillas. Sus cuatro deltas POSITION/NORMAL se conservaron exactamente.

Resultado técnico:

- Clavículas ya móviles: pose 02, delta local frente al reposo 63,3°/51,9°; elevación de brazos respecto de Spine2 153,1°/146,6°. No se añadió movimiento automático redundante ni se alteraron huesos.
- Ensayo offline de difusión de pesos sobre 350 vértices de transición pecho/clavícula/brazo, sin tocar cuello/codos/manos/pelvis/rodillas/pies. Protección comprobada por soporte de huesos; no se presenta como weight painting anatómico aceptado.
- Seis shape keys de ensayo shoulderRaise/Forward/Back L/R obtenidos en Blender 5.2.2 a partir de tres poses diseñadas existentes (02/20/07), Preserve Volume y Corrective Smooth relativo al reposo, transferidos mediante LBS inverso. Se desactivan por defecto por no superar el gate.
- Archivo `dev/models/human-shoulders.glb` (7.628.192 bytes), JSON de calibración y maestro versionado `dev/blender/anatomy-shoulders.blend`, con las cinco regiones solicitadas. TORSO/PELVIS vacías, sin trabajo de otra subfase.
- Comparador con detalle de ambos hombros, frente/espalda/perfil/3⁄4, checkbox de ensayo rechazado y referencia opcional 11B.2 para aislar el cambio de pesos. 79 capturas nuevas, veinte poses validadas numéricamente y tres muestras móviles.
- Controlador admite smoothstep/smootherstep/curvas monotónicas y matching conjunto brazo/clavícula contra referencias medidas. No acumula ni escribe rotaciones. Mantiene la activación lineal de codos/rodillas.
- Coste por key registrado en `docs/audit/shoulders/budget.json`: 7,4–8 kB GLB, 348.408 bytes CPU de atributos y 464.544 bytes de textura GPU sin padding. Total experimental Body 316 targets: unos 140 MiB de textura sin padding. Sin integración productiva.

Archivos principales:

- `scripts/blender/build_shoulders.mjs`, `shoulder_weights.mjs`, `prepare_shoulders.mjs`, `shoulder_correctives.py`, `export_shoulders.mjs`, `shoulders.test.mjs`.
- `src/anatomy/PoseCorrectiveController.ts`, su test y `correctives.ts`.
- `dev/compare.js`, `dev/models/human-shoulders.glb`, `shoulder-correctives.json`, `dev/blender/anatomy-shoulders.blend`.
- `e2e/shoulders.spec.ts`, `docs/SHOULDER_EXPERIMENT.md`, `docs/audit/shoulders`, `dev/models/SOURCE.txt`, `.gitignore`.
- Exportador existente conserva metadatos de los cuatro correctivos al agregar targets; su salida 11B.2 continúa idéntica.

Verificaciones:

- Pipeline Blender reproducido desde el GLB 11B.2 versionado; detiene exportación ante fallos. Maestros e intermedios se regeneran, sin pasos manuales ocultos.
- `pnpm test`: 63 tests aprobados en 18 archivos. Deltas B2 intactos, seis referencias L/R coinciden con Blender a menos de 0,002 mm, pesos normalizados y finitos, soporte protegido, curves/matching/reset/NaN.
- `pnpm exec playwright test e2e/shoulders.spec.ts`: dos tests aprobados. Veinte poses, edición, reset, clip, cambios repetidos, móvil emulado, una descarga GLB por visor y consola sin errores. Comparaciones aisladas de pesos con luces/cámaras idénticas.
- Regresión conjunta en modo CI: `e2e/shoulders.spec.ts`, `e2e/volume-correctives.spec.ts`, `e2e/anatomy-candidate.spec.ts` y `e2e/anatomy-material.spec.ts`: siete tests aprobados, sin sobrescribir evidencias anteriores.
- `pnpm build`: aprobado; 31 módulos, JS index-CHVX4fXg.js 702,35 kB, CSS index-CpUq2J1K.css 13,64 kB. Bundle idéntico a 11B.2; archivos de ensayo fuera del build de producción.
- `human.glb` conserva SHA-256 6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18. `human-anatomy-v2.glb` y `human-anatomy-correctives.glb` anteriores intactos.

Problemas encontrados:

- Recuperación DQS aislada acentuó el borde puntiagudo del hombro. Corrective Smooth con máscara uniforme introdujo un corte en la axila; se probó máscara continua basada en el blend existente. Aun así persisten planos/picos y transición demasiado larga. **No se aprueba ninguno de los seis ensayos.**
- El grupo de máscara Blender debe excluirse de los grupos deformantes al calcular LBS; se corrigió la lectura. El pipeline oficial detiene fallos antes de exportar.
- La difusión de pesos suaviza algunos escalones, pero no asegura masa deltoidea/axila anatómica convincente. El nombre de un target y coincidencia matemática con Blender no certifican anatomía.

Pendiente imprescindible para completar 11B.3A: refinamiento artístico de la transición deltoides/pectoral/trapecio y axila sobre el maestro, revisión de pesos y repetición del gate multidireccional. No inventar músculos ni aceptar los ensayos por tests verdes. **No se pasa a cintura/pelvis mientras esta subfase no supere su criterio visual.** No se sustituyó v2 por un ensayo rechazado. Sin push ni despliegue.

## Publicación hasta Fase 6 — Corrección de CI

Estado: corrección COMPLETADA; publicación solicitada por el usuario el 2026-10-03.

Commit: etiqueta `anatomy-ci-line-endings`, asunto `fix(ci): normalize pose audit hashes across platforms`.

- Se subieron a GitHub los seis commits y sus etiquetas. El primer despliegue se detuvo al comparar hashes de JSON con CRLF en Windows y LF en Linux.
- Captura, generador de evidencias y test ahora normalizan CRLF a LF antes del hash de texto. El hash binario del GLB permanece intacto.
- Se regeneraron las evidencias: las imágenes y mediciones permanecen idénticas; únicamente cambian los veinte hashes de JSON.
- Archivos: e2e/deformation-audit.spec.ts, scripts/build_deformation_evidence.py, scripts/deformation-evidence.test.mjs, docs/audit/deformation/metrics.json y documentación de auditoría/progreso.
- Verificaciones: auditoría Playwright aprobada (20 poses, cuatro presets); 44 tests unitarios aprobados; build aprobado y bundle sin cambios.
- Sin cambios de producción, modelo, skeleton, poses o UI. Fase 7 permanece pendiente de aprobación.

### Ajuste de auditoría visual en CI

Commit: etiqueta `anatomy-ci-audit`, asunto `fix(ci): keep full pose validation without evidence screenshots`.

- La segunda ejecución remota aprobó 44 tests unitarios, build y 16 tests funcionales de navegador; la auditoría de capturas agotó sus 180 segundos. Un test de arrastre sigue omitido en CI según la configuración previa.
- CI conserva los 80 casos pose/preset, checks de vértices y huesos, renderizado frontal, muestras móviles y comprobaciones de carga/consola. La generación de 149 imágenes continúa disponible localmente.
- Se permite un margen de 360 segundos en el servidor para validaciones con WebGL por software.
- Verificación del modo CI de la auditoría y build antes del commit. Fase 7 sigue sin iniciarse.

## Actual

### Fase 11B.3A — Hombros y axilas

Estado: EN CURSO. El ensayo anterior de seis correctivos sigue rechazado. Nueva propuesta específica para «Brazos arriba» pendiente de aprobación del usuario; no se aplicó al resto del catálogo.

### Prueba aislada — hombros puntiagudos en Brazos arriba

Solicitud: «trata de solucionar los hombros puntiagudos en la pose brazos arriba, mostrame el resultado y si me gusta lo aplicamos al resto de las poses».

Commit: etiqueta `anatomy-arms-up-preview`, asunto `fix(anatomy): preview shoulder weights in arms-up pose`.

- La prueba detecta 38 vértices de transición Shoulder/Arm con influencia Neck. Se reasigna ese peso a Shoulder y se suaviza la transición local por conectividad y costuras (10 pasos, factor 0,5; 388 vértices). El método se evalúa visualmente sobre pose 02; no se afirma que resulte adecuado para todas las poses.
- El candidato `dev/models/human-arms-up-weights.glb` conserva malla, índices, normales de reposo, morphs, cuatro correctivos 11B.2, rig y JSON original. Se escriben los slots interleaved existentes de pesos, sin duplicarlos: 7.233.340 bytes, solo 304 bytes más por metadatos frente a 11B.2.
- `node scripts/arms-up-preview.mjs` reproduce el candidato. Se reutiliza `shoulder_weights.mjs`, sin dependencias nuevas. El comportamiento predeterminado reproduce exactamente el ensayo anterior.
- `dev/compare.html?arms-up` compara ANTES/DESPUÉS usando el mismo modelo base y pose. Solo muestra Brazos arriba; cámara, luces y material iguales. Sin los seis correctivos rechazados. Cuatro capturas en `docs/audit/arms-up-preview` y un informe de pesos.
- Archivos: comparador dev, helper offline, generador y test de preview, candidato GLB, evidencia, SOURCE.txt y este registro. Los archivos de skills instalados por el usuario no se incluyen en el commit.
- Tests: reproducción exacta, fuente sin mutaciones, 388 vértices limitados a la región, pesos finitos/normalizados y conservación de geometría/morphs/rig. Navegador: huesos de ambas vistas iguales, 15.066 vértices finitos, cuatro cámaras, móvil emulado, dos cargas (una por visor) y consola sin errores. Build verificado antes del commit.
- Resultado: `pnpm test` 64 tests aprobados en 19 archivos; cuatro tests de navegador de preview/hombros/11B.2 aprobados. La prueba específica se repitió tras ajustar el zoom inicial y también pasó. `pnpm build` conserva el JS index-CHVX4fXg.js 702,35 kB y CSS 13,64 kB.

Estado de esta prueba: **LISTA PARA REVISIÓN DEL USUARIO**. La reducción del pico es visible en frente y 3/4; persiste la suavidad general de la anatomía base. No se aprobó automáticamente el gate global 11B.3A ni se inició otra subfase. Próxima acción: usuario evalúa esta comparación antes de autorizar cambios en otras poses o producción.

## Pendientes

- Fase 11B.3A — Superar el gate de hombros/axilas; ensayo automático actual rechazado.
- Fase 11B.3B — Cintura/pelvis, torso y contrapposto. NO INICIADA. Requiere aprobación tras completar 11B.3A.
- Fase 12 — Presets opcionales de iluminación.
- Fase 13 — Verificación de compatibilidad con funciones existentes.
- Fase 14 — Actualización de correctivos durante edición manual.
- Fase 15 — Verificación de rendimiento y un único personaje.
- Fase 16 — Tests de las funcionalidades anatómicas implementadas.
- Fase 17 — Comparación visual antes/después para desarrollo.
- Fase 18 — Evaluación de suficiencia del modelo; no reemplazarlo automáticamente.
- Fase 19 — Validación final y entrega.

Las restricciones de no generar musculatura falsa, no reemplazar el GLB automáticamente y no rehacer la arquitectura se aplican durante todas las fases, aunque sus revisiones formales estén pendientes.
