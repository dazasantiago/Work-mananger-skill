"""
task-delete.py
Deletes (moves to trash) a task.

Usage:
    python task-delete.py '<json>'

JSON shape:
    {"id": "notion-page-id"}

Output (stdout): {"ok": true}
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient


def main():
    if len(sys.argv) < 2:
        print("Usage: task-delete.py '<json>'", file=sys.stderr)
        sys.exit(1)

    data = json.loads(sys.argv[1])
    client = NotionClient()
    client.delete_page(data["id"])

    print(json.dumps({"ok": True}, ensure_ascii=False))


if __name__ == "__main__":
    main()
