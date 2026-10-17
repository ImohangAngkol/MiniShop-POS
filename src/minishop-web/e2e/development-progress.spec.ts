import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const email = process.env.E2E_EMAIL,
    password = process.env.E2E_PASSWORD;
  test.skip(
    !email || !password,
    "Select a development instance using E2E_EMAIL and E2E_PASSWORD.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
});

test("owner can inspect reviewed progress, evidence and a responsive mobile dashboard", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("link", { name: "Development progress", exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/development-progress$/);
  await expect(
    page.getByRole("heading", { name: "Development progress", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("overall-progress")).toHaveText("81.5%");
  await expect(page.getByTestId("functional-progress")).toHaveText("93.1%");
  await expect(
    page.getByRole("progressbar", {
      name: "Overall project completion",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "81.5");
  await expect(page.getByText("6 release gates still open")).toBeVisible();
  const response = await page.request.get("/api/admin/development-progress");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  // Inspect the final animation frame rather than capturing a partially filled bar.
  await page.evaluate(() =>
    Promise.all(
      document.getAnimations().map((animation) => animation.finished),
    ),
  );
  const renderedRatio = await page
    .getByRole("progressbar", {
      name: "Overall project completion",
      exact: true,
    })
    .evaluate(
      (bar) =>
        (bar.firstElementChild!.getBoundingClientRect().width /
          bar.getBoundingClientRect().width) *
        100,
    );
  expect(renderedRatio).toBeCloseTo(81.5, 0);
  await page.screenshot({
    path: "../../.runtime/development-progress-desktop.png",
    fullPage: true,
  });
  const inventory = page.locator("#inventory-pos");
  await inventory.locator(":scope > summary").click();
  await expect(
    inventory.getByText("Atomic and idempotent checkout", { exact: true }),
  ).toBeVisible();
  const atomic = page.locator("#atomic-checkout");
  await atomic.locator("summary").click();
  await expect(
    atomic.getByText("PostgreSQL and authenticated API tests", { exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/development-progress");
  await expect(page.getByTestId("overall-progress")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../.runtime/development-progress-mobile.png",
    fullPage: true,
  });
  await page.screenshot({
    path: "../../.runtime/development-progress-mobile-viewport.png",
  });
  expect(errors).toEqual([]);
});

test("an unavailable progress snapshot renders an honest recoverable state", async ({
  page,
}) => {
  await page.route("**/api/admin/development-progress", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Progress unavailable" }),
    }),
  );
  await page.goto("/admin/development-progress");
  await expect(page.getByRole("alert")).toContainText(
    "Progress data is unavailable",
  );
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.unroute("**/api/admin/development-progress");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("overall-progress")).toHaveText("81.5%");
});

test("cashiers cannot navigate to progress or retrieve its private API data", async ({
  page,
}) => {
  const tag = randomUUID(),
    email = `progress-cashier-${tag}@example.test`,
    password = `Test!9a${randomUUID()}`;
  const token = (await (await page.request.get("/api/auth/csrf")).json()).token;
  const create = await page.request.post("/api/employees", {
    headers: { "X-CSRF-TOKEN": token },
    data: {
      email,
      password,
      displayName: "E2E Progress Cashier",
      role: "Cashier",
    },
  });
  expect(create.status()).toBe(200);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to MiniShop" }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await expect(
    page.getByRole("link", { name: "Development progress", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/development-progress");
  await expect(page).toHaveURL(/\/pos$/);
  const forbidden = await page.request.get("/api/admin/development-progress");
  expect(forbidden.status()).toBe(403);
  expect(await forbidden.text()).not.toContain("milestones");
  const staticAttempt = await page.request.get(
    "/Progress/development-progress.json",
  );
  expect(await staticAttempt.text()).not.toContain('"baselineRevision"');
});
