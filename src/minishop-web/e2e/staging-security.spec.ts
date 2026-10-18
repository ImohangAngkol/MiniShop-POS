import { test, expect } from "./fixtures";

test("HTTPS staging preserves secure sessions, refunds, stock and utang ledgers", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !baseURL?.startsWith("https://"),
    "Requires the isolated fictional HTTPS staging instance.",
  );
  const email = process.env.E2E_EMAIL!,
    password = process.env.E2E_PASSWORD!;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
  const cookie = (await page.context().cookies()).find(
    (c) =>
      c.name ===
      (baseURL?.includes(":5843")
        ? "__Host-MiniShop.Acceptance"
        : baseURL?.includes(":5643")
          ? "__Host-MiniShop.Lan"
          : "__Host-MiniShop.Staging"),
  );
  expect(cookie).toMatchObject({
    secure: true,
    httpOnly: true,
    sameSite: "Strict",
    path: "/",
    expires: -1,
  });
  const token = (await (await page.request.get("/api/auth/csrf")).json()).token;
  const headers = { "X-CSRF-TOKEN": token };
  const post = async (url: string, data: unknown) => {
    const response = await page.request.post(url, { headers, data });
    expect(response.ok(), `${url}: ${response.status()}`).toBe(true);
    return response.status() === 204 ? null : response.json();
  };
  const tag = Date.now().toString();
  const category = await post("/api/categories", {
    name: `Staging security ${tag}`,
  });
  const product = await post("/api/products", {
    name: `Fictional staging item ${tag}`,
    sku: `STAGE-${tag}`,
    categoryId: category.id,
    unit: "piece",
    costPrice: 4,
    sellingPrice: 100,
    lowStockThreshold: 1,
  });
  await post("/api/inventory/receive", {
    productId: product.id,
    quantity: 10,
    unitCost: 4,
    reference: "FICTIONAL STAGING",
  });
  const customer = await post("/api/customers", {
    name: `Fictional staging customer ${tag}`,
    creditLimit: 500,
  });
  const sale = await post("/api/sales", {
    requestId: crypto.randomUUID(),
    items: [{ productId: product.id, quantity: 1 }],
    discount: 0,
    cashReceived: 20,
    customerId: customer.id,
    onCredit: true,
  });
  expect(sale.total).toBe(100);
  expect(sale.credit).toBe(80);
  await post(`/api/customers/${customer.id}/repayments`, {
    requestId: crypto.randomUUID(),
    amount: 30,
  });
  await post(`/api/sales/${sale.id}/refund`, {
    reason: "Fictional staging refund verification",
  });
  const refunded = await (
    await page.request.get(`/api/sales/${sale.id}`)
  ).json();
  expect(refunded.status).toBe("Refunded");
  expect(refunded.refundCash).toBe(50);
  const products = await (
    await page.request.get(`/api/products?search=STAGE-${tag}`)
  ).json();
  expect(products.items[0].stock).toBe(10);
  const account = await (
    await page.request.get(`/api/customers/${customer.id}/ledger`)
  ).json();
  expect(account.balance).toBe(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/products")).status()).toBe(401);
});
