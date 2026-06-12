"""
session-finish.py
Finalizes a session: updates tasks and session entry in Notion.

Usage:
    python session-finish.py '<json>'

JSON shape (widget close payload + claude summary):
    {
        "session_id":  "notion-page-id",
        "planned_min": 90,
        "actual_min":  85,
        "start":       "2026-06-11T14:00:00.000Z",
        "end":         "2026-06-11T15:00:00.000Z",
        "summary":     "Claude-generated summary",
        "tasks": [
            {
                "id":                  "notion-page-id",
                "left_min":            30,
                "initial_actual_min":  0,
                "actual_min":          28,
                "status":              "done | in_progress | not_started",
                "notes":               ""
            }
        ]
    }

Rules:
- done         → Status=Listo,      Left=0,                     Actual=initial+session
- in_progress  → Status=En progreso, Left=max(0,left-session),   Actual=initial+session
- not_started
    actual>0   → treated as in_progress
    actual==0  → skip task update; remove from session relation
"""

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient, SESSIONS_DB


def main():
    if len(sys.argv) < 2:
        print("Usage: session-finish.py '<json>'", file=sys.stderr)
        sys.exit(1)

    data       = json.loads(sys.argv[1])
    session_id = data["session_id"]
    actual_min = data["actual_min"]
    summary    = data.get("summary", "")
    tasks      = data.get("tasks", [])

    client = NotionClient()

    kept_task_ids   = []
    removed_task_ids = []

    for i, t in enumerate(tasks):
        task_id      = t["id"]
        left_min     = t.get("left_min") or 0
        initial_act  = t.get("initial_actual_min") or 0
        session_time = t.get("actual_min") or 0
        status       = t.get("status", "not_started")
        notes        = t.get("notes", "").strip()

        # Normalize: not_started with time → in_progress
        if status == "not_started" and session_time > 0:
            status = "in_progress"

        # No time invested → remove from session, skip task update
        if status == "not_started" and session_time == 0:
            removed_task_ids.append(task_id)
            continue

        kept_task_ids.append(task_id)
        new_actual = initial_act + session_time

        if status == "done":
            props = {
                "Status":           {"select": {"name": "Listo"}},
                "Left (min)":       {"number": 0},
                "Actual time (min)": {"number": new_actual},
            }
        else:  # in_progress
            new_left = max(0, left_min - session_time)
            props = {
                "Status":           {"select": {"name": "En progreso"}},
                "Left (min)":       {"number": new_left},
                "Actual time (min)": {"number": new_actual},
            }

        if notes:
            props["Notes"] = {"rich_text": [{"text": {"content": notes}}]}

        client.update_page(task_id, props)

        if i < len(tasks) - 1:
            time.sleep(0.35)

    # Date range for the session entry, so it renders as a timed event in
    # the Notion calendar. Falls back to "now - actual_min" when start/end
    # aren't provided (manual finish flow).
    start_iso = data.get("start")
    end_iso   = data.get("end")
    if not start_iso or not end_iso:
        end_dt    = datetime.now().astimezone()
        start_dt  = end_dt - timedelta(minutes=actual_min)
        start_iso = start_dt.isoformat()
        end_iso   = end_dt.isoformat()

    # Update session entry
    session_props = {
        "Status":      {"select": {"name": "Completed"}},
        "Actual (min)": {"number": actual_min},
        "Date":        {"date": {"start": start_iso, "end": end_iso}},
    }
    if summary:
        session_props["Summary"] = {"rich_text": [{"text": {"content": summary}}]}

    # Remove tasks with no time from the session's Tasks relation
    if removed_task_ids:
        session_props["Tasks"] = {"relation": [{"id": tid} for tid in kept_task_ids]}

    client.update_page(session_id, session_props)

    result = {
        "ok":      True,
        "kept":    len(kept_task_ids),
        "removed": len(removed_task_ids),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
