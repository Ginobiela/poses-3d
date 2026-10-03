# Modo visual Anatomía — Fase 11

Durante la práctica, abrir **Cámara y materiales → Material → Anatomía**. El selector ofrece Normal, Gris, Silueta, Anatomía y Wireframe. Volver a Normal restaura los materiales originales del GLB, incluidas sus referencias y arrays.

## Material y alcance

Anatomía utiliza un `MeshStandardMaterial` compartido por los cuatro SkinnedMesh existentes:

| Parámetro | Valor |
| --- | --- |
| Color | `#90969c`, gris neutro ligeramente frío |
| Roughness | `0.48` |
| Metalness | `0` |
| Texturas, normal maps y displacement maps | Ninguno |

El gris mejora la separación del cuerpo respecto del fondo cálido. La roughness moderada ayuda a observar transiciones de volumen con las luces actuales. Se conserva la iluminación, exposición y tone mapping existentes; los presets de iluminación corresponden a Fase 12.

No se añaden relieves, músculos ni correctivos. Las limitaciones de superficie documentadas en [ANATOMY_AUDIT.md](ANATOMY_AUDIT.md) permanecen: el material permite observar la geometría disponible, pero no representa separaciones musculares ausentes.

## Conservación del estado

`ReferenceMaterials` crea el material una sola vez por visor y lo reutiliza al alternar modos. Cambiar material conserva el personaje, geometría, skinning, skeleton, morph influences, pose, editor, historial, props, cámara, OrbitControls, temporizador y AnimationMixer. No descarga nuevamente el GLB ni las poses. `dispose()` libera el material junto a los otros materiales de referencia.

`MATERIAL_MODES` centraliza las opciones y el tipo TypeScript para mantener el selector sincronizado. No se añade persistencia del modo visual ni otra arquitectura de carga.

## Verificación

- `pnpm test`: 56 tests aprobados en 15 archivos. La prueba del material comprueba parámetros, reutilización, preservación de morphs/rig/geometría, restauración exacta y liberación.
- `pnpm exec playwright test e2e/anatomy-material.spec.ts e2e/rigged-character.spec.ts`: 5 tests aprobados. Escritorio de 1280 px y móvil de 390 px; alternancia de modos, cambio de pose y cuerpo, edición, temporizador y consola sin errores. Una solicitud del GLB.
- El harness de desarrollo verifica igualdad de pose editada, cámara, luces, exposición, props e instancias antes/después, además de conservar un frame de `walk-01` al 43 % y la reproducción. No añade interfaces de debugging a producción.
- Capturas Normal/Anatomía revisadas en escritorio y móvil: mejora el contraste del cuerpo contra el fondo; la musculatura sigue siendo suave. Capturas locales en `test-results/`, fuera del repositorio.
- `pnpm build`: aprobado; JS 702.31 kB, incremento de 0.09 kB respecto de Fase 10, CSS 13.64 kB sin cambios. Sin nuevas dependencias ni assets. Permanece la advertencia previa de chunk superior a 500 kB.
