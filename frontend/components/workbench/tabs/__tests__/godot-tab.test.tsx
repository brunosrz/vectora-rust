// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mockWorkspace = {
  id: "ws-1",
  trusted: true,
  transport: "local",
  cwd: "/tmp/project",
};

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));

vi.mock("@/lib/stores/workspaces-store", () => ({
  useWorkspacesStore: (
    selector: (state: { getActive: () => unknown }) => unknown,
  ) => selector({ getActive: () => mockWorkspace }),
}));
vi.mock("@/components/files/file-manager-dialog", () => ({
  FileManagerDialog: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (path: string) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onSelect("/opt/godot/Godot")}>
        choose executable
      </button>
    ) : null,
}));

import { GodotTab } from "../godot-tab";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("GodotTab", () => {
  it("sends the nested project path and presents a successful validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "passed",
          message: "Importação e inicialização concluídas.",
          engine_version: "4.6.3",
          configured_version: "4.6",
          stages: [
            {
              stage: "import",
              exit_code: 0,
              timed_out: false,
              output: "Import successful",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<GodotTab />);
    fireEvent.change(screen.getByLabelText("godot_workbench_project_path"), {
      target: { value: "games/platformer" },
    });
    fireEvent.change(
      screen.getByLabelText("godot_workbench_expected_version"),
      {
        target: { value: "4.6" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "godot_workbench_validate" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/workspaces/ws-1/godot/validate");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      project_path: "games/platformer",
      expected_version: "4.6",
      executable_path: null,
    });
    expect(
      await screen.findByText("godot_workbench_passed"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("godot_workbench_gameplay_note"),
    ).toBeInTheDocument();
    expect(screen.getByText("Import successful")).toBeInTheDocument();
  });

  it("selects and sends the Godot executable using Vectora's file manager", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "passed", message: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<GodotTab />);

    fireEvent.click(
      screen.getByRole("button", { name: "godot_workbench_browse_executable" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "choose executable" }));
    fireEvent.click(
      screen.getByRole("button", { name: "godot_workbench_validate" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      project_path: ".",
      expected_version: null,
      executable_path: "/opt/godot/Godot",
    });
    expect(localStorage.getItem("godot-executable:ws-1")).toBe(
      "/opt/godot/Godot",
    );
  });

  it("blocks execution for an untrusted workspace", () => {
    mockWorkspace.trusted = false;
    render(<GodotTab />);

    expect(
      screen.getByRole("button", { name: "godot_workbench_validate" }),
    ).toBeDisabled();
    expect(
      screen.getByText("godot_workbench_trust_required"),
    ).toBeInTheDocument();
    mockWorkspace.trusted = true;
  });

  it("shows endpoint errors instead of a success state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Godot não instalado." }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(<GodotTab />);
    fireEvent.click(
      screen.getByRole("button", { name: "godot_workbench_validate" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Godot não instalado.",
    );
    expect(
      screen.queryByText("godot_workbench_passed"),
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      "unconfigured",
      "Godot não encontrado no PATH nem em VECTORA_GODOT_EXECUTABLE.",
      "engine_discovery",
    ],
    [
      "invalid selected file",
      "O executável Godot selecionado não existe ou não pode ser executado.",
      "engine_discovery",
    ],
    [
      "incompatible version",
      "O executável não corresponde à versão esperada pelo projeto.",
      "engine_version",
    ],
  ])(
    "shows a distinct result when Godot is %s",
    async (_case, message, stage) => {
      if (_case === "invalid selected file") {
        localStorage.setItem("godot-executable:ws-1", "/missing/Godot");
      }
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ status: "error", stage, message }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      render(<GodotTab />);
      fireEvent.click(
        screen.getByRole("button", { name: "godot_workbench_validate" }),
      );

      expect(await screen.findByText(message)).toBeInTheDocument();
    },
  );
});
