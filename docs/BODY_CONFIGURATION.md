# Persistencia corporal — Fase 5

El visor guarda automáticamente el preset corporal y los ajustes manuales en `localStorage`, en la clave independiente `poses.body.v1`. Al crear el personaje, restaura esa configuración sobre los mismos SkinnedMesh después de cargar el GLB. El panel sincroniza selector, sliders y salidas cuando termina la carga.

## Formato

```json
{
  "version": 1,
  "preset": "muscular",
  "manual": {
    "muscle": 0,
    "weight": -0.3,
    "height": 0.02,
    "legs": -0.2
  }
}
```

`preset` conserva el preset base real: neutral, lean, athletic o muscular. `manual` contiene únicamente los controles que se ajustaron después, con sus valores aplicados. «Personalizado» es el estado visual cuando hay overrides, no un preset que se almacene.

Se restaura primero el preset completo, incluidos los targets regionales que no tienen un slider propio; luego se aplican los ajustes manuales. Así, musculatura general en 0 sobre Musculoso conserva las influencias regionales del preset, igual que antes de cerrar el sitio. Los valores cero y negativos se guardan explícitamente.

## API y flujo

- `loadBodyConfiguration()`: devuelve una configuración validada o Neutral cuando no hay datos, el JSON es inválido o no se puede leer el almacenamiento.
- `validateBodyConfiguration(value)`: comprueba versión, nombre de preset, objeto de overrides, IDs conocidos, números finitos y límites actuales de los sliders. Devuelve una copia. Los datos fuera de rango se rechazan, sin extrapolar morphs.
- `saveBodyConfiguration(configuration)`: valida antes de guardar. Devuelve false si el navegador rechaza la escritura; el personaje continúa funcionando.
- `restoreBodyConfiguration(controller, configuration)`: valida configuración y controles compatibles antes de aplicar preset y overrides; modifica únicamente influences.
- `viewer.getBodyConfiguration()`: copia del preset base y overrides actuales.
- `viewer.resetBody()`: aplica Neutral, limpia todos los controles expuestos y pesos de presets, y guarda `{ version: 1, preset: 'neutral', manual: {} }`.

Elegir un preset guarda sus valores base sin overrides anteriores. Cada evento de slider guarda el valor que efectivamente aplicó el controlador. No se escribe por frame ni al cambiar cámara, pose o animación. El almacenamiento es pequeño: ID del preset y hasta diez valores, sin geometría ni JSON de poses.

## Restablecer cuerpo

El botón se encuentra al final de «Tipo de cuerpo» y se habilita cuando el personaje está listo. Restablece selector y sliders a Neutral y reemplaza la configuración guardada, por lo que al abrir otra práctica o recargar no reaparecen los ajustes anteriores.

No borra poses personalizadas ni otros datos de localStorage. Tampoco modifica skeleton, pose editada, historial del editor, articulación seleccionada, props, cámara, luces o AnimationMixer. La exportación de poses conserva su formato anterior.

Si una escritura falla, la UI informa «Cambios aplicados. No se pudo guardar la configuración corporal». Tanto los sliders como reset siguen operando en el visor; solo la persistencia queda sin completar. Los datos corruptos se ignoran sin impedir cargar el humano.

## Pruebas

- Seis tests del almacenamiento: estado inicial independiente, preset y valores negativos/cero, JSON/versiones/IDs/rangos inválidos, rechazo antes de sobrescribir, almacenamiento bloqueado y conservación de otros datos al guardar Neutral.
- Dos pruebas adicionales con el GLB real: restauración exacta de todas las influences y la misma superficie en vértices de los cuatro meshes; recuperación de Neutral y ausencia de escrituras con datos inválidos.
- Navegador en escritorio y móvil: preset conservado tras recarga, ajustes manuales conservados tras otra recarga, selector/sliders correctos, reset persistido y otras claves intactas. Una solicitud del GLB por carga de página, ninguna adicional por edición o reset.
- Prueba de datos corruptos y escritura bloqueada en el navegador: visor, edición, reset y temporizador siguen funcionando.
- Prueba existente del visor ampliada: reset no altera pose editada, historial, selección, props, cámara, luces o instancias del personaje/editor/mixer.

```sh
pnpm test
pnpm build
pnpm exec playwright test e2e/body-persistence.spec.ts e2e/body-presets.spec.ts e2e/rigged-character.spec.ts e2e/animations.spec.ts
```

No se añadieron backend, cuentas, assets ni dependencias. Se mantiene el build estático para GitHub Pages. La auditoría de deformaciones de las 20 poses pertenece a Fase 6 y no forma parte de esta implementación.
