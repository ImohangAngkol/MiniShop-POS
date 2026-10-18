import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function login(page: Page) {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Select a fictional test environment.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
}
async function setup(page: Page, name = "Fictional hardware test item") {
  const token = (await (await page.request.get("/api/auth/csrf")).json()).token;
  const headers = { "X-CSRF-TOKEN": token },
    tag = randomUUID().replaceAll("-", "").slice(0, 16),
    barcode = "000" + tag;
  async function post(url: string, data: unknown) {
    const response = await page.request.post(url, { headers, data });
    expect(response.ok(), `${url} returned ${response.status()}`).toBe(true);
    return response.status() === 204 ? null : response.json();
  }
  const category = await post("/api/categories", { name: "Devices " + tag });
  const product = await post("/api/products", {
    name,
    sku: "DEVICE-" + tag,
    barcode,
    categoryId: category.id,
    unit: "piece",
    costPrice: 4,
    sellingPrice: 10,
    lowStockThreshold: 1,
  });
  await post("/api/inventory/receive", {
    productId: product.id,
    quantity: 10,
    unitCost: 4,
    reference: "FICTIONAL DEVICE REHEARSAL",
  });
  return { product, barcode, tag, headers, post };
}

test("keyboard scanner bursts use fresh exact lookups, retain duplicates and recover focus", async ({
  page,
}) => {
  await login(page);
  const { barcode } = await setup(page);
  await page.goto("/pos");
  await page.route("**/api/products/scan?code=*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fallback();
  });
  const scan = page.getByLabel("Scan barcode or search products");
  for (let count = 0; count < 3; count++) {
    await scan.pressSequentially(barcode);
    await scan.press("Enter");
  }
  await expect(
    page.getByLabel("Quantity for Fictional hardware test item"),
  ).toHaveValue("3");
  await scan.fill(barcode.slice(0, -1));
  await scan.press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    "Barcode or SKU not found",
  );
  await expect(
    page.getByLabel("Quantity for Fictional hardware test item"),
  ).toHaveValue("3");
  await page.getByLabel("Cash received", { exact: true }).focus();
  await page.getByRole("button", { name: "Focus barcode scanner" }).click();
  await expect(scan).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../.runtime/scanner-mobile.png",
    fullPage: true,
  });
});

test("58 and 80 mm previews align, print without app chrome and provide width-matched PDFs", async ({
  page,
}) => {
  await login(page);
  const { product, post } = await setup(
    page,
    "Long receipt product " + "W".repeat(100),
  );
  const sale = await post("/api/sales", {
    requestId: randomUUID(),
    items: [{ productId: product.id, quantity: 2 }],
    discount: 0,
    cashReceived: 50,
    customerId: null,
    onCredit: false,
  });
  await page.goto(`/sales/${sale.id}/receipt`);
  const receipt = page.getByRole("article", { name: "Sales receipt" });
  await expect(receipt).toContainText("SALES SLIP");
  for (const width of [58, 80]) {
    await page.getByLabel("Receipt preview width").selectOption(String(width));
    await expect(receipt).toHaveClass(new RegExp(`width-${width}`));
    const layout = await receipt.evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      fits: el.scrollWidth <= el.clientWidth + 1,
      edges: [...el.querySelectorAll(".receipt-totals p > :last-child")].map(
        (item) => item.getBoundingClientRect().right,
      ),
    }));
    expect(layout.width).toBeCloseTo((width * 96) / 25.4, 0);
    expect(layout.fits).toBe(true);
    expect(Math.max(...layout.edges) - Math.min(...layout.edges)).toBeLessThan(
      1,
    );
    await receipt.screenshot({
      path: `../../.runtime/receipt-preview-${width}.png`,
    });
    const pdf = await page.request.get(
      `/api/sales/${sale.id}/pdf?paperWidth=${width}`,
    );
    expect(pdf.ok()).toBe(true);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    await writeFile(
      `../../.runtime/device-receipt-${width}.pdf`,
      await pdf.body(),
    );
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".sidebar")).toBeHidden();
    expect((await receipt.boundingBox())!.x).toBeLessThan(1);
    await page.pdf({
      path: `../../.runtime/browser-receipt-${width}.pdf`,
      width: `${width}mm`,
      height: "200mm",
      printBackground: true,
    });
    await page.emulateMedia({ media: "screen" });
  }
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printRequested = "yes";
    };
  });
  await page
    .getByRole("button", { name: "Print receipt", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-print-requested",
    "yes",
  );
});

test("fresh browser works with external origins blocked while the local server stays reachable", async ({
  page,
  context,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) {
      external.push(url.origin);
      await route.abort("internetdisconnected");
    } else await route.fallback();
  });
  await login(page);
  const { product, barcode, post, tag } = await setup(page);
  const customer = await post("/api/customers", {
    name: "Fictional WAN-loss " + tag,
    creditLimit: 500,
  });
  await page.goto("/pos");
  await page.getByLabel("Scan barcode or search products").fill(barcode);
  await page.getByLabel("Scan barcode or search products").press("Enter");
  await expect(
    page.getByLabel("Quantity for Fictional hardware test item"),
  ).toHaveValue("1");
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption(String(customer.id));
  await page.getByLabel("Cash received", { exact: true }).fill("2");
  await page.getByLabel("Record remaining amount as utang").check();
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your receipt is ready" }),
  ).toBeVisible();
  const id = Number(new URL(page.url()).pathname.split("/")[2]);
  await post(`/api/customers/${customer.id}/repayments`, {
    requestId: randomUUID(),
    amount: 3,
  });
  await post(`/api/sales/${id}/refund`, {
    reason: "Fictional WAN-blocked acceptance",
  });
  expect(
    (
      await (
        await page.request.get(`/api/customers/${customer.id}/ledger`)
      ).json()
    ).balance,
  ).toBe(0);
  expect(
    (
      await (
        await page.request.get(`/api/products?search=DEVICE-${tag}`)
      ).json()
    ).items[0].stock,
  ).toBe(10);
  expect(product.id).toBeGreaterThan(0);
  expect(external).toEqual([]);
});

test("local server interruption preserves a pending request for safe retry after reconnection", async ({
  page,
}) => {
  await login(page);
  const { barcode } = await setup(page);
  await page.goto("/pos");
  const scan = page.getByLabel("Scan barcode or search products");
  await scan.fill(barcode);
  await scan.press("Enter");
  await expect(
    page.getByLabel("Quantity for Fictional hardware test item"),
  ).toHaveValue("1");
  await page.getByLabel("Cash received", { exact: true }).fill("20");
  await page.route("**/api/sales", (route) =>
    route.abort("internetdisconnected"),
  );
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Could not reach the shop server" }),
  ).toContainText("same saved request");
  await expect(
    page.getByRole("button", { name: /Retry saved checkout/ }),
  ).toBeEnabled();
  const saved = await page.evaluate(
    () =>
      Object.entries(sessionStorage).find(([key]) =>
        key.startsWith("minishop-checkout-"),
      )?.[1],
  );
  expect(saved).toBeTruthy();
  await page.unroute("**/api/sales");
  await page.reload();
  await page.getByRole("button", { name: /Retry saved checkout/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your receipt is ready" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((key) =>
        key.startsWith("minishop-checkout-"),
      ),
    ),
  ).toBe(false);
});
