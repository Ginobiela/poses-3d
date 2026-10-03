# Auditoría de anatomía superficial — Fase 10

## Resultado

El personaje ofrece silueta y masas corporales útiles para practicar gesto y volumen general. Su superficie todavía aporta poca información para estudiar separaciones, inserciones y planos de grupos musculares. Los presets cambian el volumen, pero la definición sigue suave incluso en Musculoso.

Los 18 grupos pedidos se clasifican así: **0 bien representados, 6 reconocibles pero demasiado suaves, 10 poco representados y 2 ausentes de la lectura superficial observada**. La evaluación se refiere a utilidad para dibujo anatómico con las capturas actuales; no certifica la anatomía interna del modelo ni exige que un cuerpo con piel exponga todos sus músculos como un écorché.

No se modificó la malla. La decisión sobre reemplazar el modelo permanece en Fase 18, después de evaluar material e iluminación.

## Modelo, método y límites

- Asset: `public/models/human/human.glb`, SHA-256 `6627588660aa6c754aaa2edb181bc01a8ca60c3b4c534efa3e87f636ce5cda18`; cuatro SkinnedMesh y 52 huesos. Inventario técnico en [MODEL_AUDIT.md](MODEL_AUDIT.md).
- Se revisaron visualmente las cuatro hojas de vistas Neutral, las cuatro hojas de cuerpos y la hoja móvil de [la auditoría de deformaciones](DEFORMATION_AUDIT.md): veinte poses, Neutral desde frente/perfiles/espalda y comparaciones frontales con Delgado/Atlético/Musculoso.
- Se inspeccionaron además los detalles de 19 desde espalda y 13 desde perfil sin banco. Estos ayudan a separar deformación y oclusión de lectura muscular.
- Material e iluminación originales; ningún modo Anatomía o preset lateral nuevo. La comparación posterior entre cuerpos está limitada: las vistas de espalda/perfil de todas las poses corresponden a Neutral; los otros cuerpos se comparan de frente.
- Evidencias de Fase 6 reutilizadas sin retoques ni nueva captura. Desde entonces el modelo, presets, poses y render de producción permanecen iguales; las fases 7–9 añadieron arquitectura independiente/documentación, con cero correctivos activos.
- Los nombres de targets corporales no determinan por sí solos si un músculo está bien representado. La clasificación se basa en contorno y superficie visibles.

La iluminación suave, el tejido superficial, la pose y la resolución pueden ocultar detalles. «Ausente» significa que **no se identifica una forma independiente en las imágenes evaluadas**, no que el archivo carezca de vértices en esa región. No se hizo disección virtual, segmentación por músculos, medición de volumen ni comparación métrica con una referencia escaneada. Las sombras de pliegues por skinning tampoco se toman como fibras o separaciones musculares.

## Criterios de clasificación

| Clase | Criterio visual aplicado |
| --- | --- |
| Bien representado | Masa y límites útiles para reconocer el grupo en varias vistas; planos e inserciones suficientes para la finalidad de dibujo. |
| Reconocible pero demasiado suave | Se reconoce la masa general, pero límites, transiciones o divisiones relevantes se diluyen. |
| Poco representado | La región existe y aporta volumen general; cuesta distinguir el grupo de sus vecinos. |
| Ausente | No se reconoce una forma superficial independiente en las vistas disponibles. |

## Evaluación de los 18 grupos

Los IDs remiten a las hojas enlazadas al final. Las observaciones de músculos individuales tienen menor certeza que la lectura de masas generales; se conserva esa diferencia en la columna de límites.

