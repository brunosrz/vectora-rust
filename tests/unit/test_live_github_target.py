from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests.live_github import live_pull_request_target


def test_live_pull_request_target_uses_current_event_pr(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    event_path = tmp_path / "event.json"
    event_path.write_text(
        json.dumps({"pull_request": {"number": 98}}), encoding="utf-8"
    )
    monkeypatch.setenv("GITHUB_REPOSITORY", "vectora-company/vectora-new")
    monkeypatch.setenv("GITHUB_EVENT_PATH", str(event_path))

    assert live_pull_request_target() == ("vectora-company", "vectora-new", 98)


def test_live_pull_request_target_uses_small_same_repo_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GITHUB_REPOSITORY", "octocat/Hello-World")
    monkeypatch.delenv("GITHUB_EVENT_PATH", raising=False)

    assert live_pull_request_target() == ("octocat", "Hello-World", 75)
