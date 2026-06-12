# Quick Review

## Cuándo se ejecuta

El usuario pregunta "qué tengo pendiente", "qué hay para hacer", "cómo van
mis proyectos", sin intención de iniciar una sesión.

## 1. Fetch de datos

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\fetch-overview.py"
```

Output: JSON con `tasks` (Pendiente/En progreso, por Deadline asc) y
`projects` (todos).

## 2. Agrupar tasks por proyecto

Para cada proyecto en `projects`, filtrar las `tasks` cuyo `Project`
(relation array) contenga el `id` de ese proyecto. Tasks sin `Project` van
en un grupo "Sin proyecto" al final.

## 3. Alertas de vencidas

Si alguna task tiene `Deadline` anterior a hoy, mostrar antes de las tablas:

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
