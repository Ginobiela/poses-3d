# Auditoría de deformaciones — Fase 6

Fecha: 3 de octubre de 2026. Modelo y poses existentes, después de implementar morphs, presets y controles corporales. No se modificaron geometría, skinning, skeleton, retargeting, JSON, cámara o iluminación de la aplicación.

## Resultado

Las 20 poses se cargan y mantienen un skeleton válido con los cuatro presets. Las siluetas generales son utilizables, pero varias transiciones articulares siguen siendo poco convincentes como referencia anatómica: hombro/clavícula, axila, cintura en torsión y región inguinal. Las flexiones fuertes merecen revisión de pesos y de la pose antes de decidir correctivos.

Los problemas más claros de apoyo son independientes de los morphs: la silla de **12 — Sentada 02** atraviesa parte de muslos/pelvis; el banco de **13 — Sentada 04** queda detrás del glúteo y no sostiene el cuerpo. Cambiar de preset conserva esos problemas. Un corrective morph no debe utilizarse para compensar la posición de un prop.

Los presets aportan variación de volumen, especialmente en extremidades, pero no corrigen automáticamente estas deformaciones. No se observaron mallas separadas, valores NaN, rodillas inequívocamente invertidas ni un fallo de carga en el recorrido. Esto no certifica precisión anatómica de cada articulación.

## Método y evidencia

- GLB: `public/models/human/human.glb`, SHA-256 `6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18`. Cuatro SkinnedMesh, 52 bones y 15.066 entradas de vértice.
- Catálogo: las 20 entradas actuales de `public/poses/manifest.json`, por ID, sin selección aleatoria.
- Cada pose se revisó en Neutral desde frente, ambos perfiles y espalda; además, frente en Delgado, Atlético y Musculoso. Son 80 combinaciones de pose/cuerpo y 140 capturas principales.
- Cuatro capturas adicionales de 12/13 con props ocultos únicamente en el entorno de prueba permiten inspeccionar cadera/glúteo sin oclusión. Cinco capturas móviles en Atlético: 02, 07, 12, 15 y 20. Total: 149 capturas.
- Materiales y luces originales. El entorno de auditoría encuadra la superficie de cada pose Neutral y mantiene ese encuadre para sus cuatro cuerpos. Ese ajuste existe solo en el test; no cambia la cámara del producto. Las capturas sin props y móviles usan los presets de cámara existentes.
- CharacterLoader coloca sobre Y=0 el vértice más bajo de la superficie completa. Esa operación no garantiza contacto de glúteos, manos o plantas con un apoyo concreto; debe distinguirse de una deformación local del skinning.
- Se revisaron las nueve hojas de contacto y detalles originales de 02, 03, 07, 12, 13, 18, 19 y 20. Siete detalles se conservan junto al informe.
- El test evalúa los vértices deformados de los cuatro meshes, influences y quaternions en cada combinación; compara también la pose completa y las identidades de personaje/meshes. Una carga del GLB, 20 JSON solicitados individualmente bajo demanda, cero errores de consola o respuestas HTTP fallidas.

**Límites del diagnóstico:** pérdida de volumen, pinzamiento y estiramiento se valoran por contorno y superficie visibles. No se midió el volumen de una malla cerrada ni se hizo una prueba de colisiones entre triángulos. Los pesos suman 1 según MODEL_AUDIT.md, pero eso no demuestra que estén distribuidos correctamente. Las propuestas sobre pesos/correctivos son hipótesis de trabajo para validar en Blender, no reparaciones ya comprobadas.

### Evidencia persistente

