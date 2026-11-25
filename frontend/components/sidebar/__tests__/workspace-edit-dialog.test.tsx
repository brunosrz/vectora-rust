// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { SandboxPolicy } from "@/lib/api/sandbox";
import type { WorkspaceInfo } from "@/lib/stores/workspaces-store";

const api = vi.hoisted(() => ({
  getSandboxPolicy: vi.fn(),
  putSandboxPolicy: vi.fn(),
}));
vi.mock("@/lib/api/sandbox", () => api);

vi.mock("@/lib/stores/workspaces-store", () => ({
  useWorkspacesStore: (
    selector: (state: { updateProject: () => void }) => unknown,
  ) => selector({ updateProject: vi.fn().mockResolvedValue({ ok: true }) }),
}));

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get: (_target, name: string) => (args?: Record<string, string>) => {
        const key = String(name);
        return args?.error ? `${key}: ${args.error}` : key;
      },
    },
  ),
}));

import { WorkspaceEditDialog } from "../workspace-edit-dialog";

const policy = (env_pass: string[] = []): SandboxPolicy => ({
  enabled: true,
  rw_paths: ["/project"],
  ro_paths: [],
  mask: [".env"],
  no_gpu: true,
  lockdown: false,
  allow_tcp_ports: [],
  env_pass,
  git_writable: false,
  require_full_isolation: false,
  network: "filtered",
  allow_hosts: ["api.example.com"],
  credential_bindings: [],
  registry_hosts: true,
  max_file_mb: 4096,
  memory_limit_mb: null,
  tmp_size_mb: 1024,
  ignored_repo_keys: [],
  user_policy: true,
});

const workspace = (id: string): WorkspaceInfo => ({
  id,
  name: `Project ${id}`,
  cwd: `/${id}`,
  source_roots: [],
  trusted: true,
  is_git_repo: false,
  git_remote: null,
  git_current_branch: null,
  git_default_branch: null,
  transport: "local",
});

function renderDialog(currentWorkspace: WorkspaceInfo) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceEditDialog
        open
        workspace={currentWorkspace}
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getSandboxPolicy.mockImplementation(async (id: string) =>
    policy(id === "ws-1" ? ["WS_ONE"] : ["WS_TWO"]),
  );
  api.putSandboxPolicy.mockImplementation(async (_id, value) => value);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WorkspaceEditDialog environment settings", () => {
  it("saves the environment allowlist while preserving the rest of the policy", async () => {
    renderDialog(workspace("ws-1"));

    const editor = await screen.findByLabelText(
      "workspace_environment_variables",
    );
    fireEvent.change(editor, {
      target: { value: "NPM_TOKEN\n NODE_OPTIONS " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "workspace_environment_save" }),
    );

    await waitFor(() =>
      expect(api.putSandboxPolicy).toHaveBeenCalledWith(
        "ws-1",
        expect.objectContaining({
          env_pass: ["NPM_TOKEN", "NODE_OPTIONS"],
          rw_paths: ["/project"],
          network: "filtered",
          allow_hosts: ["api.example.com"],
        }),
      ),
    );
    expect(
      await screen.findByText("workspace_environment_saved"),
    ).toHaveAttribute("role", "status");
  });

  it("shows a rejected invalid variable name and keeps the draft", async () => {
    api.putSandboxPolicy.mockRejectedValueOnce(
      new Error("Nome de variável de ambiente inválido."),
    );
    renderDialog(workspace("ws-1"));

    const editor = await screen.findByLabelText(
      "workspace_environment_variables",
    );
    fireEvent.change(editor, { target: { value: "BAD-NAME" } });
    fireEvent.click(
      screen.getByRole("button", { name: "workspace_environment_save" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nome de variável de ambiente inválido.",
    );
    expect(editor).toHaveValue("BAD-NAME");
  });

  it("loads a separate allowlist when switching workspaces", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const view = render(
      <QueryClientProvider client={client}>
        <WorkspaceEditDialog
          open
          workspace={workspace("ws-1")}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByLabelText("workspace_environment_variables"),
    ).toHaveValue("WS_ONE");
    view.rerender(
      <QueryClientProvider client={client}>
        <WorkspaceEditDialog
          open
          workspace={workspace("ws-2")}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText("workspace_environment_variables"),
      ).toHaveValue("WS_TWO"),
    );
    expect(api.getSandboxPolicy).toHaveBeenCalledWith("ws-2");
  });
});
