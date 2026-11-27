// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let artifacts: Array<{
  title: string;
  path: string;
  session_id: string;
  created_at: string;
}> = [];
let planFetchedAt = 0;
const invalidatePlan = vi.fn(() => {
  planFetchedAt = 0;
});

const planState = {
  getPlan: () => ({
    items: artifacts,
    openSlugs: [],
    contentsBySlug: {},
    fetchedAt: planFetchedAt,
  }),
  getTodos: () => [],
  setPlanItems: (_threadId: string, next: typeof artifacts) => {
    artifacts = next;
    planFetchedAt = Date.now();
  },
  invalidatePlan,
  togglePlanOpenSlug: vi.fn(),
  setPlanContent: vi.fn(),
};

vi.mock("@/lib/stores/workbench-store", () => ({
  WORKBENCH_STALE_MS: 30_000,
  useWorkbenchStore: (select: (state: typeof planState) => unknown) =>
    select(planState),
}));

vi.mock("@/lib/stores/settings-store", () => ({
  useSettingsStore: (
    select: (state: { planAutoExpand: boolean; planSort: string }) => unknown,
  ) => select({ planAutoExpand: false, planSort: "date" }),
}));

vi.mock("@/lib/stores/chat-input-store", () => ({
  useChatInputStore: { getState: () => ({ pushDraft: vi.fn() }) },
}));

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));

vi.mock("@/lib/api/vectora-client", () => ({
  approveThreadDAG: vi.fn(),
  authenticatedFetch: (path: string, init?: RequestInit) =>
    fetch(path, { ...init, credentials: "include" }),
  cancelThreadDAG: vi.fn(),
  getThreadActivity: vi.fn(async () => ({ files_touched: [] })),
  getThreadDAG: vi.fn(async () => null),
}));

import { PlanTab } from "../plan-tab";

function renderPlanTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanTab threadId="thread-plan" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  artifacts = [];
  planFetchedAt = 0;
  invalidatePlan.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PlanTab loading outcomes", () => {
  it("shows the empty state only after a successful empty artifact response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ artifacts: [] }), { status: 200 }),
      ),
    );

    renderPlanTab();

    expect(await screen.findByText("workbench_plan_empty")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a failed artifact read actionable instead of reporting no plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );

    renderPlanTab();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "workbench_plan_load_failed",
      ),
    );
    expect(screen.getByText("workbench_plan_load_retry")).toBeInTheDocument();
    expect(screen.queryByText("workbench_plan_empty")).not.toBeInTheDocument();
  });

  it("lists a saved plan returned by the artifact endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              artifacts: [
                {
                  title: "Plano de execução",
                  path: "artifacts/plano-de-execucao.md",
                  session_id: "thread-plan",
                  created_at: "2026-11-25T12:00:00Z",
                  artifact_type: "plan",
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );

    renderPlanTab();

    expect(await screen.findByText("Plano de execução")).toBeInTheDocument();
    expect(screen.queryByText("workbench_plan_empty")).not.toBeInTheDocument();
  });

  it("lists every plan saved in the active local workspace", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              artifacts: [
                {
                  title: "Plano de execução: arquitetura reutilizável",
                  path: "/workspace/.vectora/plans/plano-de-execucao.md",
                  session_id: "thread-plan",
                  created_at: "2026-11-25T12:00:00Z",
                  artifact_type: "workspace_plan",
                },
                {
                  title: "Plano: arquitetura reutilizável",
                  path: "/workspace/.vectora/plans/plano-de-refatoracao.md",
                  session_id: "thread-plan",
                  created_at: "2026-11-24T12:00:00Z",
                  artifact_type: "workspace_plan",
                },
              ],
            }),
          ),
      ),
    );

    renderPlanTab();

    expect(
      await screen.findByText("Plano de execução: arquitetura reutilizável"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Plano: arquitetura reutilizável"),
    ).toBeInTheDocument();
    expect(screen.queryByText("workbench_plan_empty")).not.toBeInTheDocument();
  });

  it("revalidates a cached empty list when the Plan tab is reopened", async () => {
    planFetchedAt = Date.now();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              artifacts: [
                {
                  title: "Plano criado no workspace",
                  path: "/workspace/.vectora/plans/plano.md",
                  session_id: "thread-plan",
                  created_at: "2026-11-25T12:00:00Z",
                  artifact_type: "workspace_plan",
                },
              ],
            }),
          ),
      ),
    );

    renderPlanTab();

    await waitFor(() =>
      expect(invalidatePlan).toHaveBeenCalledWith("thread-plan"),
    );
  });
});
