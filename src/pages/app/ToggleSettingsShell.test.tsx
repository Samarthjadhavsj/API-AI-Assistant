import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToggleSettingsShell } from "./ToggleSettingsShell";

vi.mock("@/components", () => ({
  Button: ({ children, variant: _v, size: _s, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Card: ({ children }: any) => <div>{children}</div>,
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

// jsdom has no layout, so these guard the classes that keep long titles
// (e.g. one huge unbroken word) from overflowing the fixed-width header.
describe("ToggleSettingsShell header", () => {
  const longTitle = "X".repeat(500);

  const renderShell = () =>
    render(
      <MemoryRouter>
        <ToggleSettingsShell backTo="/toggle/settings" description="Some description" title={longTitle}>
          <p>content</p>
        </ToggleSettingsShell>
      </MemoryRouter>
    );

  it("truncates the title and description inside a shrinkable container", () => {
    renderShell();

    const heading = screen.getByRole("heading", { name: longTitle });
    expect(heading).toHaveClass("truncate");
    expect(heading.parentElement).toHaveClass("min-w-0");
    expect(screen.getByText("Some description")).toHaveClass("truncate");
  });

  it("keeps the gear icon from shrinking", () => {
    const { container } = renderShell();

    expect(container.querySelector("header svg.lucide-settings")).toHaveClass("shrink-0");
  });
});
