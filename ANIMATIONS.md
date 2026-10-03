# Animaciones y referencias de dibujo

El personaje sigue cargándose con `CharacterLoader` y las poses estáticas con `PoseManager`. `AnimationLibrary` descarga el manifiesto y conserva cada clip en memoria una vez solicitado. `AnimationPlayer` usa un `AnimationMixer` exclusivo del personaje; cambia acciones sin cargar otro modelo. Al cambiar a una pose, elimina las acciones y sus bindings. No hay retargeting en el navegador.

## Assets y licencia

Se incluyen seis movimientos reales de **Quaternius Universal Animation Library 1**: `Walk_Loop`, `Sprint_Loop`, `Kick`, `Punch_Jab`, `Jump_Loop` e `Idle_Loop`. Quaternius declara CC0 en su [página oficial](https://quaternius.itch.io/universal-animation-library) y [catálogo](https://quaternius.com/packs/universalanimationlibrary.html). Cinevva distribuye el paquete y describe su procedencia en [Animations](https://app.cinevva.com/tools/animations). El archivo fuente y su SHA-256 están en `public/animations/SOURCE.txt`; el aviso CC0 y el enlace al texto legal están en `LICENSE.txt`. Los clips publicados contienen únicamente datos de animación, sin otra malla humana.

No se incorporan recursos con licencia incierta. Para nuevos assets, registrar autor, enlace, licencia que permita redistribución y hash del archivo fuente antes de convertir o publicar.

## Formato y skeleton

`public/animations/manifest.json` contiene `id`, `name`, `category`, `file`, `source`, `sourceClip`, `license`, `skeleton: "mixamorig"` y `loop`. Los archivos JSON siguen `THREE.AnimationClip.toJSON`: nombre, duración en segundos y tracks. Cada track incluye `name`, `type`, `times` y `values`. Los tracks quaternion usan valores locales absolutos `[x,y,z,w]` y nombres como `mixamorig:LeftArm.quaternion`. La pelvis tiene un track vector `mixamorig:Hips.position`.

El rig esperado es el del GLB local, con 52 huesos y su postura de reposo. Un nombre Mixamo compartido no garantiza compatibilidad con otro modelo. El reproductor solo adapta la sintaxis de nombres que sanitiza GLTFLoader; no convierte orientaciones ni bind poses. También acepta un GLB separado con exactamente un AnimationClip compatible; su escena no se incorpora al visor.

## Añadir una animación

Para el rig fuente Quaternius UAL del paquete auditado:

```sh
pnpm convert-animation ruta/UAL1.glb public/animations/walk/nueva.json --clip Walk_Loop --name nueva
pnpm validate:animations
```

La herramienta requiere Python, NumPy y SciPy y reutiliza el mapa explícito de huesos del retargeting existente. Lee las jerarquías, rotaciones de reposo y direcciones de huesos de ambos GLB. Por muestra, calcula las rotaciones globales fuente, su diferencia respecto del reposo y la orientación destino; las vuelve a expresar respecto del padre destino. La transformación raíz del GLB fuente convierte Z-up a Y-up. La traslación de pelvis se transforma a ejes del mundo y se escala según la distancia pelvis–cabeza de ambos rigs.

Esta herramienta está destinada al paquete UAL inspeccionado, no a cualquier rig: requiere muestras sincronizadas e interpolación LINEAR, rechaza escala animada y traslaciones relevantes fuera de la pelvis. Otro origen necesita una adaptación explícita y revisión de sus ejes, jerarquía y reposo. Las pequeñas traslaciones de huesos auxiliares del paquete no se trasladan al rig destino; sus longitudes se mantienen.

Añadir la entrada al manifiesto, ejecutar la validación y revisar el clip frontal y lateral a 0%, 50%, 100% y durante reproducción. Comprobar hombros, torsión de brazos, rodillas, pies y contacto con el suelo. Los seis clips iniciales suman aproximadamente 786 KB y se descargan individualmente.

## Reproducción y congelado

Abrir **Animaciones**, elegir movimiento y usar **Reproducir**, velocidad y loop. Arrastrar el slider pausa y evalúa el instante seleccionado; el texto muestra tiempo actual y duración. Detener recupera la última pose estática.

**Usar este frame como pose** captura los 52 quaternions normalizados y las posiciones locales de todos los huesos, elimina la acción y aplica el resultado con `PoseManager`. El frame ya no depende del mixer. Se puede editar con las herramientas existentes o exportar como `mi-pose.json`. `modelPosition` conserva la ubicación del personaje, incluso en frames de salto; `hipsPosition` y `positions` conservan la pelvis local. Reset y undo/redo mantienen esa ubicación. Los frames congelados no se vuelven a apoyar automáticamente en el suelo al editar.

## Mis poses y sesiones

**Guardar como pose personalizada** conserva la referencia en `localStorage` (`poses.custom.v1`) con id, nombre, categoría, fecha, huesos, pelvis y procedencia opcional del frame. Mis poses permite cargar, renombrar, eliminar, exportar e importar JSON. Las poses del catálogo se guardan con claves internas distintas, por lo que un nombre personalizado igual no sustituye al original. Son datos del navegador actual; exportarlos permite conservar una copia o trasladarlos a otro dispositivo.

La configuración admite duración y cantidad personalizadas, orden aleatorio, cámara aleatoria e inclusión de poses locales. Si la cantidad supera las referencias disponibles, el catálogo se recorre en ciclos. Standing/Sitting/Action/Dynamic usan las categorías del manifiesto; Run y Fight seleccionan las referencias existentes de carrera y guardia. Custom usa Mis poses.

`session/plans.ts` describe bloques de cantidad y segundos. Gesture Drawing expande 10×30 s, 5×60 s, 3×120 s y 2×300 s como una sesión de 20 referencias y 26 minutos. `SessionEngine` conserva su constructor anterior y acepta opcionalmente un calendario de duraciones. Anterior, siguiente y finalizar actúan sobre la sesión; explorar animaciones o cargar una pose personal pausa el temporizador para poder trabajar con la referencia.

## Cámara, material y comprobaciones

Los ocho presets cambian posición y target de OrbitControls. Las focales 24/35/50/85 mm usan un sensor vertical equivalente de 24 mm para calcular `camera.fov`; mantienen la distancia física. Con focal larga puede hacer falta alejar manualmente la cámara para encuadrar todo el cuerpo. Gris, Silueta y Wireframe usan materiales temporales; Normal restaura los originales.

Los controles avanzados están en paneles desplegables. En móvil hay además un slider compacto sobre el visor para buscar un frame sin perder de vista al personaje. Las pruebas cubren búsqueda a distintos porcentajes y velocidades, congelado independiente, exportación y recarga, normalización, almacenamiento, materiales, cámaras y sesiones progresivas. Las pruebas de navegador revisan clips reales, caché de clips, una carga del GLB, consola, edición y pantallas móviles. Ejecutar `pnpm test`, `pnpm test:e2e`, `pnpm build` y `pnpm validate:animations` antes de publicar.
