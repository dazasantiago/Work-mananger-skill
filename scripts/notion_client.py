"""
Shared Notion API client for all action scripts.
If the Notion API changes, update this file only.
"""

import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Database IDs (used as parent in create_page) ──────────────────────────────
TASKS_DB    = "e882c0f07df84a3ca7742a67f264cd27"
PROJECTS_DB = "8a19177c80954452984197b55c8aa950"
SESSIONS_DB = "25be474933014a8eaf6bc951969f3b3f"

# ── Collection IDs (used in data_sources query endpoint, v2026-03-11+) ────────
TASKS_COL    = "72ab8e2f-35a1-4b46-97eb-84e8d6d792be"
PROJECTS_COL = "7cb2470f-41e2-44d2-927e-7603c8ed80e2"
SESSIONS_COL = "72fb1b99-d81d-4080-b6f8-b12d9aa057ea"

# ── Client ────────────────────────────────────────────────────────────────────

class NotionClient:
    BASE_URL = "https://api.notion.com/v1"
    VERSION  = "2026-03-11"

    def __init__(self):
        token = os.environ.get("NOTION_TOKEN")
        if not token:
            raise ValueError("NOTION_TOKEN not set — check .env")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Notion-Version": self.VERSION,
            "Content-Type": "application/json",
        })

    def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{self.BASE_URL}/{path.lstrip('/')}"
        for attempt in range(3):
            resp = self.session.request(method, url, **kwargs)
            if resp.status_code == 429:
                time.sleep(int(resp.headers.get("Retry-After", 2 ** attempt)))
                continue
            if resp.status_code in (500, 503):
                time.sleep(2 ** attempt)
                continue
            resp.raise_for_status()
            return resp.json()
        raise RuntimeError(f"Max retries for {method} {path}")

    def query_all(self, collection_id: str, filter: dict = None, sorts: list = None) -> list:
        """Query a data source (collection) using the v2026-03-11 endpoint."""
        payload: dict = {"page_size": 100}
        if filter:
            payload["filter"] = filter
        if sorts:
            payload["sorts"] = sorts
        results = []
        cursor = None
        while True:
            if cursor:
                payload["start_cursor"] = cursor
            resp = self._request("POST", f"/data_sources/{collection_id}/query", json=payload)
            results.extend(resp["results"])
            if not resp["has_more"]:
                break
            cursor = resp["next_cursor"]
        return results

    def create_page(self, database_id: str, properties: dict) -> dict:
        return self._request("POST", "/pages", json={
            "parent": {"database_id": database_id},
            "properties": properties,
        })

    def update_page(self, page_id: str, properties: dict) -> dict:
        return self._request("PATCH", f"/pages/{page_id}", json={"properties": properties})

    def delete_page(self, page_id: str) -> dict:
        return self._request("PATCH", f"/pages/{page_id}", json={"in_trash": True})


# ── Property extractors ───────────────────────────────────────────────────────

def extract(prop: dict):
    t = prop.get("type")
    if t == "title":
        return "".join(r["plain_text"] for r in prop.get("title", []))
    if t == "rich_text":
        return "".join(r["plain_text"] for r in prop.get("rich_text", []))
    if t == "text":
        return "".join(r["plain_text"] for r in prop.get("rich_text", []))
    if t == "select":
        s = prop.get("select"); return s["name"] if s else None
    if t == "number":
        return prop.get("number")
    if t == "date":
        d = prop.get("date"); return d["start"] if d else None
    if t == "relation":
        return [r["id"] for r in prop.get("relation", [])]
    if t == "created_time":
        return prop.get("created_time")
    return None

def flatten(page: dict, fields: list[str]) -> dict:
    out = {"id": page["id"]}
    for f in fields:
        if f in page["properties"]:
            out[f] = extract(page["properties"][f])
    return out


# ── Database-specific queries ─────────────────────────────────────────────────

def get_pending_tasks(client: NotionClient) -> list:
    """Tasks with Status = Pendiente or En progreso."""
    rows = client.query_all(
        TASKS_COL,
        filter={"or": [
            {"property": "Status", "select": {"equals": "Pendiente"}},
            {"property": "Status", "select": {"equals": "En progreso"}},
        ]},
        sorts=[{"property": "Deadline", "direction": "ascending"}],
    )
    return [flatten(r, ["Task", "Status", "Deadline", "Left (min)", "Actual time (min)", "Project", "Parent Task", "Subtasks"]) for r in rows]


def get_all_projects(client: NotionClient) -> list:
    """All projects."""
    rows = client.query_all(PROJECTS_COL)
    return [flatten(r, ["Project", "Type", "Status", "Context"]) for r in rows]


def get_paused_session(client: NotionClient) -> dict | None:
    """Returns the active paused session, or None."""
    rows = client.query_all(
        SESSIONS_COL,
        filter={"property": "Status", "select": {"equals": "Paused"}},
    )
    if not rows:
        return None
    return flatten(rows[0], ["Session", "Date", "Status", "Planned (min)", "Actual (min)", "Summary", "Tasks"])


def get_latest_session(client: NotionClient) -> dict | None:
    """Returns the most recent completed/cancelled session by date."""
    rows = client.query_all(
        SESSIONS_COL,
        filter={"or": [
            {"property": "Status", "select": {"equals": "Completed"}},
            {"property": "Status", "select": {"equals": "Cancelled"}},
        ]},
        sorts=[{"property": "Date", "direction": "descending"}],
    )
    if not rows:
        return None
    return flatten(rows[0], ["Session", "Date", "Status", "Planned (min)", "Actual (min)", "Summary", "Tasks"])
