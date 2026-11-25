"""Helpers for live GitHub contracts run in Actions or manually."""

from __future__ import annotations

import json
import os
from pathlib import Path


def live_pull_request_target() -> tuple[str, str, int]:
    """Return the current repository and PR, with a small stable local target."""
    repository = os.environ.get(
        "GITHUB_REPOSITORY", "vectora-company/vectora-new"
    ).strip()
    owner, separator, repo = repository.partition("/")
    if not separator or not owner or not repo:
        owner, repo = "vectora-company", "vectora-new"

    event_path = os.environ.get("GITHUB_EVENT_PATH", "").strip()
    if event_path:
        event = json.loads(Path(event_path).read_text(encoding="utf-8"))
        pull_request = event.get("pull_request")
        if isinstance(pull_request, dict):
            number = pull_request.get("number")
            if isinstance(number, int) and number > 0:
                return owner, repo, number

    return owner, repo, 75
