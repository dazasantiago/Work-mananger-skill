# Finish Session

## Arquitectura

El cierre normal lo ejecuta el **widget de forma autónoma** — sin Claude Code:
1. Usuario hace click en "Close session" → confirma
2. Widget llama `Api.finish_session()` en Python
3. Python genera summary automático y llama `session-finish.py` como subprocess
4. Widget muestra "Sesión guardada ✓" con stats y summary

**Este módulo solo aplica para el flujo manual**: el usuario le dice a Claude que cierre la sesión sin haber usado el widget, o para debugging/recovery.

## Cuándo se ejecuta el flujo manual

El usuario dice "cerrar sesión", "terminar sesión", o similar, o se perdió un cierre de widget.

---

## 1. Leer el payload

Leer `C:\Users\dazas\.work\session-close.json`.

El payload tiene esta forma:
```json
{
  "session_id":    "notion-page-id",
  "session_title": "Session — YYYY-MM-DD — ...",
  "planned_min":   90,
  "actual_min":    85,
  "tasks": [
    {
      "id":                 "notion-page-id",
      "name":               "Nombre de la tarea",
      "project":            "Proyecto",
      "left_min":           30,
      "initial_actual_min": 0,
      "actual_min":         28,
      "status":             "done | in_progress | not_started",
      "notes":              "texto opcional",
      "is_new":             false
    }
  ]
}
```

---

## 2. Procesar los datos

Clasificar cada tarea:

| status | actual_min | Acción |
|--------|-----------|--------|
| `done` | cualquiera | Status → Listo, Left → 0 |
| `in_progress` | > 0 | Status → En progreso, Left → max(0, left - session_time) |
| `not_started` | > 0 | Tratar como in_progress |
| `not_started` | 0 | Excluir del resumen y de la sesión en Notion |

Calcular tiempo total de sesión vs planeado, y qué porcentaje se terminó.

---

## 3. Generar el summary

Redactar un resumen de 1–3 oraciones en español. Debe capturar:
- Qué se logró (tareas terminadas)
- Qué quedó pendiente (tareas in_progress)
- Si hubo sobretiempo o quedó tiempo de sobra
- Cualquier nota relevante de las tareas

**Ejemplos de buen summary:**
> "Se completó la definición de features de Morning Pal y se avanzó en la integración con Notion DB. La sesión se extendió 25 min sobre lo planeado. Queda pendiente terminar el adaptar flujo."

> "Sesión corta enfocada en el widget de sesiones — se cerró la revisión del componente de timer. Sin pendientes urgentes."

**Evitar:** frases genéricas como "se trabajó en tareas", listas secas de nombres.

---

## 4. Ejecutar el script

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\session\session-finish.py" "<json>"
```

El JSON debe ser el payload original con el campo `summary` añadido:
```json
{
  "session_id":  "...",
  "planned_min": 90,
  "actual_min":  85,
  "summary":     "Summary generado por Claude",
  "tasks":       [...]
}
```

`session-finish.py` actualiza también la propiedad `Date` de la sesión para
que aparezca como evento con horario en el calendario de Notion. Si el
payload incluye `start`/`end` (ISO 8601, como manda el widget) se usan esos
valores; si no vienen (caso típico del flujo manual), el script calcula
`end = ahora` y `start = end - actual_min`.

---

## 5. Presentar el cierre

Mostrar una confirmación compacta:

```
Sesión cerrada ✓
  Duración: 85 min (planeado: 90)
  Completadas: 2 / 3
  Resumen: <summary>
```

Si hubo tareas removidas de la sesión por no haber invertido tiempo, mencionarlas en una línea:
> "Excluidas de la sesión: [Nombre tarea]"

---

## 6. Limpiar

Eliminar `C:\Users\dazas\.work\session-close.json` después de procesar exitosamente.