| Poses | Neutral: cuatro vistas | Cuatro cuerpos: misma vista |
| --- | --- | --- |
| 01–05 | [Vistas 1](audit/deformation/views-1.webp) | [Cuerpos 1](audit/deformation/bodies-1.webp) |
| 06–10 | [Vistas 2](audit/deformation/views-2.webp) | [Cuerpos 2](audit/deformation/bodies-2.webp) |
| 11–15 | [Vistas 3](audit/deformation/views-3.webp) | [Cuerpos 3](audit/deformation/bodies-3.webp) |
| 16–20 | [Vistas 4](audit/deformation/views-4.webp) | [Cuerpos 4](audit/deformation/bodies-4.webp) |

[Muestra móvil](audit/deformation/mobile.webp) · [Mediciones y hashes de los 20 JSON fuente](audit/deformation/metrics.json).

Los hashes de los JSON fuente normalizan CRLF a LF antes de calcular SHA-256 para comparar Windows y Linux. El hash del GLB se calcula sobre sus bytes originales.

En CI se mantienen las 80 validaciones de pose/preset, renderizado frontal, cinco muestras móviles, conteo de descargas y comprobación de consola. Las 149 capturas se generan en la ejecución local sin `CI`, evitando que el renderizado por software del servidor bloquee el despliegue por tiempo.

Las PNG originales a 900×900 y las móviles a 390×844 quedan en el directorio de resultados de Playwright, ignorado por Git. Las hojas WebP y detalles sí se versionan. No se añadieron al bundle o a `public/`.

## Evaluación por región

«Parcial» significa que la silueta funciona, pero los planos locales necesitan revisión para referencia anatómica. «Aparente» distingue una observación visual de una medición volumétrica. «Candidato» significa evaluar un correctivo después de comprobar pose y pesos. «No demostrado» no equivale a garantizar todas las rotaciones posibles.

| Región | ¿Aceptable? | ¿Pierde volumen? | ¿Colapsa/pinza? | ¿Se estira? | ¿Necesita corrective morph? | ¿Podrían ayudar pesos de skinning? |
| --- | --- | --- | --- | --- | --- | --- |
| Hombro levantado | Parcial; 02/15/18 | Transición deltoide-axila aplanada, aparente | Angulación en inserción; sin separación | Sí, transición brazo/tórax larga en 02 | Candidato de elevación, tras revisar rig | Posiblemente: clavícula, Arm y pecho |
| Hombro hacia delante | Revisar; 07/09/12/17/19 | Aplanamiento local y bulto desigual | Pinzamiento local visible en 07/19 | Transición posterior poco continua | Candidato de avance/torsión | Sí como primera hipótesis; verificar pesos y orientación |
| Axila | Parcial; 02/05/07/18 | Cavidad y pliegue pierden lectura, aparente | Surco estrecho o borde duro en algunas rotaciones | Sí al elevar/separar brazos | Candidato de apertura/cierre | Posiblemente entre torso y brazo |
| Codo flexionado | Parcial; 03/13/16/20 | Interior de flexión aplanado | Pliegue angular; sin colapso total demostrado | No extremo claro; exterior muy suave | Candidato en flexión fuerte, no justificado para todos los ángulos | Posiblemente entre Arm y ForeArm |
| Muñeca | Mayormente aceptable; revisar 12/16/19 | No pérdida grave demostrada | Quiebres de contorno en gestos fuertes; algunos contactos ocluyen | No extremo claro | No demostrado; evaluar después de orientación local | Posiblemente ForeArm/Hand si persiste el quiebre |
| Cuello | Aceptable en leve giro; revisar 15/19/20 | Poco contorno libre en flexión fuerte | En 20 se comprime visualmente contra torso/hombro | Sí, lado convexo en 15 | Candidato solo para flexión extrema validada | Posiblemente Neck/Head/Spine2 |
| Columna en flexión/extensión | Parcial; 06/08/17/20 | Compresión anterior aparente en 20 | Pliegue torso-cadera fuerte en 20 | Arco posterior amplio en 06/08/20 | Candidato de compresión, tras revisar la pose | Posiblemente distribuir mejor entre segmentos Spine |
| Torsión de torso | Revisar; 07/09/12/19 | Estrechamientos locales aparentes | Ondulación/pinzamiento de cintura visible en 19 | Sí, lados de cintura desiguales | Candidato de torsión después de pesos | Sí como hipótesis prioritaria; evitar cargar todo en un segmento |
| Cadera/ingle | Parcial; 07/11/14/18/20 | Plano inguinal aplanado, especialmente 18 | Pliegues duros en flexión; sin separación | Sí, puente inguinal en abducción de 18 | Candidato de flexión/abducción después de validar pose | Posiblemente Hips/UpLeg; comprobar distribución |
| Glúteo | Generalmente aceptable sin props; detalle suave | No pérdida grave demostrada en perfiles 12/13 sin props | No colapso severo confirmado | No extremo claro; forma genérica al sentarse | No demostrado; evaluar una vez corregido el apoyo | Podrían mejorar pliegue glúteo-muslo; no arreglan el prop |
| Rodilla | Parcial; 07/08/11/13/20 | Contorno articular aplanado, aparente | Pliegue posterior simple en flexión fuerte | Transición anterior lisa; sin ruptura | Candidato en flexión profunda, tras pesos | Posiblemente UpLeg/Leg alrededor de la bisagra |
| Tobillo | Mayormente aceptable; revisar 08/10/20 | No pérdida grave demostrada | Sin colapso crítico inequívoco | Contorno simple en flexión de pie; no desgarro | No demostrado en esta muestra | Podrían mejorar transición Leg/Foot; validar orientación primero |

