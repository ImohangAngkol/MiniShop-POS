import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "../types";
const mock = vi.hoisted(() => ({ get: vi.fn(), flash: vi.fn() }));
vi.mock("../App", () => ({
  useUser: () => ({
    id: "scanner-test",
    displayName: "Fictional cashier",
    roles: ["Cashier"],
  }),
}));
vi.mock("../api", async () => ({
  ...(await vi.importActual<typeof import("../api")>("../api")),
  api: { get: mock.get },
  invalidate: vi.fn(),
}));
vi.mock("../ui", async () => ({
  ...(await vi.importActual<typeof import("../ui")>("../ui")),
  useFlash: () => mock.flash,
  useData: (path: string) => ({
    data: path.startsWith("/products") ? { items: [product], total: 1 } : [],
    isPending: false,
    error: null,
  }),
}));
import { PosPage } from "./Pos";
const product: Product = {
  id: 1,
  name: "Fictional scanner item",
  sku: "SKU-1",
  barcode: "000123",
  unit: "piece",
  sellingPrice: 10,
  costPrice: null,
  categoryId: 1,
  categoryName: "Test",
  lowStockThreshold: 1,
  active: true,
  availableStock: 5,
  stock: 5,
};
function scan(code: string) {
  const input = screen.getByLabelText("Scan barcode or search products");
  fireEvent.change(input, { target: { value: code } });
  fireEvent.submit(input.closest("form")!);
}
beforeEach(() => {
  sessionStorage.clear();
  mock.get.mockReset();
  mock.flash.mockReset();
});
describe("keyboard-compatible barcode input", () => {
  it("queues repeated scans, retains leading zeros and increments one cart line", async () => {
    mock.get.mockResolvedValue({ data: product });
    render(
      <MemoryRouter>
        <PosPage />
      </MemoryRouter>,
    );
    scan("000123");
    scan("000123");
    scan(" 000123 ");
    await waitFor(() =>
      expect(screen.getByLabelText(`Quantity for ${product.name}`)).toHaveValue(
        3,
      ),
    );
    expect(mock.get).toHaveBeenCalledTimes(3);
    expect(mock.get).toHaveBeenCalledWith("/products/scan?code=000123");
  });
  it("never adds the sole fuzzy search result for an unknown code", async () => {
    mock.get.mockRejectedValue(new Error("Unknown barcode"));
    render(
      <MemoryRouter>
        <PosPage />
      </MemoryRouter>,
    );
    scan("UNKNOWN");
    await waitFor(() =>
      expect(mock.flash).toHaveBeenCalledWith("Unknown barcode", "error"),
    );
    expect(
      screen.queryByLabelText(`Quantity for ${product.name}`),
    ).not.toBeInTheDocument();
  });
  it("keeps the next typed code when a slow lookup finishes and blocks checkout until scans resolve", async () => {
    let finish!: (value: { data: Product }) => void;
    mock.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <MemoryRouter>
        <PosPage />
      </MemoryRouter>,
    );
    scan("000123");
    await waitFor(() => expect(mock.get).toHaveBeenCalled());
    const input = screen.getByLabelText("Scan barcode or search products");
    fireEvent.change(input, { target: { value: "NEXT-CODE" } });
    expect(
      screen.getByRole("button", { name: /Complete sale/ }),
    ).toBeDisabled();
    finish({ data: product });
    await waitFor(() =>
      expect(screen.getByLabelText(`Quantity for ${product.name}`)).toHaveValue(
        1,
      ),
    );
    expect(input).toHaveValue("NEXT-CODE");
  });
  it("enforces available stock across duplicate scans", async () => {
    mock.get.mockResolvedValue({ data: { ...product, availableStock: 1 } });
    render(
      <MemoryRouter>
        <PosPage />
      </MemoryRouter>,
    );
    scan("000123");
    scan("000123");
    await waitFor(() =>
      expect(mock.flash).toHaveBeenCalledWith(
        "There is not enough available stock.",
        "error",
      ),
    );
    expect(screen.getByLabelText(`Quantity for ${product.name}`)).toHaveValue(
      1,
    );
  });
  it("supports empty-input feedback and an explicit focus recovery button", async () => {
    render(
      <MemoryRouter>
        <PosPage />
      </MemoryRouter>,
    );
    scan(" ");
    expect(mock.get).not.toHaveBeenCalled();
    expect(mock.flash).toHaveBeenCalledWith(
      "Scan a barcode or enter an exact SKU first.",
      "error",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Focus barcode scanner" }),
    );
    expect(
      screen.getByLabelText("Scan barcode or search products"),
    ).toHaveFocus();
  });
});
