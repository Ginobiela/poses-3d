# Estudio de poses

Sitio en español para practicar dibujo de figura con 20 poses 3D originales y sesiones cronometradas. Inspirado en el ejercicio de 30 segundos de Posemaniacs, con un maniquí y una interfaz propios.

## Usar el sitio

1. Elegí 30 segundos, 1 minuto, 1 minuto y medio, 2 minutos, 5 minutos o una duración entre 5 y 1800 segundos.
2. Elegí la cantidad de poses, categoría, vista inicial y sonido.
3. Iniciá la práctica. Podés rotar el modelo con el mouse o con el dedo y hacer zoom con la rueda o el gesto de pinza.
4. Usá **Espacio** para pausar y **→** para pasar a la siguiente pose. Al final aparece un resumen.

El sitio no guarda dibujos ni crea cuentas. Las preferencias se guardan localmente en el navegador.

## Desarrollo local

Requiere Node.js 22 o superior y pnpm 11. Desde la carpeta del proyecto:

```sh
pnpm install
pnpm dev
```

Abrí la URL que muestra Vite, normalmente `http://127.0.0.1:5173/poses-3d/`.

Para comprobar el proyecto:

```sh
pnpm test
pnpm build
pnpm test:e2e
```

La prueba de navegador usa Google Chrome instalado en el equipo. El código de aplicación se compila en `dist/`.

## Publicación

El proyecto se publica desde GitHub Actions en GitHub Pages. `vite.config.ts` usa la base `/poses-3d/` para que las rutas funcionen en el repositorio. Al enviar cambios a `main`, el flujo ejecuta pruebas, compila y publica `dist/`. La fuente de Pages debe ser **GitHub Actions**.

## Alcance del modelo

El maniquí está construido con geometrías de Three.js. Sirve como referencia de gesto y silueta; algunas posturas complejas siguen siendo aproximaciones. Las poses sentadas incluyen un banco para mostrar el apoyo. Para estudiar anatomía detallada, será necesaria una futura biblioteca de modelos revisados por un artista. Procedencia de recursos: [ASSET_LICENSES.md](ASSET_LICENSES.md).

## Estructura

- `src/catalog/poses.ts`: veinte poses y selección aleatoria.
- `src/viewer/viewer.ts`: maniquí, escena, cámara y controles.
- `src/session/engine.ts`: reloj y estados de práctica.
- `src/main.ts`: pantallas y acciones del usuario.
- `src/storage/preferences.ts`: preferencias locales.
- `e2e/`: prueba de una sesión completa.
