import { test, expect } from "./fixtures";
test("owner can receive stock, complete a weighted credit sale, repay it, and print a receipt", async ({
  page,
}) => {
  const email = process.env.E2E_EMAIL,
    password = process.env.E2E_PASSWORD;
  test.skip(
    !email || !password,
    "Set E2E_EMAIL and E2E_PASSWORD for the explicitly selected development database. This workflow writes fictional test records.",
  );
  const id = Date.now().toString(),
    product = `E2E Rice ${id}`,
    customer = `E2E Customer ${id}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../.runtime/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name").fill(`E2E category ${id}`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name").fill(product);
  await page.getByLabel("SKU", { exact: true }).fill(`E2E-${id}`);
  await page.getByLabel("Barcode", { exact: true }).fill(id);
  await page
    .getByLabel("Category", { exact: true })
    .selectOption({ label: `E2E category ${id}` });
  await page.getByLabel("Sold by").selectOption("kilogram");
  await page.getByLabel("Default cost (PHP)").fill("40");
  await page.getByLabel("Selling price per unit (PHP)").fill("58.63");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Stock receiving", exact: true })
    .click();
  await page
    .getByLabel("Product", { exact: true })
    .selectOption({ label: `${product} (per kilogram)` });
  await page
    .getByLabel("Delivery / supplier reference")
    .fill(`E2E delivery ${id}`);
  await page.getByLabel("Quantity received").fill("10");
  await page.getByLabel("Cost per product unit (PHP)").fill("40");
  await page.getByRole("button", { name: "Receive into inventory" }).click();
  await expect(page.getByRole("status")).toContainText("Delivery received");
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Customer name").fill(customer);
  await page.getByLabel("Credit limit (PHP)").fill("500");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Point of sale", exact: true }).click();
  await page.getByLabel("Scan barcode or search products").fill(id);
  await expect(
    page.getByRole("button", { name: new RegExp(product) }),
  ).toBeVisible();
  await page.getByLabel("Scan barcode or search products").press("Enter");
  await page.getByLabel(`Quantity for ${product}`).fill("1.125");
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: customer });
  await page.getByLabel("Cash received", { exact: true }).fill("20");
  await page.getByLabel("Record remaining amount as utang").check();
  await page.screenshot({
    path: "../../.runtime/pos-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your receipt is ready" }),
  ).toBeVisible();
  const receipt = page.getByRole("article", { name: "Sales receipt" });
  await expect(receipt).toContainText("₱65.96");
  await expect(receipt).toContainText("₱45.96");
  await expect(receipt).toContainText(product);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  await download.saveAs("../../.runtime/verified-sales-slip.pdf");
  await page.emulateMedia({ media: "print" });
  await page.screenshot({
    path: "../../.runtime/thermal-receipt.png",
    fullPage: true,
  });
  await page.pdf({
    path: "../../.runtime/thermal-browser-print.pdf",
    width: "80mm",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("link", { name: "Utang accounts", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: customer });
  await expect(row).toContainText("₱45.96");
  await row.getByRole("button", { name: "Repay", exact: true }).click();
  await page.getByLabel("Amount paid (PHP)").fill("15");
  await page
    .getByRole("button", { name: "Record repayment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toContainText("₱30.96");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../.runtime/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("a committed checkout with a lost response survives reload and retries without a second sale", async ({
  page,
}) => {
  const email = process.env.E2E_EMAIL,
    password = process.env.E2E_PASSWORD;
  test.skip(
    !email || !password,
    "Requires an explicitly selected development instance.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
  const token = (await (await page.request.get("/api/auth/csrf")).json()).token;
  const headers = { "X-CSRF-TOKEN": token };
  const tag = Date.now().toString();
  const category = await (
    await page.request.post("/api/categories", {
      headers,
      data: { name: "Recovery " + tag },
    })
  ).json();
  const product = await (
    await page.request.post("/api/products", {
      headers,
      data: {
        name: "Recovery test " + tag,
        sku: "REC-" + tag,
        barcode: "REC" + tag,
        categoryId: category.id,
        unit: "piece",
        costPrice: 4,
        sellingPrice: 10,
        lowStockThreshold: 1,
        active: true,
      },
    })
  ).json();
  expect(
    (
      await page.request.post("/api/inventory/receive", {
        headers,
        data: {
          productId: product.id,
          quantity: 5,
          unitCost: 4,
          expiresOn: null,
          reference: "RECOVERY TEST",
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/pos");
  await page.getByLabel("Scan barcode or search products").fill("REC" + tag);
  await expect(
    page.getByRole("button", { name: new RegExp("Recovery test " + tag) }),
  ).toBeVisible();
  await page.getByLabel("Scan barcode or search products").press("Enter");
  await page.getByLabel("Cash received", { exact: true }).fill("20");
  let committedId = 0;
  await page.route(
    "**/api/sales",
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      committedId = (await response.json()).id;
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(
    page.getByRole("button", { name: /Retry saved checkout/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Retry saved checkout/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Retry saved checkout/ }).click();
  await expect(page).toHaveURL(new RegExp(`/sales/${committedId}/receipt$`));
  const products = await (
    await page.request.get("/api/products?search=REC-" + tag)
  ).json();
  expect(products.items[0].stock).toBe(4);
  const sale = await (
    await page.request.get("/api/sales/" + committedId)
  ).json();
  expect(sale.total).toBe(10);
  expect(sale.change).toBe(10);
  const movements = await (
    await page.request.get("/api/inventory/movements?productId=" + product.id)
  ).json();
  expect(
    movements.filter((m: { kind: string }) => m.kind === "Sale"),
  ).toHaveLength(1);
});
test("owner reports, inventory, employees, settings and logout work in the built app", async ({
  page,
}) => {
  const email = process.env.E2E_EMAIL,
    password = process.env.E2E_PASSWORD;
  test.skip(
    !email || !password,
    "Requires an explicitly selected development instance.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
  for (const [url, heading] of [
    ["/inventory", "Inventory"],
    ["/reports", "Business reports"],
    ["/employees", "Employees"],
    ["/settings", "Store settings"],
    ["/sales", "Sales history"],
  ]) {
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/products")).status()).toBe(401);
});
