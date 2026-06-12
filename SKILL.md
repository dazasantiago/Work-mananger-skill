# Actions

Sistema de gestión de trabajo integrado con Notion. Dos módulos principales: **session management** y **project management**.

## Regla global: Notion siempre via script

Toda interacción con Notion se hace ejecutando un script Python de la carpeta `scripts/`. Claude nunca llama al Notion MCP directamente — lee el output del script y actúa sobre él.

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\<script>.py"
```

El token de Notion está en `.env` dentro de la skill. Los scripts lo cargan automáticamente.

## Regla global: Emoji en el título al crear

Al crear una **task**, **project** o **session** en Notion, el título
(campo `task` / `project` / `title` que se envía al script) siempre empieza
con un emoji:

- **Task / Project**: Claude elige el emoji según el tema de la entrada (ej.
  🐛 bug, 🎨 diseño, 📝 contenido/escritura, 🚀 lanzamiento, 💡 idea, 🔧
  configuración/infra, 📚 estudio, 💰 finanzas). Si ninguno calza, usar 📌.
- **Session**: siempre ⏱️ (cronómetro), sin excepción.

Ejemplos: `🐛 Arreglar bug de login`, `⏱️ Session — 2026-06-08 — Mixed`.

## Infraestructura compartida

| Recurso | Ruta |
|---------|------|
| Token Notion | `skills/actions/.env` |
| Scripts | `skills/actions/scripts/` |
| Widget de sesión | `skills/actions/widget/` (Tauri + React) |

**Antes de tocar cualquier archivo dentro de `skills/actions/widget/`**, leer
`skills/actions/widget/DEV.md` — explica cuándo (y cuándo NO) recompilar el
binario, y cómo levantar una instancia de prueba.

### Database IDs (Notion)

| Base | ID |
|------|----|
| Projects | `8a19177c80954452984197b55c8aa950` |
| Tasks | `e882c0f07df84a3ca7742a67f264cd27` |
| Sessions | `25be474933014a8eaf6bc951969f3b3f` |

## Router de intención

Lee **solo** el módulo que corresponde a la intención del usuario.

### Session Management

Leer primero `modules/session-management.md` para el router, luego el archivo de la acción correspondiente en `modules/session/`.

| Intención del usuario | Archivo |
|-----------------------|---------|
| Empezar a trabajar, iniciar sesión, "vamos a trabajar" | `modules/session/start.md` |
| Terminar sesión, cerrar, "ya acabé", cierre desde el widget | `modules/session/finish.md` |
| Cancelar sin guardar, "me equivoqué", "no quiero registrar esto" | `modules/session/cancel.md` |

### Project Management → `modules/project-management.md`

| Intención del usuario | Acción |
|-----------------------|--------|
| Agregar, editar, completar o eliminar tareas | **task CRUD** |
| Agregar o actualizar proyectos, cambiar estado, capturar idea | **project CRUD** |
| Ver qué hay pendiente sin empezar sesión | **quick review** |

## Idioma y estilo

- Santiago habla español con términos técnicos en inglés
- Responder en español, directo y conciso
- Tablas para mostrar tareas o proyectos
- Nunca pedir información que el script ya devuelve
