import Decimal from "decimal.js";
export const money = (n: number | string) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(n),
  );
export const qty = (n: number) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 }).format(n);
export const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function cartTotals(
  items: { quantity: number; sellingPrice: number }[],
  discount: number,
  cash: number,
) {
  const subtotal = items.reduce(
    (sum, i) =>
      sum.plus(
        new Decimal(i.quantity)
          .times(i.sellingPrice)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      ),
    new Decimal(0),
  );
  const total = subtotal.minus(discount);
  const change = Decimal.max(0, new Decimal(cash).minus(total));
  const credit = Decimal.max(0, total.minus(cash));
  return {
    subtotal: subtotal.toNumber(),
    total: total.toNumber(),
    change: change.toNumber(),
    credit: credit.toNumber(),
  };
}
