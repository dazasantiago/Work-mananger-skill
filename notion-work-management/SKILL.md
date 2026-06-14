---
name: actions
description: Gestiona las tareas y proyectos personales de Santiago en Notion - crear, editar, completar o eliminar tareas; crear/actualizar proyectos, cambiar su estado o capturar ideas; y revisar que hay pendiente agrupado por proyecto. Usa esta skill SIEMPRE que el usuario pida agregar, editar, marcar como hecha o borrar una tarea; agregar, actualizar o borrar un proyecto; capturar una idea de proyecto; o pregunte que tiene pendiente, en que va, o como van sus proyectos - incluso si no menciona Notion explicitamente. Requiere el conector de Notion habilitado en claude.ai.
---

# Gestion de tareas y proyectos en Notion

Esta skill cubre el work management personal de Santiago: dos bases de datos
de Notion (Tasks y Projects) conectadas entre si. **No incluye sesiones de
trabajo/tiempo** (eso vive en otra parte del sistema y no se toca desde aqui).

Toda la interaccion es a traves del **conector de Notion de claude.ai**
(`notion-search`, `notion-fetch`, `notion-create-pages`, `notion-update-page`,
`notion-move-pages`). No hay scripts ni tokens - si el conector no esta
disponible, avisa al usuario que necesita conectarlo.

## Las dos bases de datos

### Tasks - `collection://72ab8e2f-35a1-4b46-97eb-84e8d6d792be`

(Dentro de la base "☑️ Tasks", pagina `e882c0f07df84a3ca7742a67f264cd27`)

| Propiedad | Tipo | Notas |
|---|---|---|
| `Task` | title | Titulo de la tarea. Siempre con emoji al crear (ver Convenciones) |
| `Status` | select | `Pendiente` (default al crear) \| `En progreso` \| `Listo` |
| `Deadline` | date | Usar `date:Deadline:start` (y opcional `date:Deadline:end`, `date:Deadline:is_datetime`) |
| `Left (min)` | number | Minutos estimados restantes |
| `Actual time (min)` | number | Minutos realmente invertidos |
| `Notes` | text | Notas/contexto libre |
| `Project` | relation → Projects | A lo sumo un proyecto |
| `Parent Task` | relation → Tasks (self) | Para subtareas |
| `Subtasks` | relation → Tasks (self) | Inversa de `Parent Task` - normalmente no se edita directo |
| `Session` | relation → Sessions | Gestionada por el modulo de sesiones. **No tocar.** |
| `Created` | created_time | Automatico, solo lectura |

### Projects - `collection://7cb2470f-41e2-44d2-927e-7603c8ed80e2`

(Dentro de la base "🌆 Projects", pagina `8a19177c80954452984197b55c8aa950`)

| Propiedad | Tipo | Notas |
|---|---|---|
| `Project` | title | Nombre del proyecto. Siempre con emoji al crear |
| `Status` | select | `Idea` (default al crear) \| `Backlog` \| `Active` \| `On Hold` \| `Done` \| `Discarded` |
| `Type` | select | Opciones vistas: `Software Development`, `Content Creation`, `Universidad`, `Youtube`. Puede haber otras - si dudas, mira el schema (ver abajo) |
| `Context` | text | Notas de progreso / donde quedo el proyecto la ultima vez |
| `Tasks` | relation → Tasks | Inversa de `Project`. Util para ver de un saque todas las tareas de un proyecto (ver "Revisar pendientes") |
| `Created` | created_time | Automatico, solo lectura |

**Los schemas pueden cambiar.** Si una opcion de `Status`/`Type` que necesitas
no esta en las tablas de arriba, o el usuario pide algo que no calza, corre
`notion-fetch` sobre el `collection://` correspondiente para ver el estado
actual antes de escribir.

## Como leer y escribir (conector Notion)

### Resolver una tarea/proyecto por nombre

1. `notion-search` con `data_source_url` = el `collection://` correspondiente
   y `query` = el nombre que dijo el usuario.
2. Si hay una coincidencia clara, `notion-fetch` esa pagina (por `id` o `url`)
   para ver sus propiedades actuales.
