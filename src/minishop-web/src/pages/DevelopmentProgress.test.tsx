import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import audit from "../../../../progress/development-progress.json";
import { ProgressDashboard } from "./DevelopmentProgress";

describe("reviewed development progress dashboard", () => {
  it("shows separate scores, pending work and release gates", () => {
    render(<ProgressDashboard data={audit} />);
    expect(screen.getByTestId("overall-progress")).toHaveTextContent("81.5%");
    expect(screen.getByTestId("functional-progress")).toHaveTextContent(
      "93.1%",
    );
    expect(screen.getByText("6 release gates still open")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Overall project completion" }),
    ).toHaveAttribute("aria-valuenow", "81.5");
    expect(screen.getByText(/not a live test monitor/)).toBeInTheDocument();
  });
  it("includes inspectable feature classifications, evidence and acceptance steps", () => {
    render(<ProgressDashboard data={audit} />);
    const milestone = document.getElementById("hardware-lan")!;
    fireEvent.click(milestone.querySelector("summary")!);
    expect(milestone).toHaveAttribute("open");
    expect(
      within(milestone).getAllByText(
        "Blocked by external requirements · Release gate",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      within(milestone).getByText(/Owner supplies the intended printer/),
    ).toBeInTheDocument();
  });
  it.each([undefined, null, {}, { milestones: [] }])(
    "handles unavailable or invalid data honestly: %j",
    (data) => {
      render(<ProgressDashboard data={data} />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Progress data is unavailable",
      );
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByText("0%")).not.toBeInTheDocument();
    },
  );
  it("offers a retry without changing task statuses", () => {
    const retry = vi.fn();
    render(<ProgressDashboard data={null} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