### Casos que sustentan la evaluación

1. **Elevación del hombro:** [02, perfil](audit/deformation/detail-02-neutral-left.webp). La unión superior del brazo con el torso resulta larga y poco articulada; en 18 los hombros forman esquinas visibles. La ausencia de planos musculares no se debe atribuir íntegramente al skinning: la forma base también es suave.
2. **Avance del hombro y cadera:** [07, frente](audit/deformation/detail-07-neutral-front.webp). El hombro posterior muestra un volumen alto y plano, mientras el anterior y la axila se comprimen. El muslo adelantado presenta una transición inguinal angular. Ambos siguen presentes con Musculoso.
3. **Flexión del codo:** 13/16/20 permiten revisar el interior de flexión. La pose 13 llega a unos 145° de flexión izquierda según segmentos del skeleton; se observa una unión suave/angular, sin la variación de masas que sería útil para dibujo. No se concluye que deba aumentar un bíceps automáticamente solo por ese ángulo.
4. **Torsión:** [19, espalda](audit/deformation/detail-19-neutral-back.webp). Hay un surco irregular y ondulación entre espalda baja, cintura y pelvis. Primero hay que distinguir distribución de rotación en la pose de distribución de pesos; un target no debe encubrir una orientación local incorrecta.
5. **Abducción de cadera:** [18, frente](audit/deformation/detail-18-neutral-front.webp). La abertura extrema conserva la continuidad de la malla, pero convierte la región inguinal en una franja ancha y plana. El cambio de cuerpo no aporta un correctivo articular.
6. **Flexión de tronco:** [20, perfil](audit/deformation/detail-20-neutral-right.webp). La postura comprime cuello y torso anterior y deja un arco posterior amplio. Es una pose extrema; antes de esculpir correctivos hay que confirmar que ese reparto de flexión es el que se quería representar.
7. **Glúteo y props:** [12 sin silla](audit/deformation/detail-12-neutral-no-prop-left.webp) y [13 sin banco](audit/deformation/detail-13-neutral-no-prop-left.webp). El contorno glúteo conserva masa cuando el objeto deja de ocultarlo. La oclusión/intersección del asiento no demuestra por sí sola colapso de la malla.

## Revisión de las 20 poses

Los hallazgos se repiten en los cuatro presets. «Útil» se refiere a silueta/gesto general, no a una certificación de anatomía superficial. Las referencias corresponden a las hojas de contacto por ID; los nombres se conservan tal como están en el catálogo.

