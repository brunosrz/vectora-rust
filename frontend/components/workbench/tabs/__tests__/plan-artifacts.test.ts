// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchArtifactContent,
  fetchArtifacts,
  shouldShowPlanLoadSpinner,
} from "../plan-tab";

afterEach(() => vi.unstubAllGlobals());

describe("fetchArtifacts", () => {
  it("surfaces a failed response so the Plan workbench can show recovery UI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );

    await expect(fetchArtifacts("thread-1")).rejects.toThrow(
      "Artifact request failed (503)",
    );
  });

  it("returns the artifacts for the requested thread", async () => {
    const artifacts = [
      {
        title: "Implementation plan",
        path: "artifacts/plan.md",
        created_at: "2026-11-24T00:00:00Z",
      },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ artifacts })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchArtifacts("thread-1")).resolves.toEqual(artifacts);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "session_id=thread-1",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
    });
  });
});

describe("fetchArtifactContent", () => {
  it("requests workspace plan content through the workspace-scoped source", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ content: "# plano" })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchArtifactContent("thread-1", {
        title: "Plano",
        path: "/workspace/.vectora/plans/plano-local.md",
        session_id: "thread-1",
        created_at: "2026-11-25T00:00:00Z",
        artifact_type: "workspace_plan",
      }),
    ).resolves.toBe("# plano");

    const url = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
      "http://localhost",
    );
    expect(url.pathname).toBe("/artifacts/plano-local");
    expect(url.searchParams.get("session_id")).toBe("thread-1");
    expect(url.searchParams.get("source")).toBe("workspace_plan");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
    });
  });
});

describe("Plan workbench loading state", () => {
  it("ends the initial spinner after a failed request", () => {
    expect(shouldShowPlanLoadSpinner(0, false, false)).toBe(false);
  });

  it("shows a spinner for a retry without hiding cached plan content", () => {
    expect(shouldShowPlanLoadSpinner(0, true, false)).toBe(true);
    expect(shouldShowPlanLoadSpinner(Date.now(), true, true)).toBe(false);
  });
});
