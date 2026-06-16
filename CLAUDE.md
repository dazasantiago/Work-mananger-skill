# Skill: actions

Sistema de gestión de trabajo de Santiago integrado con Notion. La entrada
para Claude es [SKILL.md](SKILL.md) — este archivo documenta la estructura
interna del directorio para quien (o lo que) trabaje en el código.

## Estructura

```
actions/
├── SKILL.md                    # Router de intención, leído por Claude al invocar /actions
├── .env                         # Token de Notion (NOTION_TOKEN)
├── modules/                     # Instrucciones de los flujos (en español, para Claude)
│   ├── session-management.md    # Router del módulo de sesiones
│   ├── session/
│   │   ├── start.md              # Iniciar sesión: brief, plan, crear en Notion, lanzar widget
│   │   ├── finish.md              # Cierre manual (el cierre normal lo hace el widget solo)
│   │   └── cancel.md              # Cancelar sesión sin guardar
│   ├── project-management.md    # Router del módulo de project management
│   └── project/
│       ├── task-crud.md          # Crear/editar/completar/eliminar tasks ad-hoc
│       ├── project-crud.md       # Crear/editar/eliminar proyectos, capturar ideas
│       └── quick-review.md       # Ver pendientes agrupados por proyecto, sin sesión
├── scripts/                     # Scripts Python — solo para session management y deletes
│   ├── notion_client.py          # Cliente compartido: DB IDs, helpers de query/update
│   ├── session/
│   │   ├── session-fetch-brief.py  # Junta tasks/proyectos/última sesión para el brief
│   │   ├── session-create.py       # Crea la sesión en Notion + marca tasks "En progreso"
│   │   ├── session-finish.py       # Cierra sesión: actualiza tasks, guarda summary
│   │   └── session-cancel.py       # Revierte tasks a su status previo, borra sesión
│   └── project/
│       ├── fetch-overview.py       # (obsoleto para uso runtime — referencia del schema)
│       ├── task-write.py           # (obsoleto para uso runtime — reemplazado por MCP)
│       ├── task-delete.py          # Borra (in_trash) una task — aún activo (MCP no soporta trash)
│       ├── project-write.py        # (obsoleto para uso runtime — reemplazado por MCP)
│       └── project-delete.py       # Borra (in_trash) un proyecto — aún activo (MCP no soporta trash)
└── widget/                       # Widget de escritorio (Tauri 2 + React + TS)
    ├── DEV.md                     # Cómo compilar/probar el widget — leer antes de tocarlo
    ├── dev-session.json           # Datos de prueba (fallback cuando no hay session.json)
    ├── src/                       # Frontend React
    └── src-tauri/                 # Backend Rust (Tauri)
```

## Flujo end-to-end

1. **Start** ([modules/session/start.md](modules/session/start.md)): Claude arma un plan de
   sesión con `session-fetch-brief.py`, lo aprueba el usuario, se crea la
   sesión con `session-create.py`, se escribe
   `C:\Users\dazas\.claude\session-current.json`, y se lanza
   `widget/src-tauri/target/release/widget.exe "<session-current.json>"`.
2. **Durante la sesión**: el widget es la interfaz — corre standalone, sin
   depender de Claude. Lee `session-current.json` vía el comando Tauri
   `get_session_data`.
3. **Finish**: el usuario cierra desde el widget. El frontend (`session.ts`,
   `buildFinishPayload`) genera el summary y arma el payload, y lo manda al
   comando Tauri `finish_session`, que ejecuta `session-finish.py` como
   subprocess. Todo esto ocurre **sin Claude**.
   [modules/session/finish.md](modules/session/finish.md) describe un flujo
   manual alternativo (por si el usuario pide cerrar la sesión hablando con
   Claude, o para recovery) — ⚠️ ese doc todavía describe la arquitectura del
   widget viejo en Python (`session-close.json`, "Python genera el summary").
   Si se usa ese flujo, ajustar mentalmente: hoy el summary lo arma el
   frontend del widget Tauri, no un script Python.
4. **Cancel**: igual que finish pero vía `cancel_session` →
   `session-cancel.py`, revierte tasks a `prev_status` y borra la sesión de
   Notion.

## Project Management (MCP)

El módulo de project management usa el **Notion MCP** directamente en lugar de scripts Python, porque sus operaciones son simples (una sola entidad a la vez) y no requieren fetching paralelo:

- **Read** (quick-review, resolución de nombres): `notion-search` con `data_source_url: collection://...`
- **Create**: `notion-create-pages` con `data_source_id` como parent
- **Update**: `notion-update-page` con `command: update_properties`
- **Delete**: sigue usando `task-delete.py` / `project-delete.py` (el MCP no soporta `in_trash`)

Data source URLs conocidas (ver también `scripts/notion_client.py` para IDs):
- Tasks: `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be`
- Projects: `collection://7cb2470f-41e2-44d2-927e-7603c8ed80e2`

Los scripts `fetch-overview.py`, `task-write.py`, `project-write.py` quedan en el repo como referencia del schema pero no se usan en runtime.

## Widget (Tauri + React)

Ver [widget/DEV.md](widget/DEV.md) para compilar y probar. Resumen:

- **Build correcto**: `npx tauri build --no-bundle` (NO `cargo build
  --release` directo — sin pasar por tauri-cli el binario queda apuntando al
  dev server de Vite y la ventana nunca carga).
- **Probar con datos de ejemplo**: correr
  `src-tauri/target/release/widget.exe` sin argumentos → usa
  `dev-session.json` (4 tareas de ejemplo).
- **Probar finish/cancel reales**: pasar un `session.json` válido como primer
  argumento.
- Backend Rust (`src-tauri/src/lib.rs`) expone 3 comandos: `get_session_data`,
  `finish_session`, `cancel_session` — los dos últimos son wrappers que
  invocan los scripts Python de `scripts/session/` como subprocess.
- Config de ventana en `tauri.conf.json`: 380px de ancho, sin decoraciones,
  always-on-top, oculta hasta que el frontend calcula su altura
  (`computeHeight`) y llama `setWindowSize` + `showWindow` (`src/window.ts`,
  efecto inicial en `src/App.tsx`).
- Modo compacto (dock a la derecha de la pantalla) y drag&drop de tareas con
  `framer-motion` (`Reorder`) en `BlockRow.tsx` / `TaskRow.tsx`.

## Limpieza reciente

Se eliminaron archivos obsoletos/sin uso:
- `session-widget.py`, `logo.ico`, `logo.png` (raíz) — implementación vieja
  del widget en Python/pywebview, reemplazada por `widget/` (Tauri).
- `widget/src/App.css`, `widget/src/components/SummaryView.tsx`,
  `widget/src/assets/react.svg`, `widget/public/tauri.svg`,
  `widget/README.md`, `scripts/__pycache__/` — sobrantes del template
  Vite/Tauri sin referencias en el código.
