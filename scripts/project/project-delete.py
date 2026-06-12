"""
project-delete.py
Deletes (moves to trash) a project.

Usage:
    python project-delete.py '<json>'

JSON shape:
    {"id": "notion-page-id"}

Output (stdout): {"ok": true}

Note: does NOT touch tasks linked via the Project relation — the caller
(project-crud.md flow) warns about associated tasks before calling this.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient


def main():
    if len(sys.argv) < 2:
        print("Usage: project-delete.py '<json>'", file=sys.stderr)
        sys.exit(1)

    data = json.loads(sys.argv[1])
    client = NotionClient()
    client.delete_page(data["id"])

    print(json.dumps({"ok": True}, ensure_ascii=False))


if __name__ == "__main__":
    main()