3. Si hay varias o ninguna, mostrale al usuario una tabla corta con las
   opciones encontradas y pregunta cual es.

`notion-search` es busqueda semantica: devuelve `id`/`title`/`url`/`highlight`,
no las propiedades. Por eso el segundo paso (`fetch`) es necesario siempre que
necesites Status/Deadline/Project/etc.

### Crear (tarea o proyecto)

`notion-create-pages` con:

```json
{
  "parent": {"type": "data_source_id", "data_source_id": "<collection-id-sin-prefijo>"},
  "pages": [{"properties": { ... }}]
}
```

Formato de valores en `properties`:

- **title / select / text / number**: valor directo (string o numero).
- **relation** (`Project`, `Parent Task`, ...): un string con un array JSON de
  URLs de pagina, p.ej. `"Project": "[\"https://app.notion.com/p/<id>\"]"`.
  Usa el campo `url` que te devuelven `fetch`/`search`/`create-pages` para la
  pagina relacionada - no construyas el id a mano. Array vacio `"[]"` o
  `null` para dejar sin relacion.
- **date** (`Deadline`): claves expandidas `date:Deadline:start` (requerida),
  y opcionalmente `date:Deadline:end` / `date:Deadline:is_datetime` (0 o 1).

### Editar

`notion-update-page` con `command: "update_properties"` y un `properties` que
solo incluya los campos que cambian (los omitidos quedan igual). Usa `null`
para borrar un valor (incluyendo relaciones y fechas: `"date:Deadline:start": null`).

### Completar una tarea

`Status: "Listo"`. Si el usuario no dio un nuevo estimado, poner tambien
`"Left (min)": 0` en el mismo update.

### Eliminar

El conector **no tiene un comando real de "papelera"**. Lo mas parecido es
`notion-move-pages` moviendo la pagina a `{"type": "workspace"}`: la saca de
la base de datos (deja de aparecer en cualquier vista/tabla) y queda como
pagina privada suelta en el workspace - no es una eliminacion definitiva.

Por eso, para "eliminar":
1. Resuelve la pagina (busqueda + fetch) y muestra que vas a hacer.
2. **Confirma siempre con el usuario antes** - explicale que la tarea/proyecto
   se sacara de la base de datos pero seguira existiendo como pagina suelta.
3. Tras mover, pasale el link de la pagina (`url` devuelto por `fetch`/`move`)
   por si quiere borrarla del todo desde Notion (papelera real).

