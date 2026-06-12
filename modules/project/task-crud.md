# Task CRUD

## Cuándo se ejecuta

El usuario pide agregar, editar, marcar como hecha, o eliminar una tarea,
fuera del flujo de sesión.

## 1. Fetch de datos

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\fetch-overview.py"
```

Usar `tasks` y `projects` para resolver nombres mencionados a ids.

## 2. Resolver referencias por nombre

Cuando el usuario menciona una tarea o proyecto por nombre:
- Buscar coincidencia (sub)string case-insensitive contra `Task`/`Project`
- Si hay una sola coincidencia clara, usar su `id`
- Si hay varias o ninguna, presentar las opciones en una tabla corta y preguntar cuál es

## 3. Crear tarea

Datos a confirmar con el usuario:
- `task` (título) — requerido. Anteponer un emoji elegido según el tema de
  la tarea (ver "Regla global: Emoji en el título al crear" en `SKILL.md`)
- `project_id` — preguntar siempre "¿A qué proyecto pertenece?" salvo que el
  usuario ya lo haya dicho. Si dice que no aplica a ningún proyecto, omitir
- `deadline` — opcional, preguntar solo si parece relevante
- `left_min` — opcional, preguntar "¿Cuánto tiempo estimas?" si quiere planearlo
- `status` — si el usuario no dice nada, omitir (el script defaultea a "Pendiente"). Si dice "ya empecé con esto" → `status: "En progreso"`

Confirmar antes de crear:
```
Crear tarea "<task>" en proyecto "<Proyecto>"
  Deadline: <fecha o "sin fecha">
  Estimado: <left_min> min
```

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\task-write.py" "<json>"
```

```json
{
    "task": "Nombre de la tarea",
    "project_id": "notion-page-id",
    "deadline": "YYYY-MM-DD",
    "left_min": 30
}
```

Confirmar: `Tarea "<task>" creada ✓`

## 4. Editar tarea

Resolver la tarea por nombre (paso 2). Mapear lo que pide el usuario a campos:

| Pide el usuario | Campo(s) |
|------------------|----------|
| "cambia el deadline a..." | `deadline` |
| "esto va a tomar más/menos tiempo" | `left_min` |
| "muévela al proyecto X" | `project_id` |
| "es subtarea de X" | `parent_task_id` |
| "agrega nota: ..." | `notes` |
| "ponla en progreso" | `status: "En progreso"` |

Confirmar en una línea antes de ejecutar:
```
Actualizar "<task>": <campo> → <nuevo valor>
```

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\task-write.py" "<json>"
```

```json
{
    "id": "notion-page-id",
    "<campo>": "<nuevo valor>"
}
```

Enviar solo los campos que cambian. Confirmar: `"<task>" actualizada ✓`

## 5. Completar tarea

El usuario dice "ya terminé X", "marca X como hecha". Resolver por nombre (paso 2).

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\task-write.py" "<json>"
```

```json
{
    "id": "notion-page-id",
    "status": "Listo"
}
```

`Left (min)` se pone en 0 automáticamente. Acción no destructiva — ejecutar
directo, sin confirmación previa. Confirmar resultado: `"<task>" marcada como Listo ✓`

## 6. Eliminar tarea

El usuario dice "elimina/borra la tarea X". Resolver por nombre (paso 2).

**Confirmar siempre antes de eliminar:**

```
¿Eliminar la tarea "<task>"?
Esta acción no se puede deshacer fácilmente.
```

Si la tarea tiene `Subtasks` no vacío en el fetch, agregar:
```
Esta tarea tiene N subtarea(s) asociada(s). No se eliminarán, pero quedarán sin tarea padre.
```

Esperar confirmación, luego:

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\project\task-delete.py" "<json>"
```

```json
{"id": "notion-page-id"}
```

Confirmar: `Tarea "<task>" eliminada ✓`
