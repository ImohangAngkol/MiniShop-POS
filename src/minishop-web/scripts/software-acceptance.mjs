import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { request } from "@playwright/test";
import Decimal from "decimal.js";

// Fixed fictional database/loopback host only. Never accepts a shop URL or credentials on the CLI.
const root = new URL("../../../.runtime/acceptance/", import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, root), "utf8"));
const credentials = await read("credentials.json");
const dataset = await read("dataset.json");
assert.equal(dataset.fictional, true);
const reportsOnly = process.argv.includes("--reports");
if (!reportsOnly) {
  const alreadyRun = await access(new URL("scenarios.json", root)).then(
    () => true,
    () => false,
  );
  assert.equal(
    alreadyRun,
    false,
    "The write workload is one-shot against the fictional baseline. Existing evidence/data are preserved; use --reports for read-only reconciliation.",
  );
}
const scenarios = reportsOnly ? await read("scenarios.json") : [];
const contexts = [];
const money = (n) =>
  new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
const sum = (values) =>
  values.reduce((total, n) => total.plus(n), new Decimal(0)).toNumber();
async function scenario(id, title, expected, action) {
  const previous = scenarios.findIndex((item) => item.id === id);
  if (previous !== -1) scenarios.splice(previous, 1);
  const started = Date.now();
  try {
    const actual = await action();
    scenarios.push({
      id,
      title,
      expected,
      actual,
      status: "passed",
      durationMs: Date.now() - started,
    });
    console.log(`PASS ${id}: ${title}`);
  } catch (error) {
    scenarios.push({
      id,
      title,
      expected,
      actual: error.message,
      status: "failed",
      durationMs: Date.now() - started,
    });
    console.error(`FAIL ${id}: ${title}: ${error.message}`);
  }
  await writeFile(
    new URL("scenarios.json", root),
    JSON.stringify(scenarios, null, 2),
  );
}
async function session(prefix) {
  const context = await request.newContext({
    baseURL: "https://127.0.0.1:5843",
    timeout: 60000,
  });
  contexts.push(context);
  let token = (await (await context.get("/api/auth/csrf")).json()).token;
  const login = await context.post("/api/auth/login", {
    data: {
      email: credentials[prefix + "Email"],
      password: credentials[prefix + "Password"],
    },
    headers: { "X-CSRF-TOKEN": token },
  });
  assert.equal(login.status(), 200, "Fictional account login");
  token = (await (await context.get("/api/auth/csrf")).json()).token;
  const raw = (method, url, data) =>
    context.fetch(url, { method, data, headers: { "X-CSRF-TOKEN": token } });
  const call = async (method, url, data, status = 200) => {
    const response = await raw(method, url, data);
    assert.equal(
      response.status(),
      status,
      `${method} ${url}: ${await response.text()}`,
    );
    return status === 204 ? null : response.json();
  };
  return {
    context,
    raw,
    call,
    get: (url) => call("GET", url),
    post: (url, data) => call("POST", url, data),
  };
}
const owner = await session("Owner");
const p = (n) =>
  dataset.products.find(
    (item) => item.Sku === `ACCEPT-${String(n).padStart(3, "0")}`,
  );
const stock = async (n) =>
  (await owner.get(`/api/products/scan?code=${p(n).Sku}`)).stock;
const checkout = (items, extra = {}) => ({
  requestId: randomUUID(),
  items: items.map(([n, quantity]) => ({ productId: p(n).Id, quantity })),
  cashReceived: 10000,
  discount: 0,
  onCredit: false,
  ...extra,
});
const refund = (sale) =>
  owner.post(`/api/sales/${sale.id}/refund`, {
    reason: "Fictional acceptance full reversal",
  });
const customer = (name, creditLimit = 500) =>
  owner.post("/api/customers", {
    name: `Fictional acceptance ${name} ${randomUUID().slice(0, 8)}`,
    creditLimit,
  });
