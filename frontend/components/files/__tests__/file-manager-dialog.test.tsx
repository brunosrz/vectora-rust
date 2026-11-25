// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_target, key: string) => () => key }),
}));

import { FileManagerDialog, readManagedFile } from "../file-manager-dialog";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const response = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 403,
  json: async () => body,
  blob: async () => new Blob(["image bytes"], { type: "image/png" }),
});

describe("FileManagerDialog", () => {
  it("selects a folder using the Vectora browser", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      response({
        path: url.includes("child") ? "/safe/child" : "/safe",
        parent: "/safe",
        entries: [{ name: "child", path: "/safe/child", is_dir: true }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSelect = vi.fn();
    render(
      <FileManagerDialog
        open
        onOpenChange={vi.fn()}
        selection="folder"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(await screen.findByText("child"));
    await waitFor(() =>
      expect(screen.getByLabelText("file_manager_location")).toHaveValue(
        "/safe/child",
      ),
    );
    fireEvent.click(screen.getByText("file_manager_select_folder"));

    expect(onSelect).toHaveBeenCalledWith("/safe/child");
    expect(fetchMock).toHaveBeenCalledWith("/workspaces/browse?", {
      credentials: "include",
    });
  });

  it("selects and reads a file, while handling access errors", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("browse/file")
        ? response(null)
        : response({
            path: "/safe",
            parent: null,
            entries: [
              { name: "picture.png", path: "/safe/picture.png", is_dir: false },
            ],
          }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onSelect = vi.fn();
    render(
      <FileManagerDialog
        open
        onOpenChange={vi.fn()}
        selection="file"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(await screen.findByText("picture.png"));
    fireEvent.click(screen.getByText("file_manager_select_file"));
    expect(onSelect).toHaveBeenCalledWith("/safe/picture.png");

    const file = await readManagedFile("/safe/picture.png");
    expect(file.name).toBe("picture.png");
    expect(file.type).toBe("image/png");

    fetchMock.mockResolvedValueOnce(
      response({ detail: "outside safe roots" }, false),
    );
    await expect(readManagedFile("/outside/private.pem")).rejects.toThrow(
      "outside safe roots",
    );
  });

  it("does not call selection when cancelled and reports browse errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ detail: "forbidden" }, false)),
    );
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <FileManagerDialog
        open
        onOpenChange={onOpenChange}
        selection="folder"
        onSelect={onSelect}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("forbidden");
    fireEvent.click(screen.getByText("workspace_cancel"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