| Grupo | Clasificación | Observación visual y evidencia | Límite de la interpretación / revisión posterior |
| --- | --- | --- | --- |
| Deltoides | Reconocible pero demasiado suave | El hombro tiene una masa superior/lateral reconocible en 01/03/05. Con brazo elevado o adelantado, 02/07/19 muestran transición larga o angular hacia axila/tórax. | La separación entre porciones no se lee claramente. Parte del defecto es deformación de unión, ya registrada en Fase 6. |
| Pectoral mayor | Poco representado | En 01/02/05/16 el volumen anterior del tórax está presente, pero no se distingue con claridad la masa del pectoral y su continuidad hacia brazo. El preset Musculoso conserva esa suavidad. | El volumen del pecho y del tejido superficial no identifica por sí solo el músculo. Revisar el plano superior y unión axilar con otras luces. |
| Trapecio | Poco representado | La conexión cuello-hombro existe en espalda 01/03/05/16; la superficie superior de espalda se ve amplia y lisa, sin separación clara de masas. | Las posturas de cuello y clavícula alteran el contorno. No atribuir cada bulto de 19 al trapecio. |
| Dorsal ancho | Poco representado | En espalda 02/05/09/15 hay ensanchamiento general del torso y transición hacia cintura, pero poca lectura independiente del grupo. | Los surcos de 19 corresponden también a torsión/deformación. El frontal de Musculoso no permite certificar una mejora posterior. |
| Serrato | Ausente | En vistas frontales y laterales de 02/05/15 la pared lateral del tórax es suave; no se identifica un patrón superficial independiente. | Ausencia visual bajo estas condiciones. No implica ausencia anatómica interna ni justifica dibujar estrías artificiales. |
| Bíceps | Reconocible pero demasiado suave | El volumen anterior del brazo resulta reconocible en 03/13/16; la comparación de cuerpos incrementa masa sin delimitar claramente inserciones o divisiones. | Flexión del codo no equivale a contracción. La lectura depende de orientación y del cuerpo elegido. |
| Tríceps | Poco representado | En espalda/perfil 01/03/05/16, la cara posterior del brazo permanece continua y lisa, difícil de distinguir de la masa anterior/lateral. | No se separan claramente cabezas ni transición tendinosa. No afirmar que un correctivo de codo resuelva esta forma base. |
| Antebrazo | Reconocible pero demasiado suave | Se reconoce el cambio de grosor hacia muñeca en 01/03/13/16; el conjunto tiene volumen útil pero pocas diferencias de planos. | Se evalúa el conjunto del antebrazo, sin clasificar individualmente flexores/extensores. Giro y contactos pueden ocultar superficie. |
| Recto abdominal | Poco representado | En frente 01/02/05/16 y comparaciones de cuerpos, el abdomen aporta una masa central suave; no se distinguen divisiones o bordes suficientes para estudiar el grupo. | Ombligo y contorno abdominal no acreditan definición muscular. En 20 predomina compresión de pose, no una lectura limpia. |
| Oblicuos | Poco representado | Hay cintura y cambio de contorno lateral en 01/05/15/19, pero no una separación consistente del plano oblicuo. | El surco de cintura de 19 no debe interpretarse como detalle anatómico correcto. Revisar giro, pesos y luz. |
| Glúteo mayor | Reconocible pero demasiado suave | El volumen posterior y su continuidad hacia muslo se reconocen en perfiles/espalda 01/04/11/14. En 13 sin banco conserva masa. | Hay poca definición de planos y transición inferior. Oclusión/intersección de silla/banco en 12/13 no demuestra colapso muscular. |
| Glúteo medio | Poco representado | La zona lateral superior de cadera está presente en 01/05/14/15, con contorno general pero poca distinción respecto del conjunto de pelvis/glúteo. | Tejido superficial y orientación limitan lectura; no se identifica de forma suficientemente consistente como masa separada. |
| Cuádriceps | Reconocible pero demasiado suave | La masa anterior/lateral del muslo es legible en 01/04/07/11/14 y aumenta con presets. Las superficies siguen uniformes hacia rodilla. | No se leen bien las divisiones ni el cambio de planos distal. Las bisagras de rodilla requieren la revisión independiente de Fase 6. |
| Aductores | Poco representado | En 04/05/14/18, la cara medial del muslo forma un volumen continuo; cuesta separar el grupo. La abertura de 18 deja una franja inguinal plana. | Esa franja puede combinar pose y skinning; no demuestra ausencia de masa ni una correcta inserción. |
| Isquiotibiales | Poco representado | En vistas posteriores/perfiles de 01/04/07/08/14, el muslo posterior tiene masa, con poca diferenciación de bandas o transición hacia rodilla. | Se evalúa forma superficial, sin distinguir sus músculos por separado. Los presets comparados de frente no certifican mejora aquí. |
| Tibial anterior | Poco representado | Frente/perfil 01/04/07/11 muestran pierna anterior y borde general de espinilla, pero no una masa lateral suficientemente clara para reconocer el grupo. | Un borde o sombra tibial puede ser óseo o iluminación; requiere otras vistas/luz antes de atribuirlo al músculo. |
| Gastrocnemios | Reconocible pero demasiado suave | La masa posterior de pantorrilla y afinamiento hacia tobillo se reconocen en espalda/perfiles 01/04/07/08. | La separación entre cabezas y transición inferior se diluyen. La pose del pie no determina esfuerzo muscular. |
| Sóleo | Ausente | En las mismas vistas de pierna de 01/04/07/08/14 no se distingue una forma independiente bajo la masa posterior de pantorrilla. | Clasificación visual provisional: no afirmar ausencia interna. Una vista más cercana y luz lateral podrían revelar relieve ahora oculto. |