| ID | Pose | Evaluación y observación principal |
| --- | --- | --- |
| 01 | De pie 01 | Útil como control de flexión leve. Sin colapso crítico evidente; hombros, codo y rodillas conservan continuidad aunque los planos sean suaves. |
| 02 | Brazos arriba | Útil para silueta; revisar elevación de hombros y estiramiento de axila/pecho. Los presets no recuperan una unión articular más convincente. |
| 03 | Manos a la cintura | Revisar transición hombro/clavícula y bisagra de codos cercanos a 95°. Manos junto a cadera no implican un fallo del skeleton. |
| 04 | Guardia 01 | Gesto utilizable. Revisar ingle de pierna adelantada y orientación de muñeca/brazo extendido; continuidad de rodillas conservada. |
| 05 | Equilibrio estrella | Buen control de brazos separados y piernas casi extendidas. Axila/deltoide planos; sin pinzamiento grave de rodillas evidente. |
| 06 | Guardia 02 | Pose muy inclinada, con rodilla derecha en flexión profunda. Revisar extensión de columna/cadera y apoyo; la etiqueta no prueba que deba tener ambas plantas sobre el suelo. |
| 07 | Carrera 01 | Prioridad alta: hombro avanzado/posterior desigual, transición inguinal dura y lectura de rodilla simplificada. Sin inversión inequívoca de la rodilla. |
| 08 | Salto en vuelo | Revisar flexión profunda de rodilla izquierda, extensión de tronco y axila asimétrica. La colocación cerca del suelo es una cuestión de presentación de una pose en vuelo. |
| 09 | Guardia 03 | Revisar hombros hacia delante, axila y cintura en giro. No se observó ruptura de la malla. |
| 10 | Caída | Silueta global legible, con cuerpo invertido. Revisar continuidad cuello/torso y pies en flexión; la orientación global invertida no equivale a rodillas invertidas. |
| 11 | Sentada erguida | Pose asimétrica cercana al suelo; revisar pliegue de cadera y rodilla flexionada. El nombre no determina que requiera silla. |
| 12 | Sentada 02 | Prioridad alta: asiento atraviesa muslo/pelvis; además hay torsión de cintura y hombro elevado. El prop necesita revisar su colocación separadamente del skinning. |
| 13 | Sentada 04 | Prioridad alta de apoyo: banco situado detrás, con glúteo fuera del asiento. Revisar codo izquierdo en flexión fuerte; sin colapso glúteo grave confirmado al ocultar el prop. |
| 14 | Sentada en el suelo | Gesto útil. Revisar planos de ingle y giro del muslo, apoyo de mano y muñeca; contorno posterior del glúteo continuo. |
| 15 | Triángulo | Revisar cintura/columna en flexión lateral, cuello y hombro elevado. Lado cóncavo comprimido y lado convexo largo; continuidad global conservada. |
| 16 | Foco ninja | Revisar codos de unos 115–117° y muñecas/manos próximas al rostro. El contacto de manos puede ocultar superficie; no se cuantificó interpenetración entre dedos/cara. |
| 17 | Inclinada | Revisar hombros hacia delante, unión cuello-tórax y pliegue lumbar. El apoyo sugerido por la pose fuente no está representado por un prop local. |
| 18 | Gimnasia 01 | Prioridad alta: región inguinal plana en abertura extrema y hombros angulares. No se separan las piernas del mesh ni aparecen valores inválidos. |
| 19 | Extensión diagonal | Prioridad alta: torsión de cintura/espalda con surco irregular; revisar también hombro y muñeca. Requiere validar la pose y pesos antes de definir un correctivo. |
| 20 | Contracción | Prioridad alta: flexión extrema con compresión anterior, cuello poco separado del torso y rodillas simplificadas. Confirmar intención de la pose antes de corregir su superficie. |

## Mediciones y comprobaciones técnicas

