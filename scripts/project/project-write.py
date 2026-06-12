"""
project-write.py
Creates or updates a project.

Usage:
    python project-write.py '<json>'

JSON shape:
    {
        "id":      "notion-page-id",   # omit to create a new project
        "project": "Project name",      # required on create
        "type":    "Software Development | Content Creation",
        "status":  "Active | Backlog | Idea",
        "context": "texto libre"
    }

Rules:
- create: "project" required. "status" defaults to "Idea" if not provided.
- Only fields present in the input JSON are written (partial update on edit)

Output (stdout): {"id": "<notion-page-id>", "created": true|false}
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient, PROJECTS_DB


def build_properties(data: dict, creating: bool) -> dict:
    props = {}

    if "project" in data:
        props["Project"] = {"title": [{"text": {"content": data["project"]}}]}

    if "type" in data:
        props["Type"] = {"select": {"name": data["type"]}}

    if "status" in data:
        props["Status"] = {"select": {"name": data["status"]}}
    elif creating:
        props["Status"] = {"select": {"name": "Idea"}}

    if "context" in data:
        props["Context"] = {"rich_text": [{"text": {"content": data["context"]}}]}

    return props


def main():
    if len(sys.argv) < 2:
        print("Usage: project-write.py '<json>'", file=sys.stderr)
        sys.exit(1)

    data = json.loads(sys.argv[1])
    client = NotionClient()

    creating = "id" not in data
    props = build_properties(data, creating)

    if creating:
        page = client.create_page(PROJECTS_DB, props)
        result = {"id": page["id"], "created": True}
    else:
        client.update_page(data["id"], props)
        result = {"id": data["id"], "created": False}

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