## Qué aportan los presets actuales

Neutral sirve de referencia para masa general; Delgado reduce volumen; Atlético y Musculoso lo incrementan mediante targets reales. Las hojas frontales muestran cambios moderados en brazos y muslos, conservando pose y encuadre. Las separaciones superficiales del torso siguen poco claras.

`bodyMuscular`, `armsMuscular`, `thighsMuscular`, `calvesMuscular`, `chestPectorals` y `bellyToned` tienen deltas reales, comprobados en MODEL_AUDIT.md. Sus nombres no garantizan que esos deltas representen cada músculo con precisión. Aumentar su influencia tampoco aporta automáticamente inserciones, normales de morph o correctivos articulares ausentes.

La suavidad persiste en poses moderadas como 01/05/16, además de las deformaciones extremas de 18/19/20. Por eso conviene revisar por separado **forma base**, **deformación de pose** y **lectura por renderizado**.

## Prioridades de evaluación posterior

1. **Lectura del volumen existente:** probar material y luz lateral en las fases 11–12, manteniendo pose, cámara y cuerpo para comparar. Revaluar especialmente torso, espalda y pierna distal antes de concluir que un relieve está ausente de la geometría.
2. **Uniones articulares:** usar DEFORMATION_AUDIT.md para hombro/axila, cintura e ingle. Un surco irregular de skinning no debe reforzarse como si fuera una separación muscular.
3. **Forma superficial:** si la falta de definición se confirma con render más legible, preparar revisión artística de torso, espalda, brazos y piernas sobre el modelo. No desplazar vértices desde JavaScript ni añadir primitivas anatómicas.
4. **Correctivos:** la especificación de [CORRECTIVE_SHAPES.md](CORRECTIVE_SHAPES.md) atiende deformación de pose. Las keys todavía no existen; no sustituyen por sí solas una forma base más convincente.

No se decide todavía reemplazar human.glb. Esta auditoría proporciona evidencia para esa evaluación posterior, conservando las limitaciones de resolución, iluminación y cobertura.

## Evidencia revisada

| Poses | Neutral: frente, perfiles y espalda | Comparación frontal de cuatro cuerpos |
| --- | --- | --- |
| 01–05 | [Vistas 1](audit/deformation/views-1.webp) | [Cuerpos 1](audit/deformation/bodies-1.webp) |
| 06–10 | [Vistas 2](audit/deformation/views-2.webp) | [Cuerpos 2](audit/deformation/bodies-2.webp) |
| 11–15 | [Vistas 3](audit/deformation/views-3.webp) | [Cuerpos 3](audit/deformation/bodies-3.webp) |
| 16–20 | [Vistas 4](audit/deformation/views-4.webp) | [Cuerpos 4](audit/deformation/bodies-4.webp) |

- [19: detalle de espalda en torsión](audit/deformation/detail-19-neutral-back.webp): distingue el surco de deformación de una separación muscular fiable.
- [13: perfil sin banco](audit/deformation/detail-13-neutral-no-prop-left.webp): permite revisar masa glútea sin oclusión del prop.
- [Muestras móviles en Atlético](audit/deformation/mobile.webp): en esta escala se conserva el gesto general y se reduce aún más la lectura de detalles pequeños.
- [Métricas y hashes de las fuentes](audit/deformation/metrics.json): comprueban vigencia del asset/poses, sin puntuar calidad anatómica automáticamente.

## Verificación y alcance de entrega

`pnpm test` comprueba el GLB y la correspondencia de la evidencia con las poses actuales, además de la conservación de skeleton y morphs corporales. `pnpm build` verifica que la aplicación sigue compilando. Se comprobó también que el informe cubre los 18 grupos pedidos y que sus enlaces locales existen.

Esta fase cambia solo documentación. No se alteran malla, materiales, luces, cámara, UI, poses, editor, animaciones ni temporizador. La clasificación visual es una evaluación documentada; los tests numéricos no la certifican automáticamente.
