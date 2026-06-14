# Project CRUD

## Cuándo se ejecuta

El usuario pide agregar/actualizar un proyecto, cambiar su estado, capturar
una idea, o eliminar un proyecto, fuera del flujo de sesión.

## 1. Fetch de datos

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\fetch-overview.py"
```

Usar `projects` para resolver nombres, y `tasks` (campo `Project`, relation)
para detectar tareas asociadas antes de eliminar.

## 2. Resolver referencias por nombre

Igual que en `task-crud.md`: substring case-insensitive contra `Project`.
Disambiguar con tabla si hay ambigüedad.

## 3. Crear proyecto / capturar idea

El usuario dice "agrega un proyecto...", "anota la idea de...", "quiero
empezar a trabajar en...".

Datos:
- `project` (título, sin emoji) — requerido
- `emoji` — requerido. Elegirlo según el tema del proyecto (ver "Regla global:
  Emoji como ícono de página al crear" en `SKILL.md`)
- `status` — si dice "es una idea" o no especifica, omitir (default "Idea").
  "ya lo voy a empezar" → `status: "Active"`. "lo dejo para después" → `status: "Backlog"`
- `type` — preguntar solo si no es obvio del contexto ("Software Development"
  o "Content Creation"); si no se puede inferir, omitir
- `context` — capturar cualquier descripción/nota que el usuario haya dado

Acción de bajo riesgo — ejecutar directo sin confirmación previa:

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\project-write.py" "<json>"
```

```json
{
    "project": "Nombre del proyecto",
    "emoji": "🚀",
    "status": "Idea",
    "type": "Software Development",
    "context": "Descripción capturada"
}
```

Confirmar: `Proyecto "<project>" creado (status: <status>) ✓`

## 4. Editar / cambiar estado

Resolver el proyecto por nombre (paso 2). Mapear lo que pide el usuario:

| Pide el usuario | Campo(s) |
|------------------|----------|
| "pasa X a Active/Backlog" | `status` |
| "cambia el tipo a..." | `type` |
| "actualiza la descripción/contexto" | `context` |
| "renombra el proyecto a..." | `project` |

Confirmar en una línea antes de ejecutar:
```
Actualizar proyecto "<project>": <campo> → <nuevo valor>
```

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\project-write.py" "<json>"
```

```json
{
    "id": "notion-page-id",
    "<campo>": "<nuevo valor>"
}
```

Enviar solo los campos que cambian. Confirmar: `Proyecto "<project>" actualizado ✓`

## 5. Eliminar proyecto

El usuario dice "elimina/borra el proyecto X". Resolver por nombre (paso 2).

**Cross-referenciar tareas asociadas**: filtrar `tasks` del fetch cuyo
`Project` (relation array) contenga el `id` del proyecto.

**Confirmar siempre antes de eliminar:**

Sin tareas asociadas:
```
¿Eliminar el proyecto "<project>"?
Esta acción no se puede deshacer fácilmente.
```

Con N tareas asociadas:
```
¿Eliminar el proyecto "<project>"?
Tiene N tarea(s) asociada(s):
  - <Task 1>
  - <Task 2>
Estas tareas NO se eliminarán, pero quedarán sin proyecto asignado.
Esta acción no se puede deshacer fácilmente.
```

Esperar confirmación, luego:

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\project-delete.py" "<json>"
```

```json
{"id": "notion-page-id"}
```

Confirmar: `Proyecto "<project>" eliminado ✓`
