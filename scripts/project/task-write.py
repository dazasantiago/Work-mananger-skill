"""
task-write.py
Creates or updates a task (ad-hoc, outside session flow).

Usage:
    python task-write.py '<json>'

JSON shape:
    {
        "id":              "notion-page-id",   # omit to create a new task
        "task":            "Task title",        # required on create, no emoji
        "emoji":           "🐛",                 # required on create, sets page icon
        "status":          "Pendiente | En progreso | Listo",
        "deadline":        "YYYY-MM-DD",
        "left_min":        30,
        "actual_min":      0,
        "notes":           "texto",
        "project_id":      "notion-page-id",
        "parent_task_id":  "notion-page-id"
    }

Rules:
- create: "task" required. "status" defaults to "Pendiente" if not provided.
- "emoji" sets the page icon (Notion icon field), not the title text.
  Required on create; on edit, only changes the icon if provided.
- status == "Listo" and "left_min" not provided -> Left (min) set to 0
- Only fields present in the input JSON are written (partial update on edit)
- deadline/project_id/parent_task_id: pass null/""/[] to clear the field

Output (stdout): {"id": "<notion-page-id>", "created": true|false}
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient, TASKS_DB


def build_properties(data: dict, creating: bool) -> dict:
    props = {}

    if "task" in data:
        props["Task"] = {"title": [{"text": {"content": data["task"]}}]}

    if "status" in data:
        props["Status"] = {"select": {"name": data["status"]}}
    elif creating:
        props["Status"] = {"select": {"name": "Pendiente"}}

    if "deadline" in data:
        props["Deadline"] = {"date": {"start": data["deadline"]}} if data["deadline"] else {"date": None}

    if "left_min" in data:
        props["Left (min)"] = {"number": data["left_min"]}

    if "actual_min" in data:
        props["Actual time (min)"] = {"number": data["actual_min"]}

    if "notes" in data:
        props["Notes"] = {"rich_text": [{"text": {"content": data["notes"]}}]}

    if "project_id" in data:
        props["Project"] = {"relation": [{"id": data["project_id"]}] if data["project_id"] else []}

    if "parent_task_id" in data:
        props["Parent Task"] = {"relation": [{"id": data["parent_task_id"]}] if data["parent_task_id"] else []}

    if data.get("status") == "Listo" and "left_min" not in data:
        props["Left (min)"] = {"number": 0}

    return props


def main():
    if len(sys.argv) < 2:
        print("Usage: task-write.py '<json>'", file=sys.stderr)
        sys.exit(1)

    data = json.loads(sys.argv[1])
    client = NotionClient()

    creating = "id" not in data
    props = build_properties(data, creating)
    icon = data.get("emoji")

    if creating:
        page = client.create_page(TASKS_DB, props, icon=icon)
        result = {"id": page["id"], "created": True}
    else:
        client.update_page(data["id"], props, icon=icon)
        result = {"id": data["id"], "created": False}

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