Los ángulos guardados en [metrics.json](audit/deformation/metrics.json) usan tres posiciones mundiales del skeleton: brazo–antebrazo–mano para codo y muslo–pierna–pie para rodilla. Se informa `180° - ángulo entre segmentos`; un segmento recto da 0°. No son Euler locales, límites médicos ni la futura lógica de correctivos.

Ejemplos que justifican incluir flexiones fuertes en la revisión:

| Pose | Codo izq./der. | Rodilla izq./der. |
| --- | ---: | ---: |
| 02 | 0.7° / 0.7° | 6.8° / 6.8° |
| 07 | 72.1° / 97.6° | 85.1° / 62.6° |
| 08 | 23.5° / 46.2° | 137.7° / 22.9° |
| 13 | 145.0° / 86.0° | 94.6° / 83.1° |
| 16 | 114.5° / 117.2° | 7.5° / 7.5° |
| 20 | 122.9° / 122.9° | 98.9° / 98.9° |

- 80 muestras: 15.066 vértices deformados finitos en cada una, 52 quaternions normalizados, influences finitas dentro de 0–1.
- Misma pose completa antes/después de cambiar cuerpo, incluidos huesos, posiciones locales y colocación del modelo. Una instancia de personaje y los mismos cuatro meshes en todo el recorrido.
- 1 GLB y 20 JSON; consola y HTTP sin errores. Cinco poses también revisadas a 390×844 con cámaras existentes.
- `pnpm test`: 44 tests aprobados, incluida sincronización entre catálogo, informe, evidencias y hashes del GLB y de los veinte JSON fuente. La prueba de navegador de auditoría y los dos tests de rigged-character también pasaron.
- `pnpm build`: aprobado; JS `index-R4gTJ_vj.js` 702.22 kB, CSS `index-CpUq2J1K.css` 13.64 kB. Mismos assets y tamaño que Fase 5. Advertencia previa de chunk mayor a 500 kB, sin incremento del bundle.

## Prioridades posteriores

1. **Pose y apoyo:** revisar la colocación de silla/banco y la intención de poses extremas, sin usar morphs para disimular problemas de contexto. Son hallazgos para trabajo posterior, no cambios aplicados aquí.
2. **Pesos y orientación:** revisar en Blender las transiciones clavícula/brazo, torso/cintura, Hips/UpLeg y bisagras de codo/rodilla. Las capturas permiten localizar el problema; no demuestran cuál vértice o peso hay que modificar.
3. **Correctivos:** evaluar candidatos de hombro, axila, torsión de torso, flexión profunda y cadera después de validar lo anterior. No se conectó ningún correctivo ni se asumió que existe un target articular por su nombre. MODEL_AUDIT.md no encontró nombres explícitos de correctivos articulares.
4. **Superficie anatómica:** la suavidad del modelo persiste incluso en articulaciones poco flexionadas. Su clasificación por músculos corresponde a Fase 10; un correctivo de pose no reemplaza una mejor forma base.

No se generaron músculos, desplazamientos de vértices, shape keys, correctivos ni nuevos assets externos. No se recomienda todavía reemplazar human.glb: esa decisión está reservada a Fase 18 después de las evaluaciones previstas.

## Reproducción

```sh
pnpm exec playwright test e2e/deformation-audit.spec.ts
python scripts/build_deformation_evidence.py test-results/deformation-audit-audita-v-d8b45-pos-sin-modificar-el-modelo
pnpm test
pnpm build
```

Si Playwright cambia el nombre del directorio de resultados, usar el directorio que contiene `audit-metrics.json`. La herramienta de hojas de contacto requiere Pillow y Arial de Windows, disponibles en el entorno usado para esta auditoría. Copia fielmente las capturas con reducción de tamaño y etiquetas; no retoca la anatomía. La evaluación visual sigue requiriendo revisar las imágenes: los tests numéricos no determinan automáticamente calidad anatómica.
