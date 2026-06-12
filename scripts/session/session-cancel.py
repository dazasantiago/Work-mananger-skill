"""
session-cancel.py
Cancels an active session: reverts tasks to their pre-session status and deletes the session entry.

Usage:
    python session-cancel.py '<json>'

JSON shape:
    {
        "session_id": "notion-page-id",
        "tasks": [
            {"id": "notion-page-id", "prev_status": "Pendiente"}
        ]
    }

- Tasks are reverted to prev_status (fallback: "Pendiente" if not provided)
- Session page is moved to trash
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient


SESSION_FILE = Path.home() / ".claude" / "session-current.json"


def main():
    if len(sys.argv) < 2:
        print("Usage: session-cancel.py '<json>'", file=sys.stderr)
        sys.exit(1)

    data       = json.loads(sys.argv[1])
    session_id = data["session_id"]
    tasks      = data.get("tasks", [])

    client = NotionClient()

    # Revert each task to its pre-session status
    for i, t in enumerate(tasks):
        task_id     = t["id"]
        prev_status = t.get("prev_status", "Pendiente")
        client.update_page(task_id, {"Status": {"select": {"name": prev_status}}})
        if i < len(tasks) - 1:
            time.sleep(0.35)

    # Delete session entry
    client.delete_page(session_id)

    # Remove local session file
    if SESSION_FILE.exists():
        SESSION_FILE.unlink()

    print(json.dumps({"ok": True, "reverted": len(tasks)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
