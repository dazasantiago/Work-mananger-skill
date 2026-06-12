# Cancel Session

## Cuándo se ejecuta

El usuario dice "cancela la sesión", "me equivoqué", "no quiero registrar esto", etc.

## Qué hace

Deshace la sesión como si nunca hubiera existido:
1. Revierte cada task a su status previo (antes de que la sesión la pusiera en "En progreso")
2. Borra la sesión de Notion (in_trash)
3. Elimina `session-current.json`

## Flujo

### 1. Leer session-current.json

```
C:\Users\dazas\.claude\session-current.json
```

Contiene `session_id`, `session_title`, y `tasks[]` con `prev_status` por task.

### 2. Confirmar con el usuario

Mostrar qué se va a deshacer:

```
¿Cancelar sesión "<session_title>"?
Esto revertirá X tareas a su estado anterior y eliminará el registro.
```

Esperar confirmación antes de continuar.

### 3. Ejecutar el script

```bash
python "C:\Users\dazas\.claude\skills\actions\scripts\session\session-cancel.py" "<json>"
```

JSON:
```json
{
    "session_id": "...",
    "tasks": [
        {"id": "...", "prev_status": "Pendiente"},
        {"id": "...", "prev_status": "En progreso"}
    ]
}
```

### 4. Confirmar cierre

```
Sesión cancelada ✓
  Revertidas: X tareas
  Registro eliminado de Notion
```
