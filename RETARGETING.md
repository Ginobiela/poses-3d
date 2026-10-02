# Auditoría de las tres poses iniciales

Esta auditoría se hizo antes de ampliar el catálogo. Compara el GLB fuente `MakeHumanPoses.glb` (SHA-256 `58A1975A260EDDE6E217B8D1B0AF4194D06ADA365A192C7623A6E6A0BE4FFBCC`), el modelo local `human.glb`, `scripts/extract-makehuman-poses.py` y los tres JSON publicados.

## Resultado

Las poses `Standing 01`, `Fight 01` y `Run 01` **fueron retargeteadas mediante un mapa de huesos**, no aplicadas por coincidencia parcial. El paquete fuente declara `skeleton: "Quaternius UAL"`, contiene 65 huesos y 99 clips. Nuestro GLB tiene 52 huesos `mixamorig:*` y no contiene clips. Los tres JSON finales contienen los 52 nombres de destino y quaternions locales de norma aproximadamente 1 (desviación menor de `7e-8` por redondeo).

El script actual mapea `pelvis`→`Hips`; tres segmentos de columna→`Spine`, `Spine1`, `Spine2`; cuello y cabeza; clavículas; brazos, antebrazos y manos; muslos, piernas, pies y dedos del pie; además de dedos de la mano. El destino no tiene un hueso separado llamado `UpperChest`: `Spine2` cumple la función de pecho alto. Los huesos hoja adicionales de Quaternius no tienen equivalente y se omiten.

## Conversión existente

1. Lee los dos GLB glTF 2.0 y sus jerarquías. No necesita inferir la compatibilidad por nombre: utiliza la tabla `SOURCE_TO_TARGET`.
2. Obtiene las rotaciones y posiciones mundiales de reposo de cada jerarquía. En el GLB fuente, `root` tiene una rotación de −90° en X, que convierte su rig Z-up en la escena glTF Y-up. El modelo destino ya está en Y-up. Ambas escenas son de mano derecha; la conversión no introduce reflexión ni inversión de mano.
3. Toma el primer valor de cada pista de **rotación** del clip. Los clips fuente tienen 65 pistas de rotación, 65 de traslación y 65 de escala; las dos últimas se ignoran en la versión inicial.
4. Para cada hueso calcula `deltaMundo = rotaciónFuentePosada × inversa(rotaciónFuenteReposo)`. Calcula además una rotación que alinea la dirección del hueso destino en reposo con la dirección del hueso fuente en reposo. Esto compensa en parte la T-pose fuente frente a la A-pose del modelo.
5. La rotación mundial deseada del hueso destino es `deltaMundo × alineaciónReposo × rotaciónDestinoReposo`. Se transforma de vuelta a rotación local con la inversa de la rotación mundial ya posada de su padre. Se exporta como `[x, y, z, w]` bajo el nombre `mixamorig:*`.
6. En el navegador, `PoseManager` aplica esos JSON directamente. No ejecuta el retargeting al cambiar de pose. `CharacterLoader` escala a 1,8 m, centra el cuerpo y lo apoya en Y=0 después de aplicar cada pose.

## Límites que hay que corregir o revisar antes de migrar otras poses

- La alineación de un hueso usa solo su dirección principal. Esa dirección no fija la rotación alrededor de su propio eje. En hombros, antebrazos, manos y pies puede aparecer torsión visible; cada pose necesita inspección visual.
- La conversión ignora traslaciones y escala animadas. La pelvis conserva la posición de reposo del GLB destino y el visor coloca el punto más bajo del cuerpo en el suelo. Una pose sentada puede quedar sobre el suelo en lugar de apoyada en un asiento; una pose aérea puede perder su altura original.
- El primer valor de una pista se usa como pose estática. Los clips elegidos son poses o fotogramas estáticos del paquete MakeHuman; para animaciones en movimiento hay que escoger explícitamente el instante y evaluar la interpolación.
- Las tres poses se revisaron en vistas frontal de escritorio y móvil. Eso confirma siluetas completas y apoyo visible, pero no demuestra ausencia de intersecciones en todos los ángulos. El catálogo nuevo se revisará también de lado y tres cuartos.

Fuente de licencia y procedencia: [manifiesto de Cinevva](https://app.cinevva.com/rigging/clips/MakeHumanPoses.json) (`CC0-1.0` para el paquete y las poses) y [licencia de assets de MakeHuman/MPFB2](https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md). El modelo local tiene su origen y licencia en `public/models/human/SOURCE.txt` y `LICENSE.txt`.

## Migración de las 17 restantes

`scripts/convert_pose.py` usa el mapa explícito anterior para convertir un clip a un JSON del rig Mixamo durante el desarrollo. Evalúa el fotograma seleccionado, interpola rotaciones y traslaciones cuando hay varios fotogramas, comprueba que los huesos secundarios no introduzcan traslaciones ni escalas incompatibles, y exporta la posición de la pelvis junto con las rotaciones. La traslación se obtiene en coordenadas mundiales después de la conversión Z-up→Y-up del nodo raíz y se escala según la distancia pelvis-cabeza de los dos rigs. Los quaternions se calculan respecto a la jerarquía destino y se normalizan antes de exportar.

La alineación de reposo sigue usando la dirección de cada hueso. La inspección visual frontal y lateral de las 20 poses completas controla la torsión que una sola dirección no puede fijar. Las poses sentadas que presuponen una silla conservan su altura: se muestran sin utilería para no alterar el visor. Las poses elegidas y sus licencias individuales figuran en `public/poses/manifest.json`.

`scripts/build_catalog.py` regenera el catálogo seleccionado a partir del GLB fuente y del manifiesto de licencias descargados durante el desarrollo. Después se ejecuta `pnpm validate:poses`. El navegador recibe únicamente los JSON convertidos y jamás calcula el retargeting. Las 17 entradas nuevas sustituyen, una por una, los antiguos identificadores 02, 03, 05, 06, 08–20; los identificadores 01, 04 y 07 conservan sus clips de origen. El sistema procedural ya había sido retirado en una revisión anterior; después de validar las 20 poses GLB/JSON, no quedan entradas que dependan de él.
