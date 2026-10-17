import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataForm, Empty } from "./ui";
describe("accessible forms and empty states", () => {
  it("blocks a missing required value and shows a useful error", async () => {
    const submit = vi.fn();
    render(
      <DataForm
        fields={[{ name: "name", label: "Product name", required: true }]}
        onSubmit={submit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByText("Product name is required."),
    ).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
  it("submits valid values and labels inputs", async () => {
    const submit = vi.fn();
    render(
      <DataForm
        fields={[{ name: "name", label: "Customer name", required: true }]}
        onSubmit={submit}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Customer name/), {
      target: { value: "Fictional customer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(submit.mock.calls[0]?.[0]).toEqual({ name: "Fictional customer" }),
    );
  });
  it("explains an empty page without fabricated data", () => {
    render(<Empty title="No transactions" text="Complete your first sale." />);
    expect(
      screen.getByRole("heading", { name: "No transactions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Complete your first sale.")).toBeInTheDocument();
  });
});
