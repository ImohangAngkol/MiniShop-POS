import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request } from "@playwright/test";
import { fileURLToPath } from "node:url";

const root = new URL("../../../.runtime/acceptance/", import.meta.url);
const path = fileURLToPath(new URL("restart-session.json", root));
const baseURL = "https://127.0.0.1:5843";
const resume = process.argv.includes("--resume");
const context = await request.newContext({
  baseURL,
  ...(resume ? { storageState: path } : {}),
});
try {
  if (!resume) {
    const account = JSON.parse(
      await readFile(new URL("credentials.json", root), "utf8"),
    );
    const token = (await (await context.get("/api/auth/csrf")).json()).token;
    const response = await context.post("/api/auth/login", {
      data: { email: account.OwnerEmail, password: account.OwnerPassword },
      headers: { "X-CSRF-TOKEN": token },
    });
    assert.equal(response.status(), 200);
    await context.storageState({ path });
  }
  const me = await context.get("/api/auth/me");
  assert.equal(me.status(), 200);
  assert((await me.json()).roles.includes("Owner"));
  console.log(
    resume
      ? "Existing secure session survived the controlled acceptance restart; no fresh login required."
      : "Private session baseline captured for the controlled acceptance restart.",
  );
} finally {
  await context.dispose();
}
