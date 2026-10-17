import { describe, expect, it } from "vitest";
import { cartTotals } from "./format";
describe("cashier totals", () => {
  it("uses decimal arithmetic and rounds each weighted line like the backend", () => {
    expect(
      cartTotals([{ quantity: 1.125, sellingPrice: 58.63 }], 0, 100),
    ).toEqual({ subtotal: 65.96, total: 65.96, change: 34.04, credit: 0 });
  });
  it("calculates partial cash and outstanding credit after discounts", () => {
    expect(cartTotals([{ quantity: 3, sellingPrice: 10 }], 5, 10)).toEqual({
      subtotal: 30,
      total: 25,
      change: 0,
      credit: 15,
    });
  });
  it("avoids binary floating point errors across many small items", () => {
    expect(
      cartTotals(
        [
          { quantity: 3, sellingPrice: 0.1 },
          { quantity: 1, sellingPrice: 0.2 },
        ],
        0,
        1,
      ).change,
    ).toBe(0.5);
  });
});
