import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

test.beforeEach(() =>
  test.skip(
    !process.env.E2E_ACCEPTANCE,
    "Requires the separate 300-product fictional acceptance profile.",
  ),
);

async function login(
  page: Page,
  email = process.env.E2E_EMAIL!,
  password = process.env.E2E_PASSWORD!,
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}

test("full catalog weighted checkout finds products beyond the first page", async ({
  page,
}) => {
  const dataset = JSON.parse(
    await readFile("../../.runtime/acceptance/dataset.json", "utf8"),
  );
  await login(page);
  await page.goto("/pos");
  const scan = page.getByLabel("Scan barcode or search products");
  for (const sku of [
    "ACCEPT-001",
    "ACCEPT-001",
    "ACCEPT-051",
    "ACCEPT-251",
    "ACCEPT-252",
  ]) {
    const product = dataset.products.find(
      (p: { Sku: string }) => p.Sku === sku,
    );
    await scan.fill(product.Barcode);
    await scan.press("Enter");
    await expect(page.getByLabel(`Quantity for ${product.Name}`)).toBeVisible();
  }
  const product = (sku: string) =>
    dataset.products.find((p: { Sku: string }) => p.Sku === sku);
  await expect(
    page.getByLabel(`Quantity for ${product("ACCEPT-001").Name}`),
  ).toHaveValue("2");
  await page.getByLabel(`Quantity for ${product("ACCEPT-051").Name}`).fill("3");
  await page
    .getByLabel(`Quantity for ${product("ACCEPT-251").Name}`)
    .fill("1.125");
  await page
    .getByLabel(`Quantity for ${product("ACCEPT-252").Name}`)
    .fill("250");
  await page.getByLabel("Discount", { exact: true }).fill("3.46");
  await page.getByLabel("Cash received", { exact: true }).fill("200");
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your receipt is ready" }),
  ).toBeVisible();
  const receipt = page.getByRole("article", { name: "Sales receipt" });
  await expect(receipt).toContainText("173.46");
  await expect(receipt).toContainText("170.00");
  await expect(receipt).toContainText("30.00");
  await page.screenshot({
    path: "../../.runtime/acceptance/full-catalog-receipt.png",
    fullPage: true,
  });
});

test("cashier browser completes a sale while every owner workspace stays restricted", async ({
  page,
}) => {
  await login(
    page,
    process.env.E2E_CASHIER_EMAIL!,
    process.env.E2E_CASHIER_PASSWORD!,
  );
  for (const label of [
    "Products",
    "Inventory",
    "Stock receiving",
    "Reports",
    "Employees",
    "Settings",
    "Development progress",
  ])
    await expect(
      page.getByRole("link", { name: label, exact: true }),
    ).toHaveCount(0);
  for (const path of [
    "/products",
    "/inventory",
    "/receiving",
    "/reports",
    "/employees",
    "/settings",
    "/admin/development-progress",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/pos$/);
  }
  const scan = page.getByLabel("Scan barcode or search products");
  await scan.fill("ACCEPT-151");
  await scan.press("Enter");
  await expect(
    page.getByLabel("Quantity for Fictional Laundry soap bar - V01"),
  ).toBeVisible();
  await expect(page.getByLabel("Discount", { exact: true })).toHaveCount(0);
  await page.getByLabel("Cash received", { exact: true }).fill("50");
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(
    page.getByRole("article", { name: "Sales receipt" }),
  ).toContainText("24.00");
  await expect(
    page.getByRole("article", { name: "Sales receipt" }),
  ).toContainText("26.00");
  await page.screenshot({
    path: "../../.runtime/acceptance/cashier-receipt.png",
    fullPage: true,
  });
});

test("employee password reset and deactivation revoke an existing browser session", async ({
  page,
  browser,
  baseURL,
}) => {
  await login(page);
  await page.goto("/employees");
  const tag = randomUUID().slice(0, 8),
    email = `acceptance-${tag}@example.test`,
    password = `Fictional!9a${randomUUID()}`;
  await page.getByRole("button", { name: "Add employee", exact: true }).click();
  await page.getByLabel("Display name").fill(`Fictional lifecycle ${tag}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Initial password").fill(password);
  await page.getByLabel("Role", { exact: true }).selectOption("Cashier");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const other = await browser.newContext({ baseURL });
  // Same strict Node CA validation as the shared HTTPS fixture; no ignored TLS errors.
  await other.route(`${new URL(baseURL!).origin}/**`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  const cashier = await other.newPage();
  try {
    await login(cashier, email, password);
    const row = page.getByRole("row").filter({ hasText: email });
    await row.getByRole("button", { name: "Password", exact: true }).click();
    const replacement = `Replacement!8b${randomUUID()}`;
    await page.getByLabel("New password", { exact: true }).fill(replacement);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await cashier.request.get("/api/auth/me")).status()).toBe(401);
    await cashier.reload();
    await expect(cashier).toHaveURL(/\/login$/);
    await login(cashier, email, replacement);
    await row.getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect(row).toContainText("Inactive");
    expect((await cashier.request.get("/api/auth/me")).status()).toBe(401);
    await cashier.reload();
    await expect(cashier).toHaveURL(/\/login$/);
    await row.getByRole("button", { name: "Activate", exact: true }).click();
    await expect(
      row.getByRole("button", { name: "Deactivate", exact: true }),
    ).toBeVisible();
    await login(cashier, email, replacement);
    await expect(cashier).toHaveURL(/\/pos$/);
  } finally {
    await other.close();
  }
});
