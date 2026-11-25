// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = {
  workspaces: [
    {
      id: "ws-1",
      name: "Vectora",
      cwd: "C:/Vectora",
      trusted: true,
      is_git_repo: true,
      git_remote: null,
      git_current_branch: null,
      git_default_branch: null,
      transport: "local",
      source_roots: ["C:/Shared"],
    },
  ],
  active_id: "ws-1",
  safeRoots: [
    { id: "root-1", path: "C:/Projetos", label: "Projetos", builtin: false },
  ],
  status: "idle",
  error: null,
  hydrate: vi.fn(),
  loadSafeRoots: vi.fn(),
  setActive: vi.fn(),
  updateProject: vi.fn(),
};

vi.mock("@/lib/stores/workspaces-store", () => ({
  useWorkspacesStore: (selector: (value: typeof state) => unknown) =>
    selector(state),
}));

vi.mock("@/lib/hooks/use-network-status", () => ({
  useNetworkStatus: () => ({ offline: false }),
}));

vi.mock("@/lib/api/sandbox", () => ({
  getSandboxPolicy: vi.fn(async () => ({ env_pass: [] })),
  putSandboxPolicy: vi.fn(),
}));

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get: (_target, property) => () => String(property),
    },
  ),
}));

vi.mock("../workspace-trust-dialog", () => ({
  WorkspaceTrustDialog: ({
    open,
    initialPath,
  }: {
    open: boolean;
    initialPath?: string;
  }) => (open ? <div data-testid="trust-dialog">{initialPath}</div> : null),
}));

import { WorkspaceSelector } from "../workspace-selector";

function renderSelector() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceSelector />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkspaceSelector", () => {
  it("exibe workspaces e safe-roots já carregados pela raiz", () => {
    renderSelector();
    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(screen.getAllByText("Vectora").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Projetos")).toBeInTheDocument();
  });

  it("abre o diálogo já posicionado na safe-root escolhida", () => {
    renderSelector();
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByText("Projetos"));

    expect(screen.getByTestId("trust-dialog")).toHaveTextContent("C:/Projetos");
  });

  it("permite abrir a edição do projeto local", () => {
    renderSelector();
    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "workspace_edit_title: Vectora" }),
    );

    expect(screen.getByText("workspace_edit_description")).toBeInTheDocument();
    expect(screen.getByDisplayValue("C:/Vectora")).toBeInTheDocument();
    expect(screen.getByText("C:/Shared")).toBeInTheDocument();
  });
});
