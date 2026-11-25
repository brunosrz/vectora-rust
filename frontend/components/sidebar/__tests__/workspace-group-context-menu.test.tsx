// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { Thread } from "@/lib/hooks/threads";
import type { WorkspaceInfo } from "@/lib/stores/workspaces-store";

vi.mock("@/lib/paraglide/messages", () => ({
  m: {
    sidebar_workspace_collapse: () => "Recolher workspace",
    sidebar_workspace_expand: () => "Expandir workspace",
    sidebar_workspace_thread_count: ({ n }: { n: number }) => `${n} sessões`,
    sidebar_ctx_edit_workspace: () => "Editar workspace",
    workspace_edit_title: () => "Editar projeto",
  },
}));

vi.mock("@/components/sidebar/thread-item", () => ({
  ThreadItem: () => null,
}));

vi.mock("@/components/sidebar/workspace-edit-dialog", () => ({
  WorkspaceEditDialog: ({
    open,
    workspace,
  }: {
    open: boolean;
    workspace: WorkspaceInfo | null;
  }) => (open ? <div role="dialog">Editar {workspace?.name}</div> : null),
}));

import { WorkspaceGroup } from "../workspace-group";

afterEach(() => {
  cleanup();
});

const workspace = {
  id: "workspace-1",
  name: "Vectora",
  cwd: "/tmp/vectora",
  transport: "local",
} as WorkspaceInfo;

const noop = vi.fn();

function renderWorkspace(transport: WorkspaceInfo["transport"] = "local") {
  return render(
    <WorkspaceGroup
      workspace={{ ...workspace, transport }}
      threads={[] as Thread[]}
      isSearching={false}
      isCollapsed={false}
      currentThreadId=""
      onToggle={noop}
      onSelect={noop}
      onDelete={noop}
      onRename={noop}
      onTogglePin={noop}
    />,
  );
}

describe("WorkspaceGroup context menu", () => {
  it("abre a edição pelo menu de contexto do cabeçalho do workspace", () => {
    renderWorkspace();
    const header = screen.getByRole("button", {
      name: "Recolher workspace",
    });

    const event = createEvent.contextMenu(header, {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    });
    fireEvent(header, event);

    expect(event.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar workspace" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Editar Vectora");
  });

  it("não oferece edição de caminhos para workspace remoto", () => {
    renderWorkspace("ssh");
    const header = screen.getByRole("button", {
      name: "Recolher workspace",
    });

    const event = createEvent.contextMenu(header, {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(header, event);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByRole("menuitem")).toBeNull();
  });
});
