# Laddersu

Panel para After Effects (2024–2026, Windows) que convierte el SRT palabra por palabra de Premiere en subtítulos
animados: escalera, caja que recorre o una línea. Incluye vista previa en vivo, menú de clic derecho en cascada,
bibliotecas de composiciones y plantillas, sonidos por palabra y actualizaciones automáticas.

- **Descargar:** [Laddersu-Setup.exe](https://github.com/Applexby/laddersu/releases/latest/download/Laddersu-Setup.exe)
- **Web y guía:** carpeta `web/` (publicada en Vercel)

## Estructura

| Carpeta | Qué hay |
|---|---|
| `extension/` | El paquete CEP que se instala en After Effects: panel **Laddersu** y panel **Laddersu · Actualizaciones** |
| `installer/` | Instalador de Inno Setup (`laddersu.iss`) |
| `web/` | Sitio estático de descarga y guía (Vercel, sin compilación) |
| `tests/` | Pruebas en Node (no necesitan After Effects) |
| `tools/` | Utilidades de publicación |
| `.github/workflows/release.yml` | Compila y publica cada versión |

## Publicar una versión

1. Sube la versión en `extension/version.json`, `extension/CSXS/manifest.xml` y `HOST_VER` en `extension/js/model.js`
   (`node tools/check-version.js` comprueba que coincidan).
2. Escribe sus novedades en `CHANGELOG.md` bajo `## [x.y.z]`.
3. Crea la etiqueta y súbela: `git tag v0.6.1 && git push origin v0.6.1`.

GitHub Actions corre las pruebas, arma `laddersu-panel-x.y.z.zip`, compila `Laddersu-Setup.exe` y publica todo con un
`latest.json` (versión y huellas SHA-256). El panel de actualizaciones lee esa publicación. No hace falta ningún secreto:
el repositorio es público y el flujo usa el permiso propio de GitHub Actions.

## Pruebas

```
for f in tests/*.test.js; do node "$f"; done
```
