// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VerticalSplit } from "../vertical-split";

describe("VerticalSplit", () => {
  it("gives the tree the available height when the viewer is closed", () => {
    const { container } = render(
      <VerticalSplit
        className="h-full flex-1 min-h-0"
        showBottom={false}
        bottomSize={240}
        onResize={vi.fn()}
        top={<div role="tree" />}
        bottom={<div data-testid="viewer" />}
      />,
    );

    expect(screen.getByRole("tree").parentElement).toHaveClass(
      "flex-1",
      "min-h-0",
    );
    expect(container.firstElementChild).toHaveClass("h-full", "min-h-0");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
  });

  it("keeps the viewer minimum and leaves at least 80px for the tree while resizing", () => {
    const onResize = vi.fn();
    const { container } = render(
      <VerticalSplit
        className="h-full"
        showBottom
        bottomSize={180}
        minBottom={120}
        maxBottom={900}
        onResize={onResize}
        top={<div role="tree" />}
        bottom={<div data-testid="viewer" />}
      />,
    );
    const split = container.firstElementChild as HTMLDivElement;
    vi.spyOn(split, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 400,
      width: 200,
      height: 400,
      toJSON: () => ({}),
    });
    const handle = screen.getByRole("separator");

    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 390 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 0 });

    expect(onResize).toHaveBeenNthCalledWith(1, 120);
    expect(onResize).toHaveBeenNthCalledWith(2, 320);
    expect(screen.getByTestId("viewer")).toBeInTheDocument();
  });
});
