import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppSwitcher } from "@/components/AppSwitcher";

vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe("AppSwitcher", () => {
  it("renders OMP when it is visible", () => {
    render(
      <AppSwitcher
        activeApp="omp"
        onSwitch={vi.fn()}
        visibleApps={{
          claude: false,
          "claude-desktop": false,
          codex: false,
          gemini: false,
          opencode: false,
          openclaw: false,
          hermes: false,
          omp: true,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /OMP/ })).toBeInTheDocument();
  });

  it("switches to OMP when clicked", () => {
    const onSwitch = vi.fn();

    render(
      <AppSwitcher
        activeApp="claude"
        onSwitch={onSwitch}
        visibleApps={{
          claude: true,
          "claude-desktop": false,
          codex: false,
          gemini: false,
          opencode: false,
          openclaw: false,
          hermes: false,
          omp: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /OMP/ }));

    expect(onSwitch).toHaveBeenCalledWith("omp");
  });
});
