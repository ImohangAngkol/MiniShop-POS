import { test as base, expect } from "@playwright/test";

// HTTPS automation without OS trust installation or ignored certificate errors.
// Every origin request is fetched by Playwright's Node transport, which validates
// the certificate chain/hostname using NODE_EXTRA_CA_CERTS, then delivered to the
// browser. Native browser/device trust is a separate manual acceptance gate.
export const test = base.extend<{ verifiedHttps: void }>({
  verifiedHttps: [
    async ({ context, baseURL }, use) => {
      if (process.env.E2E_CA_CERT && baseURL?.startsWith("https://")) {
        const origin = new URL(baseURL).origin;
        await context.route(`${origin}/**`, async (route) => {
          const response = await route.fetch();
          await route.fulfill({ response });
        });
      }
      await use();
    },
    { auto: true },
  ],
});
export { expect };
