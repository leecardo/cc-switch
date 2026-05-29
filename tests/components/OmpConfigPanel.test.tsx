import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OmpConfigPanel } from "@/components/settings/OmpConfigPanel";
import { ompConfigApi } from "@/lib/api/omp";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api/omp", () => ({
  ompConfigApi: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getAvailableModels: vi.fn(),
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
}));

describe("OmpConfigPanel", () => {
  beforeEach(() => {
    vi.mocked(ompConfigApi.getConfig).mockResolvedValue({
      modelRoles: {
        default: "provider-a/model-a",
        vision: "provider-b/model-b",
      },
      defaultThinkingLevel: "xhigh",
      display: { showTokenUsage: true },
    });
    vi.mocked(ompConfigApi.getAvailableModels).mockResolvedValue([
      "provider-a/model-a",
      "provider-b/model-b",
    ]);
    vi.mocked(ompConfigApi.updateConfig).mockResolvedValue(true);
  });

  it("renames a role on blur without changing config on each keystroke", async () => {
    render(<OmpConfigPanel providers={{}} />);

    const save = await screen.findByRole("button", { name: /omp.config.save/ });
    const roleInput = screen.getByDisplayValue("default") as HTMLInputElement;

    fireEvent.change(roleInput, { target: { value: "planner" } });
    fireEvent.click(save);

    await waitFor(() =>
      expect(ompConfigApi.updateConfig).toHaveBeenCalledTimes(1),
    );
    expect(ompConfigApi.updateConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modelRoles: expect.objectContaining({ default: "provider-a/model-a" }),
      }),
    );

    fireEvent.blur(roleInput);
    fireEvent.click(save);

    await waitFor(() =>
      expect(ompConfigApi.updateConfig).toHaveBeenCalledTimes(2),
    );
    expect(ompConfigApi.updateConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modelRoles: expect.not.objectContaining({ default: expect.anything() }),
      }),
    );
    expect(ompConfigApi.updateConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modelRoles: expect.objectContaining({ planner: "provider-a/model-a" }),
      }),
    );
  });

  it("does not overwrite an existing role when rename collides", async () => {
    render(<OmpConfigPanel providers={{}} />);

    const roleInput = (await screen.findByDisplayValue(
      "default",
    )) as HTMLInputElement;
    fireEvent.change(roleInput, { target: { value: "vision" } });
    fireEvent.blur(roleInput);
    fireEvent.click(screen.getByRole("button", { name: /omp.config.save/ }));

    await waitFor(() =>
      expect(ompConfigApi.updateConfig).toHaveBeenCalledTimes(1),
    );
    expect(ompConfigApi.updateConfig).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modelRoles: {
          default: "provider-a/model-a",
          vision: "provider-b/model-b",
        },
      }),
    );
  });
});