Si es una **tarea** con `Subtasks` no vacio, o un **proyecto** con `Tasks` no
vacio, avisa antes de mover cuantas tareas asociadas tiene (ver "Revisar
pendientes" para como listarlas) - esas tareas no se tocan, pero quedaran
relacionadas a una pagina que ya no esta en ninguna base de datos.

## Convenciones

- **Emoji en el titulo al crear** una task o project: elige uno segun el tema
  (ej. 🐛 bug, 🎨 diseno, 📝 contenido/escritura, 🚀 lanzamiento, 💡 idea, 🔧
  config/infra, 📚 estudio, 💰 finanzas). Si ninguno calza, usa 📌.
  Ejemplo: `🐛 Arreglar bug de login`.
- Responder en espanol, directo y conciso.
- Usar tablas para mostrar tareas o proyectos.
- No pedir informacion que ya tengas de un `fetch`/`search` previo.

## Flujos

### Revisar pendientes ("que tengo pendiente", "como van mis proyectos")

La forma mas confiable de listar tareas no es buscar en la coleccion de
Tasks (la busqueda es semantica y puede no traer todo), sino aprovechar la
relacion `Tasks` de cada **proyecto**:

1. Si el usuario menciona un proyecto puntual: `notion-search` +
   `notion-fetch` ese proyecto. Su propiedad `Tasks` trae los `url` de todas
   sus tareas - `fetch` cada una para obtener `Status`/`Deadline`/`Left (min)`/`Notes`.
2. Si pregunta en general ("que tengo pendiente"): `notion-search` sobre la
   coleccion de Projects para identificar los proyectos relevantes (tipicamente
   los `Active`), y repite el paso 1 para cada uno. Suma tambien las tareas
   sin proyecto si el usuario lo pide (busca en la coleccion de Tasks
   directamente).
3. Filtra a `Status` en `Pendiente`/`En progreso` y ordena por `Deadline`
   ascendente (las sin deadline al final).
4. Si alguna `Deadline` ya paso, mostrala primero bajo "⚠ Tareas vencidas".
5. Agrupa el resto por proyecto (igual formato que abajo), y deja "Sin
   proyecto" al final.

Tabla por proyecto:

| # | Task | Status | Deadline | Left (min) |
|---|------|--------|----------|-----------|

Si el usuario pide la lista exacta y completa sin depender de busqueda
semantica, podes ofrecerle el link directo a la vista "Focus (sesión)" en
Notion (filtra `Status != Listo`, ordenada por Deadline):
`https://app.notion.com/p/e882c0f07df84a3ca7742a67f264cd27?v=371dd051ba2f815a8932000cba3d229c`

Solo lectura - no pedir confirmacion ni ofrecer acciones. Si el usuario pide
crear/editar/eliminar a partir de lo mostrado, segui los flujos de abajo.

### Tareas

**Crear** ("agrega una tarea...", "tengo que..."):

- `task` (titulo, con emoji) - requerido.
- `project_id` - pregunta "¿a que proyecto pertenece?" salvo que ya lo haya
  dicho o diga que no aplica.
- `deadline`, `left_min` - opcionales, preguntar solo si parece relevante.
- `status` - omitir salvo que el usuario diga "ya empece con esto" → `En progreso`.

Confirma antes de crear:
```
Crear tarea "<task>" en proyecto "<Proyecto>"
  Deadline: <fecha o "sin fecha">
  Estimado: <left_min> min
```

**Editar** ("cambia el deadline de X a...", "X va a tomar mas tiempo", "muevela
al proyecto Y", "es subtarea de Z", "agrega nota: ..."): resuelve por nombre,
confirma en una linea (`Actualizar "<task>": <campo> → <nuevo valor>`), y
actualiza solo ese campo.

**Completar** ("ya termine X", "marca X como hecha"): accion de bajo riesgo,
ejecutar directo sin confirmar. Confirmar resultado: `"<task>" marcada como Listo ✓`.

**Eliminar**: ver seccion "Eliminar" arriba. Siempre confirmar antes.

### Proyectos

**Crear / capturar idea** ("agrega un proyecto...", "anota la idea de...",
"quiero empezar a trabajar en..."):

- `project` (titulo, con emoji) - requerido.
- `status`: "es una idea" o no especifica → omitir (default `Idea`). "ya lo
  voy a empezar" → `Active`. "lo dejo para despues" → `Backlog`.
- `type`: preguntar solo si no es obvio del contexto; si no se puede inferir, omitir.
- `context`: cualquier descripcion/nota que de el usuario.

Accion de bajo riesgo - ejecutar directo. Confirmar:
`Proyecto "<project>" creado (status: <status>) ✓`

**Editar / cambiar estado** ("pasa X a Active", "cambia el tipo a...",
"actualiza la descripcion", "renombra el proyecto a..."): resuelve por
nombre, confirma en una linea, actualiza solo ese campo.

**Eliminar**: resuelve el proyecto, `fetch` para ver su relacion `Tasks` y
avisar cuantas tareas asociadas tiene (no se tocan, pero quedaran apuntando a
una pagina fuera de la base de datos). Ver seccion "Eliminar" arriba. Siempre
confirmar antes.

## Limitaciones conocidas

- "Eliminar" es un soft-delete (sacar de la base de datos moviendo a
  workspace), no una papelera real - documentado arriba.
- "Revisar pendientes" depende de recorrer las relaciones `Project ↔ Tasks`
  via `fetch`; si hay muchos proyectos/tareas puede requerir varias llamadas.
  Para la vista exacta y completa, usar el link a "Focus (sesión)" de Notion.
- Las opciones de `Status`/`Type` en las tablas de schema reflejan el estado
  visto al momento de escribir esta skill; pueden cambiar con el tiempo.
