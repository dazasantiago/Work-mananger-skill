# Quick Review

## Cuándo se ejecuta

El usuario pregunta "qué tengo pendiente", "qué hay para hacer", "cómo van
mis proyectos", sin intención de iniciar una sesión.

## 1. Fetch de datos (llamadas paralelas)

Hacer las tres búsquedas en paralelo:

**Tareas pendientes:**
- `notion-search` · query: `"Pendiente"` · data_source_url: `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be` · content_search_mode: `workspace_search` · page_size: 25 · max_highlight_length: 0
- `notion-search` · query: `"En progreso"` · data_source_url: `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be` · content_search_mode: `workspace_search` · page_size: 25 · max_highlight_length: 0

**Proyectos:**
- `notion-search` · query: `"Active Backlog Idea"` · data_source_url: `collection://7cb2470f-41e2-44d2-927e-7603c8ed80e2` · content_search_mode: `workspace_search` · page_size: 25 · max_highlight_length: 0

Combinar los resultados de las dos búsquedas de tasks y deduplicar por ID.

## 2. Agrupar tasks por proyecto

Para cada proyecto, filtrar las tasks cuyo campo `Project` (relation) contenga el ID de ese proyecto. Tasks sin `Project` van en un grupo "Sin proyecto" al final.

## 3. Alertas de vencidas

Si alguna task tiene `Deadline` anterior a hoy (2026-06-16), mostrar antes de las tablas:

```
⚠ Tareas vencidas:
- <Task> (Proyecto, venció el YYYY-MM-DD)
```

## 4. Presentar por estado de proyecto

En este orden, omitiendo secciones vacías:

### Proyectos activos (`Status = "Active"`)

Por cada proyecto activo con tasks pendientes:

**<Nombre del proyecto>**

| # | Task | Status | Deadline | Left (min) |
|---|------|--------|----------|-----------|

Si un proyecto activo no tiene tasks pendientes: "<Proyecto> — sin tareas pendientes."

### Sin proyecto

Misma tabla para tasks sin `Project`, si las hay.

### Proyectos en Backlog / Idea

Lista simple agrupada por status:

```
Backlog: Proyecto A, Proyecto B
Idea: Proyecto C
```

## 5. Cierre

Solo lectura — no pedir confirmación ni ofrecer acciones. Si el usuario pide
crear/editar/eliminar a partir de lo mostrado, seguir `task-crud.md` o
`project-crud.md` según corresponda.
