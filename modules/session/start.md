# Start Session

## 1. Fetch de datos

Ejecutar antes de cualquier otra cosa, **en paralelo**:

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\session\session-fetch-brief.py"
```

y, con el Read tool, `C:\Users\dazas\.claude\session-current.json` (de la
sesión anterior — casi siempre existe). El tool Write exige haberlo leído
antes de sobreescribirlo en el paso 8; hacerlo ahora evita ese paso de último
momento, cuando lo que importa es lanzar el widget lo más rápido posible.

Output del script: JSON con `tasks`, `projects`, y `reference_session`.

## 2. Pedir duración (y focus opcional)

Preguntar a Santiago cuánto tiempo tiene para la sesión, usando siempre el
emoji ⏱️ (p.ej. "⏱️ ¿Cuánto tiempo tienes para la sesión de hoy?"). Si
menciona un proyecto o área específica en el mismo mensaje, tomarlo como
focus. Si no, Claude decide.

## 3. Analizar la sesión de referencia

**Si `reference_session.status == "Completed"` o `"Cancelled"` (última por fecha):**
- Leer el `Summary` buscando señales: tareas mencionadas para la próxima sesión, blockers, contexto de dónde quedó algo
- Usarlo como señal de peso extra para tasks relacionadas, no como regla determinante

## 4. Construir el pool de candidatas

Ordenar las tasks del script por relevancia usando estos criterios:

1. **Status**: `En progreso` tiene prioridad absoluta — una tarea ya empezada siempre va primero
2. **Deadline**: cuanto más próximo, más urgente. Tasks sin deadline van al final
3. **Estructura padre/subtask**:
   - Preferir agrupar subtasks con su tarea padre si el padre ya está en el plan
   - No incluir una subtask sola si su padre no está empezado, salvo que tenga deadline inminente

## 5. Armar el plan de sesión

Seleccionar la combinación que mejor aprovecha la duración disponible:

- Sumar `Left (min)` de las candidatas ordenadas hasta acercarse al tiempo de la sesión
- Reservar ~5 min al final para el cierre
- Con focus especificado → priorizar tasks de ese proyecto/área, completar con urgentes de otros si sobra tiempo
- Sin focus → mezclar tasks de distintos proyectos según los criterios del paso 4
- Agrupar tasks del mismo proyecto cuando sea posible para minimizar cambio de contexto

Presentar el plan como tabla:

| # | Task | Proyecto | Deadline | Left (min) |
|---|------|----------|----------|-----------|

## 6. Recomendaciones de proyectos

Revisar proyectos con `Status = "Idea"` o `"Backlog"`. Si los proyectos `Active` no tienen tasks urgentes sin atender (deadline próximo o en progreso sin terminar), sugerir al final del briefing uno o dos candidatos para arrancar:

> "Si tienes espacio mental hoy, estos proyectos están listos para empezar: [X], [Y]"

Omitir esta sección si hay urgencias sin resolver en proyectos activos.

## 7. Presentar briefing y pedir aprobación

Mostrar en orden:
1. Encabezado con la duración usando el emoji ⏱️, p.ej. "⏱️ Plan para los
   próximos <planned_min> min", seguido de la tabla del plan propuesto
2. Alertas si las hay (tasks vencidas, en progreso de sesiones anteriores sin terminar)
3. Recomendaciones de proyectos (si aplica)

Preguntar: "¿Te parece bien este plan o quieres ajustar algo?"

El usuario puede:
- Aprobar → paso 8
- Ajustar tareas → re-presentar tabla
- Cambiar focus o duración → reconstruir desde paso 4

## 8. Crear la sesión y activar las tasks

Una vez aprobado el plan, ejecutar:

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\session\session-create.py" "<json>"
```

El JSON debe tener esta forma:

```json
{
    "title":       "Session — YYYY-MM-DD — [proyecto o Mixed]",
    "date":        "YYYY-MM-DD",
    "planned_min": 90,
    "task_ids":    ["notion-page-id-1", "notion-page-id-2"]
}
```

`planned_min` es siempre la suma de `left_min` de las tasks aprobadas (sumando solo los valores positivos — `left_min` negativos cuentan como 0). Nunca usar el tiempo que dijo el usuario directamente.

`title` sin emoji — el script setea automáticamente el ícono de página ⏱️
(ver "Regla global: Emoji como ícono de página al crear" en `SKILL.md`).

El script crea la entrada en Sessions y actualiza todas las tasks aprobadas a `En progreso` en un solo paso. Devuelve:
```json
{"session_id": "...", "prev_statuses": {"<task-id>": "<status-antes>", ...}}
```

Guardar `session_id` en contexto. Con ese output, escribir
`C:\Users\dazas\.claude\session-current.json` (ya leído en el paso 1, así que
Write puede sobreescribirlo directamente):

```json
{
    "session_id": "<id>",
    "session_title": "<title>",
    "planned_min": 90,  // suma de left_min positivos de las tasks aprobadas
    "projects": ["Proyecto A", "Proyecto B", "..."],
    "tasks": [
        {
            "id": "<task-id>",
            "name": "Nombre tarea",
            "project": "Proyecto A",
            "left_min": 30,
            "initial_actual_min": 0,
            "prev_status": "Pendiente"
        }
    ],
    "available_tasks": [
        {
            "id": "<task-id>",
            "name": "Nombre tarea",
            "project": "Proyecto A",
            "status": "Pendiente",
            "left_min": 30,
            "initial_actual_min": 0
        }
    ]
}
```

`projects` debe ser la lista de **todos** los proyectos de Notion — los
nombres `Project` de cada entrada en `projects` del output del paso 1 — no
solo los de las tasks aprobadas para esta sesión. El widget usa esta lista
para el dropdown de proyecto en "+ Add task", y debe poder asignar cualquier
proyecto existente, no solo los que ya están en el plan.

El campo `prev_status` por task viene de `prev_statuses[task_id]` en el output del script. Es necesario para poder cancelar la sesión.

`available_tasks` es **todo** el array `tasks` del output del paso 1 (todas
las tasks con Status Pendiente o En progreso, aprobadas o no para esta
sesión), mapeando cada entrada así:

| Campo `available_tasks` | Viene de (output paso 1) |
|---|---|
| `id`                 | `id` |
| `name`               | `Task` |
| `project`            | `Project` (si existe) |
| `status`             | `Status` |
| `left_min`           | `Left (min)` (si existe) |
| `initial_actual_min` | `Actual time (min)` (si existe, default 0) |

El widget usa `available_tasks` para el picker de "+ Add task": al abrirlo
muestra esta lista (filtrando las que ya están en `tasks`) para agregarlas a
la sesión sin tener que crearlas desde cero.

## 9. Lanzar el widget

```powershell
Start-Process -FilePath "C:\Users\dazas\.claude\skills\actions\widget\src-tauri\target\release\widget.exe" -ArgumentList '"C:\Users\dazas\.claude\session-current.json"'
```

El widget lee `session-current.json`, muestra las tareas y maneja el cierre/cancelación llamando directamente a los scripts de Python. Este es el último paso de start — el widget es la interfaz desde aquí.