try {
  if (!reportsOnly) {
    const cashier1 = await session("Cashier1"),
      cashier2 = await session("Cashier2");
    await scenario(
      "A01",
      "300-product fictional convenience store catalog",
      "300 unique SKUs/barcodes, 50 per category; 6 initial out-of-stock products",
      async () => {
        assert.equal(dataset.products.length, 300);
        assert.equal(
          new Set(dataset.products.map((item) => item.Sku)).size,
          300,
        );
        assert.equal(
          new Set(dataset.products.map((item) => item.Barcode)).size,
          300,
        );
        const catalog = [
          ...(await owner.get("/api/products?pageSize=200")).items,
          ...(await owner.get("/api/products?pageSize=200&page=2")).items,
        ];
        assert.equal(
          catalog.filter((item) => item.sku.startsWith("ACCEPT-")).length,
          300,
        );
        for (const category of new Set(catalog.map((item) => item.categoryId)))
          assert.equal(
            catalog.filter((item) => item.categoryId === category).length,
            50,
          );
        assert.equal(catalog.filter((item) => item.stock === 0).length, 6);
        return "300 products, six categories, unique codes, six empty products verified through paginated API";
      },
    );
    await scenario(
      "A02",
      "Repeated scans, weighted basket, discount, cash and change",
      "Subtotal 173.46; owner discount 3.46; total 170; tender 200; change 30; refund restores exact stock",
      async () => {
        const before = await Promise.all([1, 51, 251, 252].map(stock));
        const sale = await owner.post(
          "/api/sales",
          checkout(
            [
              [1, 1],
              [1, 1],
              [51, 3],
              [251, 1.125],
              [252, 250],
            ],
            { discount: 3.46, cashReceived: 200 },
          ),
        );
        assert.deepEqual(
          [
            sale.subtotal,
            sale.total,
            sale.change,
            sale.cashApplied,
            sale.credit,
            sale.items.length,
          ],
          [173.46, 170, 30, 170, 0, 4],
        );
        assert.deepEqual(
          await Promise.all([1, 51, 251, 252].map(stock)),
          before.map((n, i) =>
            new Decimal(n).minus([2, 3, 1.125, 250][i]).toNumber(),
          ),
        );
        await refund(sale);
        assert.deepEqual(
          await Promise.all([1, 51, 251, 252].map(stock)),
          before,
        );
        return `Sale ${sale.reference}: exact weighted rounding/tender and full stock reversal passed`;
      },
    );
    await scenario(
      "A03",
      "Out-of-stock and invalid baskets roll back",
      "409 for empty stock; 400 for fractional piece, insufficient cash and excess discount; unchanged stock",
      async () => {
        const before = await stock(1);
        await owner.call("POST", "/api/sales", checkout([[50, 1]]), 409);
        for (const body of [
          checkout([[1, 0.5]]),
          checkout([[1, 1]], { cashReceived: 0 }),
          checkout([[1, 1]], { discount: 21 }),
        ])
          await owner.call("POST", "/api/sales", body, 400);
        assert.equal(await stock(1), before);
        return "Four rejected baskets; no inventory effect";
      },
    );
    await scenario(
      "A04",
      "Utang, partial repayment and refund after repayment",
      "70 sale: cash 20 + debt 50; repay 15 leaves 35; refund cash 35 and debt zero",
      async () => {
        const c = await customer("partial repayment");
        const sale = await cashier1.post(
          "/api/sales",
          checkout(
            [
              [1, 2],
              [51, 2],
            ],
            { customerId: c.id, cashReceived: 20, onCredit: true },
          ),
        );
        assert.deepEqual(
          [sale.total, sale.cashApplied, sale.credit],
          [70, 20, 50],
        );
        const repayment = await cashier2.post(
          `/api/customers/${c.id}/repayments`,
          { requestId: randomUUID(), amount: 15 },
        );
        assert.equal(repayment.balance, 35);
        assert.equal((await refund(sale)).refundCash, 35);
        assert.equal(
          (await owner.get(`/api/customers/${c.id}/ledger`)).balance,
          0,
        );
        return "Two cashier identities, partial repayment, refund cash and customer balance reconciled";
      },
    );
    await scenario(
      "A05",
      "Concurrent duplicate checkout and key conflicts",
      "Eight identical requests create one sale/one stock decrement; changed payload/actor rejected 409",
      async () => {
        const before = await stock(151),
          body = checkout([[151, 1]]);
        const responses = await Promise.all(
          Array.from({ length: 8 }, () => cashier1.post("/api/sales", body)),
        );
        assert.equal(new Set(responses.map((sale) => sale.id)).size, 1);
        assert.equal(await stock(151), before - 1);
        await cashier1.call(
          "POST",
          "/api/sales",
          { ...body, cashReceived: 9999 },
          409,
        );
        await cashier2.call("POST", "/api/sales", body, 409);
        return `Eight responses share sale ${responses[0].id}; single inventory effect`;
      },
    );
    await scenario(
      "A06",
      "Uncertain checkout response and safe retry",
      "Discard committed response then retry original request key: same sale and one inventory effect",
      async () => {
        const body = checkout([[201, 1]]),
          before = await stock(201);
        const response = await cashier2.raw("POST", "/api/sales", body);
        assert.equal(response.status(), 200);
        await response.dispose(); // Deliberately discard its body, as with a lost acknowledgement.
        const recovered = await cashier2.post("/api/sales", body);
        assert.equal(await stock(201), before - 1);
        assert.equal(
          (await cashier2.post("/api/sales", body)).id,
          recovered.id,
        );
        return "Lost-acknowledgement simulation recovered one committed sale; transport fault before send covered by browser workflow";
      },
    );
    await scenario(
      "A07",
      "Two cashiers race for scarce stock",
      "20 requests for five available units: exactly five sales, 15 conflicts, final stock zero",
      async () => {
        assert.equal(
          await stock(50),
          0,
          "Use a fresh acceptance baseline for this workload",
        );
        await owner.post("/api/inventory/receive", {
          productId: p(50).Id,
          quantity: 5,
          unitCost: 12,
          reference: "FICTIONAL SCARCE STOCK",
        });
        const results = await Promise.all(
          Array.from({ length: 20 }, (_, i) =>
            (i % 2 ? cashier1 : cashier2).raw(
              "POST",
              "/api/sales",
              checkout([[50, 1]]),
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status() === 200).length, 5);
        assert.equal(results.filter((r) => r.status() === 409).length, 15);
        assert.equal(await stock(50), 0);
        return "5 committed, 15 safely rejected, 0 units remaining";
      },
    );
    let limitCustomer;
    await scenario(
      "A08",
      "Concurrent utang respects a household credit limit",
      "12 requests of 20 against limit 100: five accepted; balance exactly 100",
      async () => {
        limitCustomer = await customer("credit race", 100);
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            (i % 2 ? cashier1 : cashier2).raw(
              "POST",
              "/api/sales",
              checkout([[1, 1]], {
                cashReceived: 0,
                customerId: limitCustomer.id,
                onCredit: true,
              }),
            ),
          ),
        );
        assert.equal(results.filter((r) => r.status() === 200).length, 5);
        assert.equal(results.filter((r) => r.status() === 409).length, 7);
        assert.equal(
          (await owner.get(`/api/customers/${limitCustomer.id}/ledger`))
            .balance,
          100,
        );
        return "5 charges, 7 credit-limit conflicts, balance 100";
      },
    );
    await scenario(
      "A09",
      "Concurrent partial repayment and duplicate repayment",
      "Eight same-key repayments of 15 produce one payment; concurrent 80 repayments accept once; balance 5",
      async () => {
        const url = `/api/customers/${limitCustomer.id}/repayments`,
          body = { requestId: randomUUID(), amount: 15 };
        const repeats = await Promise.all(
          Array.from({ length: 8 }, () => cashier1.post(url, body)),
        );
        assert.equal(new Set(repeats.map((r) => r.id)).size, 1);
        const race = await Promise.all([
          cashier1.raw("POST", url, { requestId: randomUUID(), amount: 80 }),
          cashier2.raw("POST", url, { requestId: randomUUID(), amount: 80 }),
        ]);
        assert.deepEqual(race.map((r) => r.status()).sort(), [200, 400]);
        assert.equal(
          (await owner.get(`/api/customers/${limitCustomer.id}/ledger`))
            .balance,
          5,
        );
        return "One 15 repayment, one 80 repayment, overpayment rejected; balance 5";
      },
    );
    await scenario(
      "A10",
      "Concurrent repeated refunds",
      "Eight refunds return one reversal with stock restored exactly once",
      async () => {
        const before = await stock(151),
          sale = await cashier2.post("/api/sales", checkout([[151, 2]]));
        const results = await Promise.all(
          Array.from({ length: 8 }, () => refund(sale)),
        );
        assert(
          results.every(
            (r) => r.status === "Refunded" && r.refundCash === sale.total,
          ),
        );
        assert.equal(await stock(151), before);
        return "Eight refund responses; one stock/cash reversal (database ledger independently checked)";
      },
    );
    await scenario(
      "A11",
      "Near-expiry FEFO picking and expired receiving guard",
      "Receive 3 near-expiry + 20 later; sale 4 consumes 3 early + 1 later; expired receive rejected",
      async () => {
        assert.equal(await stock(100), 0);
        const date = (days) =>
          new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
        const early = await owner.post("/api/inventory/receive", {
          productId: p(100).Id,
          quantity: 3,
          unitCost: 3,
          expiresOn: date(2),
          reference: "FICTIONAL NEAR EXPIRY",
        });
        const late = await owner.post("/api/inventory/receive", {
          productId: p(100).Id,
          quantity: 20,
          unitCost: 7,
          expiresOn: date(90),
          reference: "FICTIONAL LATER EXPIRY",
        });
        assert(
          (await owner.get("/api/reports/dashboard")).nearExpiry.some(
            (b) => b.id === early.id,
          ),
        );
        await cashier1.post("/api/sales", checkout([[100, 4]]));
        const batches = await owner.get(
          `/api/inventory/batches?productId=${p(100).Id}`,
        );
        assert.equal(batches.find((b) => b.id === early.id).quantity, 0);
        assert.equal(batches.find((b) => b.id === late.id).quantity, 19);
        await owner.call(
          "POST",
          "/api/inventory/receive",
          {
            productId: p(100).Id,
            quantity: 1,
            unitCost: 1,
            expiresOn: date(-2),
            reference: "FICTIONAL EXPIRED",
          },
          400,
        );
        return "FEFO 3+1, early batch empty, later batch 19, expired receiving blocked";
      },
    );
    await scenario(
      "A12",
      "Owner-only route permission matrix",
      "Both cashiers receive 403 on all 22 owner-only API operations; no cost-price disclosure",
      async () => {
        const endpoints = [
          ["GET", "/api/employees"],
          ["POST", "/api/employees"],
          ["PUT", "/api/employees/fictional/status"],
          ["PUT", "/api/employees/fictional/password"],
          ["POST", "/api/products"],
          ["PUT", `/api/products/${p(1).Id}`],
          ["DELETE", `/api/products/${p(1).Id}`],
          ["POST", "/api/categories"],
          ["GET", "/api/inventory/batches"],
          ["GET", "/api/inventory/movements"],
          ["POST", "/api/inventory/receive"],
          ["POST", "/api/inventory/adjust"],
          ["PUT", "/api/settings"],
          ["GET", "/api/settings/audit"],
          ["GET", "/api/reports/dashboard"],
          ["GET", "/api/reports/sales"],
          ["GET", "/api/reports/inventory"],
          ["GET", "/api/reports/export/sales"],
          ["GET", "/api/reports/export/credit"],
          ["GET", "/api/reports/export/inventory"],
          ["POST", "/api/sales/1/refund"],
          ["PUT", "/api/customers/1"],
        ];
        for (const cashier of [cashier1, cashier2]) {
          for (const [method, url] of endpoints)
            assert.equal(
              (
                await cashier.raw(
                  method,
                  url,
                  method === "GET" ? undefined : {},
                )
              ).status(),
              403,
              `${method} ${url}`,
            );
          assert.equal(
            (await cashier.get(`/api/products/scan?code=${p(1).Sku}`))
              .costPrice,
            null,
          );
          await cashier.call(
            "POST",
            "/api/sales",
            checkout([[1, 1]], { discount: 1 }),
            403,
          );
          await cashier.call(
            "POST",
            "/api/customers",
            { name: "Fictional forbidden limit", creditLimit: 500 },
            403,
          );
        }
        return "44 owner-route denials, 4 business-rule denials, 2 cost-price redactions verified";
      },
    );
    await scenario(
      "A13",
      "Cashiers cannot access each other's sale or PDF",
      "Own sale/PDF available; other cashier receives 403; sale list contains only own actor",
      async () => {
        const sale = await cashier1.post("/api/sales", checkout([[151, 1]]));
        await cashier1.get(`/api/sales/${sale.id}`);
        assert.equal(
          (await cashier1.context.get(`/api/sales/${sale.id}/pdf`)).status(),
          200,
        );
        await cashier2.call("GET", `/api/sales/${sale.id}`, undefined, 403);
        assert.equal(
          (await cashier2.context.get(`/api/sales/${sale.id}/pdf`)).status(),
          403,
        );
        assert(
          (await cashier1.get("/api/sales")).items.every(
            (s) => s.cashierId === sale.cashierId,
          ),
        );
        return "Own and cross-cashier sale/PDF access and list filtering passed";
      },
    );
    await scenario(
      "A14",
      "120 realistic baskets across two concurrent cashiers",
      "120 three-item cash baskets, concurrency 8; exact catalog-derived total and stock deltas",
      async () => {
        const quantities = new Map(),
          bodies = [];
        for (let i = 0; i < 120; i++) {
          const lines = [
            [2 + (i % 30), 1],
            [52 + (i % 30), 2],
            [102 + (i % 30), 1],
          ];
          for (const [n, qty] of lines)
            quantities.set(n, (quantities.get(n) ?? 0) + qty);
          bodies.push(checkout(lines, { cashReceived: 200 }));
        }
        const before = new Map(
          await Promise.all(
            [...quantities.keys()].map(async (n) => [n, await stock(n)]),
          ),
        );
        const expected = sum(
          bodies.map((body) =>
            sum(
              body.items.map((line) =>
                money(
                  dataset.products.find((item) => item.Id === line.productId)
                    .SellingPrice * line.quantity,
                ),
              ),
            ),
          ),
        );
        const completed = [];
        for (let offset = 0; offset < bodies.length; offset += 8)
          completed.push(
            ...(await Promise.all(
              bodies
                .slice(offset, offset + 8)
                .map((body, i) =>
                  (i % 2 ? cashier1 : cashier2).post("/api/sales", body),
                ),
            )),
          );
        assert.equal(new Set(completed.map((s) => s.id)).size, 120);
        assert.equal(sum(completed.map((s) => s.total)), expected);
        for (const [n, quantity] of quantities)
          assert.equal(await stock(n), before.get(n) - quantity);
        return `120 committed baskets / 360 item lines; exact revenue ${expected.toFixed(2)}; all 90 affected product quantities reconciled`;
      },
    );
  } else {
    const db = await read("reconciliation.json");
    await scenario(
      "A15",
      "Reports reconcile against independent database records",
      "Revenue, COGS, cash, outstanding, product allocations, daily totals and inventory match raw records",
      async () => {
        const report = await owner.get("/api/reports/sales"),
          dashboard = await owner.get("/api/reports/dashboard"),
          inventory = await owner.get("/api/reports/inventory");
        assert.equal(report.revenue, db.revenue);
        assert.equal(report.costOfGoods, db.costOfGoods);
        assert.equal(report.grossProfit, money(db.revenue - db.costOfGoods));
        assert.equal(
          sum(report.products.map((item) => item.revenue)),
          db.revenue,
        );
        assert.equal(
          sum(report.products.map((item) => item.grossProfit)),
          report.grossProfit,
        );
        assert.equal(sum(report.daily.map((item) => item.sales)), db.revenue);
        assert.equal(
          money(report.cashSales + report.repayments - report.refundCash),
          db.cash,
        );
        assert.equal(dashboard.outstandingCredit, db.outstanding);
        assert.equal(inventory.valuation, db.valuation);
        for (const item of inventory.products) {
          const record = db.products.find((p) => p.Id === item.id);
          assert.equal(item.stock, record.stock);
          assert.equal(item.value, record.value);
        }
        return `Revenue ${db.revenue}; cash ${db.cash}; utang ${db.outstanding}; COGS ${db.costOfGoods}; valuation ${db.valuation}; zero discrepancies`;
      },
    );
    // RFC4180 subset with quoted commas/quotes/newlines, rather than splitting CSV naively.
    function csv(text) {
      const rows = [];
      let row = [],
        cell = "",
        quoted = false;
      for (let i = 0; i < text.replace(/^\uFEFF/, "").length; i++) {
        const source = text.replace(/^\uFEFF/, ""),
          c = source[i];
        if (c === '"') {
          if (quoted && source[i + 1] === '"') {
            cell += '"';
            i++;
          } else quoted = !quoted;
        } else if (!quoted && (c === "," || c === "\n")) {
          row.push(cell.replace(/\r$/, ""));
          cell = "";
          if (c === "\n") {
            rows.push(row);
            row = [];
          }
        } else cell += c;
      }
      if (cell || row.length) rows.push([...row, cell]);
      return rows.slice(1);
    }
    await scenario(
      "A16",
      "Sales, credit and inventory CSV reconciliation",
      "Every CSV row and financial/inventory amount matches independent database records",
      async () => {
        const exports = {};
        for (const kind of ["sales", "credit", "inventory"]) {
          const response = await owner.context.get(
            `/api/reports/export/${kind}`,
          );
          assert.equal(response.status(), 200);
          const text = await response.text();
          await writeFile(new URL(`${kind}.csv`, root), text);
          exports[kind] = csv(text);
        }
        assert.equal(exports.sales.length, db.sales.length);
        for (const row of exports.sales) {
          const sale = db.sales.find((s) => s.Reference === row[0]);
          assert(sale);
          assert.equal(row[2], sale.Status);
          assert.deepEqual(row.slice(3, 7).map(Number), [
            sale.Total,
            sale.Discount,
            sale.CashApplied,
            sale.Credit,
          ]);
          assert.equal(Number(row[8]), sale.RefundCash);
        }
        assert.equal(exports.credit.length, db.customers.length);
        for (const row of exports.credit)
          assert.equal(
            Number(row[2]),
            db.customers.find((c) => c.Name === row[0]).balance,
          );
        assert.equal(exports.inventory.length, db.products.length);
        for (const row of exports.inventory) {
          const product = db.products.find((p) => p.Sku === row[0]);
          assert(product);
          assert.deepEqual(row.slice(3).map(Number), [
            product.stock,
            product.value,
          ]);
        }
        return `${exports.sales.length} sales, ${exports.credit.length} customer balances, ${exports.inventory.length} inventory rows matched`;
      },
    );
    await scenario(
      "A17",
      "Private progress API denies both cashiers",
      "Both fictional cashiers receive 403 on the owner-only progress snapshot",
      async () => {
        for (const name of ["Cashier1", "Cashier2"]) {
          const cashier = await session(name);
          assert.equal(
            (
              await cashier.raw("GET", "/api/admin/development-progress")
            ).status(),
            403,
          );
        }
        return "Both cashier identities denied; browser direct-route denial also verified";
      },
    );
  }
} finally {
  await Promise.all(contexts.map((context) => context.dispose()));
}
const failed = scenarios.filter((s) => s.status === "failed");
console.log(
  `${scenarios.length - failed.length} acceptance scenarios passed; ${failed.length} failed`,
);
if (failed.length) process.exitCode = 1;
