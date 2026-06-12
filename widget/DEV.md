# Widget — guía de desarrollo

Stack: **Tauri 2 + React + TypeScript** (`src/`) con backend Rust (`src-tauri/src/lib.rs`).

## El binario ya compilado es el que se usa en producción

`modules/session/start.md` lanza directamente:

```
src-tauri/target/release/widget.exe "<path-a-session-current.json>"
```

**No hace falta compilar nada para iniciar/cerrar una sesión normal.** Ese
binario release ya existe y es el que el flujo de start usa siempre.

## Cuándo SÍ hay que recompilar

Solo cuando se edita código del widget (`src/**` o `src-tauri/src/**`) y se
quiere que el cambio se refleje en `target/release/widget.exe`.

```bash
cd widget
npx tauri build --no-bundle   # tsc + vite build -> dist/, luego cargo build --release
```

**No usar `cargo build --release` directo.** Sin pasar por tauri-cli, el
binario queda embebido apuntando a `devUrl` (`http://localhost:1420`) en vez
de a `dist/`, y la ventana nunca carga (pantalla "ERR_CONNECTION_REFUSED",
nunca llama a `showWindow()`, queda invisible con el tamaño por defecto del
config). `npx tauri build --no-bundle` setea las env vars correctas para que
se embeba `frontendDist`.

Esto reaprovecha el cache de dependencias de la build release anterior:
toma ~2-3 min (solo recompila tauri/tauri-macros/widget, no las ~370
dependencias completas).

## NO usar `npm run tauri dev`

`npm run tauri dev` arranca un **profile debug separado** (`target/debug/`),
que no comparte cache con `target/release/`. La primera vez compila las
~376 dependencias desde cero (~5 min) y deja un binario debug que nadie usa
en producción. Evitarlo salvo que se necesite hot-reload interactivo
explícitamente.

## Probar con datos de prueba

El frontend, si `invoke('get_session_data')` falla (p. ej. no se pasó un
path como argumento), cae automáticamente a `dev-session.json` (4 tareas de
ejemplo, bundleado en `dist/`). Por lo tanto, para lanzar una instancia de
prueba después de recompilar:

```powershell
& ".\src-tauri\target\release\widget.exe"   # sin argumentos -> dev-session.json
```

Para probar el flujo de finish/cancel reales hace falta pasar un
`session.json` válido como primer argumento (igual que en producción).
