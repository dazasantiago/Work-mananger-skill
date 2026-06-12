"""
session-fetch-brief.py
Fetches everything Claude needs to propose a session briefing.

Output (stdout): JSON with tasks, projects, and reference_session.
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import (
    NotionClient,
    get_pending_tasks,
    get_all_projects,
    get_paused_session,
    get_latest_session,
)


def main():
    client = NotionClient()

    # Run all 4 queries in parallel
    with ThreadPoolExecutor(max_workers=4) as pool:
        f_tasks    = pool.submit(get_pending_tasks,  client)
        f_projects = pool.submit(get_all_projects,   client)
        f_paused   = pool.submit(get_paused_session, client)
        f_latest   = pool.submit(get_latest_session, client)

        tasks    = f_tasks.result()
        projects = f_projects.result()
        paused   = f_paused.result()
        latest   = f_latest.result()

    # Paused session takes priority over latest
    reference_session = paused if paused else latest

    output = {
        "tasks": tasks,
        "projects": projects,
        "reference_session": reference_session,
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
