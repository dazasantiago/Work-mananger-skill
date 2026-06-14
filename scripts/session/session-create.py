"""
session-create.py
Creates a new session entry in Notion and marks approved tasks as En progreso.

Usage:
    python session-create.py '<json>'

JSON shape:
    {
        "title":       "Session — 2026-06-08 — Ritto",   # no emoji
        "date":        "2026-06-08",
        "planned_min": 90,
        "task_ids":    ["notion-page-id-1", "notion-page-id-2"]
    }

The page icon is always set to ⏱️ (no "emoji" field needed).

Output (stdout): {"session_id": "<notion-page-id>", "prev_statuses": {"<task-id>": "<prev-status>", ...}}
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient, SESSIONS_DB, TASKS_DB, extract


def main():
    if len(sys.argv) < 2:
        print("Usage: session-create.py '<json>'", file=sys.stderr)
        sys.exit(1)

    data = json.loads(sys.argv[1])
    title       = data["title"]
    date        = data["date"]
    planned_min = data["planned_min"]
    task_ids    = data.get("task_ids", [])

    client = NotionClient()

    # Capture prev status for each task before changing it
    prev_statuses = {}
    for i, task_id in enumerate(task_ids):
        page = client._request("GET", f"/pages/{task_id}")
        prev_statuses[task_id] = extract(page["properties"].get("Status", {})) or "Pendiente"
        if i < len(task_ids) - 1:
            time.sleep(0.35)

    # Create session entry
    properties = {
        "Session":       {"title": [{"text": {"content": title}}]},
        "Date":          {"date": {"start": date}},
        "Planned (min)": {"number": planned_min},
        "Status":        {"select": {"name": "Active"}},
    }
    if task_ids:
        properties["Tasks"] = {"relation": [{"id": tid} for tid in task_ids]}

    session = client.create_page(SESSIONS_DB, properties, icon="⏱️")
    session_id = session["id"]

    # Mark approved tasks as En progreso
    for i, task_id in enumerate(task_ids):
        client.update_page(task_id, {"Status": {"select": {"name": "En progreso"}}})
        if i < len(task_ids) - 1:
            time.sleep(0.35)

    print(json.dumps({"session_id": session_id, "prev_statuses": prev_statuses}, ensure_ascii=False))


if __name__ == "__main__":
    main()
