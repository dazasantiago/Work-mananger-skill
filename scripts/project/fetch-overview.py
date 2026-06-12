"""
fetch-overview.py
Fetches the current state of tasks and projects for ad-hoc CRUD / quick review.

Output (stdout): JSON with `tasks` (Pendiente/En progreso) and `projects` (all).
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from notion_client import NotionClient, get_pending_tasks, get_all_projects


def main():
    client = NotionClient()

    with ThreadPoolExecutor(max_workers=2) as pool:
        f_tasks    = pool.submit(get_pending_tasks, client)
        f_projects = pool.submit(get_all_projects,  client)
        tasks    = f_tasks.result()
        projects = f_projects.result()

    print(json.dumps({"tasks": tasks, "projects": projects}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
