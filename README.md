# Estudio de poses

Sitio en español para practicar dibujo de figura con un humano 3D riggeado, poses separadas del modelo y sesiones cronometradas. El catálogo contiene actualmente tres poses.

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

El visor usa un modelo humano GLB con esqueleto Mixamo de 52 huesos. Las poses se guardan como JSON independientes del modelo y se cargan para cada sesión. No se muestran figuras procedurales. Procedencia de recursos: [ASSET_LICENSES.md](ASSET_LICENSES.md). Formato y ampliación del catálogo: [POSES.md](POSES.md).

## Estructura

- `public/poses/manifest.json`: catálogo de poses disponibles.
- `src/catalog/poses.ts`: lectura del catálogo y selección aleatoria.
- `src/viewer/viewer.ts`: personaje riggeado, escena, cámara y controles.
- `src/session/engine.ts`: reloj y estados de práctica.
- `src/main.ts`: pantallas y acciones del usuario.
- `src/storage/preferences.ts`: preferencias locales.
- `e2e/`: prueba de una sesión completa.
