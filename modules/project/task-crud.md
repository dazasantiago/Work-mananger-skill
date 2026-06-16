# Task CRUD

## Cuándo se ejecuta

El usuario pide agregar, editar, marcar como hecha, o eliminar una tarea,
fuera del flujo de sesión.

## Data sources (IDs conocidos)

| Colección | URL |
|-----------|-----|
| Tasks | `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be` |
| Projects | `collection://7cb2470f-41e2-44d2-927e-7603c8ed80e2` |

## Schema de Tasks (formato SQLite para MCP)

| Campo Notion | SQLite key | Tipo |
|---|---|---|
| Task (título) | `Task` | TEXT |
| Status | `Status` | TEXT — "Pendiente" \| "En progreso" \| "Listo" |
| Deadline | `date:Deadline:start` | TEXT — "YYYY-MM-DD" |
| Left (min) | `Left (min)` | REAL |
| Actual time (min) | `Actual time (min)` | REAL |
| Notes | `Notes` | TEXT |
| Project (relation) | verificar en schema | depende del schema |
| Parent Task (relation) | verificar en schema | depende del schema |

Para relation fields (`Project`, `Parent Task`), hacer `notion-fetch` al data source para ver el formato exacto si es necesario.

## 1. Resolver referencias por nombre

Cuando el usuario menciona una tarea por nombre:
- `notion-search` · query: nombre de la tarea · data_source_url: `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be` · content_search_mode: `workspace_search` · page_size: 10 · max_highlight_length: 0

Cuando necesita resolver un proyecto por nombre:
- `notion-search` · query: nombre del proyecto · data_source_url: `collection://7cb2470f-41e2-44d2-927e-7603c8ed80e2` · content_search_mode: `workspace_search` · page_size: 10 · max_highlight_length: 0

Si hay varias coincidencias o ninguna, presentar opciones en tabla corta y preguntar.

## 2. Crear tarea

Datos a confirmar con el usuario:
- `Task` (título, sin emoji) — requerido
- emoji (ícono de página) — requerido; elegir según el tema (ver "Regla global: Emoji como ícono de página al crear" en `SKILL.md`)
- `Project` — preguntar "¿A qué proyecto pertenece?" salvo que ya se indicó; si no aplica, omitir
- `Deadline` — opcional, preguntar solo si parece relevante
- `Left (min)` — opcional, preguntar "¿Cuánto tiempo estimas?" si quiere planearlo
- `Status` — si no dice nada, omitir (default "Pendiente"); si dice "ya empecé" → "En progreso"

Confirmar antes de crear:
```
Crear tarea "<Task>" en proyecto "<Proyecto>"
  Deadline: <fecha o "sin fecha">
  Estimado: <Left (min)> min
```

Si se incluye `Project` o `Parent Task`, obtener el schema primero para saber el formato exacto de relations:
- `notion-fetch` · id: `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be`

Crear:
- `notion-create-pages`
  - parent: `{"type": "data_source_id", "data_source_id": "72ab8e2f-35a1-4b46-97eb-84e8d6d792be"}`
  - pages[0].icon: emoji elegido
  - pages[0].properties: campos con formato de la tabla de schema (arriba)

Confirmar: `Tarea "<Task>" creada ✓`

## 3. Editar tarea

Resolver la tarea por nombre (paso 1). Mapear lo que pide el usuario:

| Pide el usuario | Campo |
|-----------------|-------|
| "cambia el deadline a..." | `date:Deadline:start` |
| "esto va a tomar más/menos tiempo" | `Left (min)` |
| "muévela al proyecto X" | `Project` (relation) — resolver proyecto vía search |
| "es subtarea de X" | `Parent Task` (relation) — resolver tarea vía search |
| "agrega nota: ..." | `Notes` |
| "ponla en progreso" | `Status` → `"En progreso"` |

Confirmar en una línea antes de ejecutar:
```
Actualizar "<Task>": <campo> → <nuevo valor>
```

- `notion-update-page` · page_id: ID de la tarea · command: `update_properties` · properties: solo los campos que cambian

Confirmar: `"<Task>" actualizada ✓`

## 4. Completar tarea

El usuario dice "ya terminé X", "marca X como hecha". Resolver por nombre (paso 1).

Acción no destructiva — ejecutar directo sin confirmación:
- `notion-update-page` · page_id: ID · command: `update_properties` · properties: `{"Status": "Listo", "Left (min)": 0}`

Confirmar: `"<Task>" marcada como Listo ✓`

## 5. Eliminar tarea

El usuario dice "elimina/borra la tarea X". Resolver por nombre (paso 1).

**Confirmar siempre antes de eliminar:**
```
¿Eliminar la tarea "<Task>"?
Esta acción no se puede deshacer fácilmente.
```

Si el resultado de la búsqueda indicó subtareas, agregar:
```
Esta tarea tiene N subtarea(s) asociada(s). No se eliminarán, pero quedarán sin tarea padre.
```

Esperar confirmación. El MCP de Notion no soporta enviar páginas a la papelera — usar el script:

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\task-delete.py" "<json>"
```

```json
{"id": "notion-page-id"}
```

Confirmar: `Tarea "<Task>" eliminada ✓`
