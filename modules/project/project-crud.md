# Project CRUD

## Cuándo se ejecuta

El usuario pide agregar/actualizar un proyecto, cambiar su estado, capturar
una idea, o eliminar un proyecto, fuera del flujo de sesión.

## Data sources (IDs conocidos)

| Colección | URL |
|-----------|-----|
| Projects | `collection://7cb2470f-41e2-44d2-927e-7603c8ed80e2` |
| Tasks | `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be` |

## Schema de Projects (formato SQLite para MCP)

| Campo Notion | SQLite key | Tipo |
|---|---|---|
| Project (título) | `Project` | TEXT |
| Type | `Type` | TEXT — "Software Development" \| "Content Creation" |
| Status | `Status` | TEXT — "Active" \| "Backlog" \| "Idea" |
| Context | `Context` | TEXT |

## 1. Resolver referencias por nombre

Cuando el usuario menciona un proyecto por nombre:
- `notion-search` · query: nombre del proyecto · data_source_url: `collection://7cb2470f-41e2-44d2-927e-7603c8ed80e2` · content_search_mode: `workspace_search` · page_size: 10 · max_highlight_length: 0

Si hay varias coincidencias o ninguna, presentar opciones en tabla corta y preguntar.

## 2. Crear proyecto / capturar idea

El usuario dice "agrega un proyecto...", "anota la idea de...", "quiero empezar a trabajar en...".

Datos:
- `Project` (título, sin emoji) — requerido
- emoji (ícono de página) — requerido; elegir según el tema (ver "Regla global: Emoji como ícono de página al crear" en `SKILL.md`)
- `Status` — si dice "es una idea" o no especifica → omitir (default "Idea"). "ya lo voy a empezar" → "Active". "lo dejo para después" → "Backlog"
- `Type` — preguntar solo si no es obvio del contexto; si no se puede inferir, omitir
- `Context` — capturar cualquier descripción o nota que el usuario haya dado

Acción de bajo riesgo — ejecutar directo sin confirmación previa:
- `notion-create-pages`
  - parent: `{"type": "data_source_id", "data_source_id": "7cb2470f-41e2-44d2-927e-7603c8ed80e2"}`
  - pages[0].icon: emoji elegido
  - pages[0].properties: campos con formato de la tabla de schema (arriba)

Confirmar: `Proyecto "<Project>" creado (status: <Status>) ✓`

## 3. Editar / cambiar estado

Resolver el proyecto por nombre (paso 1). Mapear lo que pide el usuario:

| Pide el usuario | Campo |
|-----------------|-------|
| "pasa X a Active/Backlog" | `Status` |
| "cambia el tipo a..." | `Type` |
| "actualiza la descripción/contexto" | `Context` |
| "renombra el proyecto a..." | `Project` |

Confirmar en una línea antes de ejecutar:
```
Actualizar proyecto "<Project>": <campo> → <nuevo valor>
```

- `notion-update-page` · page_id: ID del proyecto · command: `update_properties` · properties: solo los campos que cambian

Confirmar: `Proyecto "<Project>" actualizado ✓`

## 4. Eliminar proyecto

El usuario dice "elimina/borra el proyecto X". Resolver por nombre (paso 1).

**Buscar tareas asociadas** (para advertir al usuario):
- `notion-search` · query: nombre del proyecto · data_source_url: `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be` · content_search_mode: `workspace_search` · page_size: 25 · max_highlight_length: 0

**Confirmar siempre antes de eliminar:**

Sin tareas asociadas encontradas:
```
¿Eliminar el proyecto "<Project>"?
Esta acción no se puede deshacer fácilmente.
```

Con tareas encontradas:
```
¿Eliminar el proyecto "<Project>"?
Las siguientes tareas están asociadas a este proyecto:
  - <Task 1>
  - <Task 2>
Estas tareas NO se eliminarán, pero quedarán sin proyecto asignado.
Esta acción no se puede deshacer fácilmente.
```

Esperar confirmación. El MCP de Notion no soporta enviar páginas a la papelera — usar el script:

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\project-delete.py" "<json>"
```

```json
{"id": "notion-page-id"}
```

Confirmar: `Proyecto "<Project>" eliminado ✓`
