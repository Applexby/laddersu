# Laddersu

Panel para After Effects (2024–2026, Windows) que convierte el SRT palabra por palabra de Premiere en subtítulos
animados: escalera, caja que recorre o una línea. Incluye vista previa en vivo, menú de clic derecho en cascada,
bibliotecas de composiciones y plantillas, sonidos por palabra y actualizaciones automáticas.

- **Descargar:** [Laddersu-Setup.exe](https://github.com/Applexby/laddersu/releases/latest/download/Laddersu-Setup.exe)
- **Web y guía:** carpeta `web/` (publicada en Vercel)

## Estructura

| Carpeta | Qué hay |
|---|---|
| `extension/` | El paquete CEP que se instala en After Effects: el panel **Laddersu** |
| `app/` | App de escritorio **Laddersu** (C#, .NET Framework 4.5+) para buscar e instalar actualizaciones |
| `installer/` | Instalador de Inno Setup (`laddersu.iss`) |
| `web/` | Sitio estático de descarga y guía (Vercel, sin compilación) |
| `tests/` | Pruebas en Node (no necesitan After Effects) |
| `tools/` | Utilidades de publicación |
| `.github/workflows/release.yml` | Compila y publica cada versión |

## Publicar una versión

1. Sube la versión en `extension/version.json`, `extension/CSXS/manifest.xml` `HOST_VER` en `extension/js/model.js`,
   `ES.VERSION` en `extension/jsx/engine.js` y `ES_VERSION` en `extension/jsx/host.jsx`
   (`node tools/check-version.js` comprueba que coincidan).
2. Escribe sus novedades en `CHANGELOG.md` bajo `## [x.y.z]`.
3. Sube el cambio a `main`. Al cambiar `extension/version.json` se publica sola (también sirve subir la etiqueta
   `v0.6.1`, o lanzar el flujo a mano desde la pestaña Actions).

GitHub Actions corre las pruebas (también las de la app), compila la app `Laddersu.exe`, arma `laddersu-panel-x.y.z.zip`, compila `Laddersu-Setup.exe` y publica todo con un
`latest.json` (versión y huellas SHA-256). El panel de actualizaciones lee esa publicación. No hace falta ningún secreto:
el repositorio es público y el flujo usa el permiso propio de GitHub Actions.

## Pruebas

```
for f in tests/*.test.js; do node "$f"; done
```

La prueba de interfaz (`python3 tests/ui_test.py`) abre el panel en Chromium con After Effects simulado.

## Lo que solo se puede comprobar en After Effects

Las pruebas usan un After Effects simulado (`tests/fakeae.js`). Esto queda para probar a mano:

- **Estilo APPLEXBY:** que la fuente (por defecto `Archivo-Bold`) esté instalada y se aplique; el tracking (-60), el
  contorno blanco detrás del relleno y la separación entre palabras con la fuente real.
- **Una línea:** que entre con la animación de la edición y que el corte en dos líneas se vea equilibrado.
- **Entrada y salida por desenfoque:** curva de la animación y que el desenfoque llegue a 0.
- **Ocultar durante T2:** la expresión de opacidad en las capas de subtítulos (fundido de 0,12 s).
- **Sombra suave:** el efecto Sombra paralela con los valores del panel.
- **Sonidos propios:** que los .wav/.mp3 de `sounds/user` se importen y se coloquen en su tiempo.
- **Grupos de la biblioteca:** `groups.json` y `meta.json` en la carpeta real de la biblioteca.
- **App Laddersu:** aspecto en Windows (se probó en Mono/Linux), descarga, instalación silenciosa y que se vuelva a abrir.
- **Instalador:** que reemplace Escalera Subs, quite el panel viejo de actualizaciones, cree el acceso directo del
  escritorio y que el panel aparezca en Ventana › Extensiones.
