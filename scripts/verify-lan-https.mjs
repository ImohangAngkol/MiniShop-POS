import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function verify() {
  const config = JSON.parse(
    fs
      .readFileSync(path.join(root, ".runtime/lan/runtime.json"), "utf8")
      .replace(/^\uFEFF/, ""),
  );
  const target = new URL(process.argv[2] ?? "https://127.0.0.1:5643");
  if (
    target.protocol !== "https:" ||
    target.port !== "5643" ||
    ![
      "127.0.0.1",
      "localhost",
      config.Lan__ServerAddress,
      config.Lan__HostName,
    ].includes(target.hostname) ||
    target.username ||
    target.password ||
    target.pathname !== "/"
  )
    throw new Error("Only the configured LAN/rehearsal origin is allowed.");
  const ca = fs.readFileSync(config.Lan__CaPath);
  async function get(route, headers = {}, servername) {
    return new Promise((resolve, reject) => {
      const request = https.get(
        new URL(route, target),
        {
          ca,
          rejectUnauthorized: true,
          headers,
          ...(servername ? { servername } : {}),
        },
        (response) => {
          let body = "";
          response.on("data", (chunk) => (body += chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              body,
              headers: response.headers,
            }),
          );
        },
      );
      request.setTimeout(5000, () =>
        request.destroy(new Error("HTTPS timeout")),
      );
      request.on("error", reject);
    });
  }
  const health = await get("/api/health");
  if (health.status !== 200 || JSON.parse(health.body).status !== "healthy")
    throw new Error("LAN health failed");
  let mismatchRejected = false;
  try {
    await get("/api/health", {}, "wrong-host.example.test");
  } catch (error) {
    mismatchRejected = error.code === "ERR_TLS_CERT_ALTNAME_INVALID";
  }
  if (!mismatchRejected)
    throw new Error("TLS did not reject a mismatched server identity");
  // Rehearsal verifies the proposed DNS SAN over the loopback connection, without changing DNS.
  if (
    (
      await get(
        "/api/health",
        { Host: config.Lan__HostName },
        config.Lan__HostName,
      )
    ).status !== 200
  )
    throw new Error("Proposed hostname failed");
  if ((await get("/api/products")).status !== 401)
    throw new Error("Anonymous access accepted");
  const csrf = await get("/api/auth/csrf");
  const cookie = csrf.headers["set-cookie"]?.find((c) =>
    c.startsWith("__Host-MiniShop.Lan.Csrf="),
  );
  if (
    !cookie ||
    !/; secure/i.test(cookie) ||
    !/; httponly/i.test(cookie) ||
    !/samesite=strict/i.test(cookie)
  )
    throw new Error("LAN CSRF cookie is not secure");
  if (
    (
      await get(
        "/api/health",
        { Host: "untrusted.example.test" },
        config.Lan__HostName,
      )
    ).status !== 400
  )
    throw new Error("Unexpected Host accepted");
  console.log(
    "LAN rehearsal HTTPS chain/expiry/IP/hostname, health, secure CSRF and Host/anonymous authorization checks passed. OS trust and LAN device acceptance unchanged.",
  );
}
verify().catch((error) => {
  console.log(`LAN verification failed: ${error.code ?? error.message}`);
  process.exitCode = 1;
});
