import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { X509Certificate } from "node:crypto";

async function verify() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const ca = fs.readFileSync(path.join(root, ".runtime/staging/localhost.crt"));
  const certificate = new X509Certificate(ca);
  function request(route, options = {}) {
    return new Promise((resolve, reject) => {
      const req = https.get(
        `https://localhost:5443${route}`,
        { ca, servername: "localhost", ...options },
        (response) => {
          let body = "";
          response.on("data", (chunk) => (body += chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body,
            }),
          );
        },
      );
      req.setTimeout(5000, () =>
        req.destroy(new Error("Staging HTTPS timeout")),
      );
      req.on("error", reject);
    });
  }
  const health = await request("/api/health");
  if (health.status !== 200 || JSON.parse(health.body).status !== "healthy")
    throw new Error("Staging health failed");
  if ((await request("/api/products")).status !== 401)
    throw new Error("Anonymous API authorization failed");
  const csrf = await request("/api/auth/csrf");
  const cookie = csrf.headers["set-cookie"]?.find((value) =>
    value.startsWith("__Host-MiniShop.Staging.Csrf="),
  );
  if (
    !cookie ||
    !/; secure/i.test(cookie) ||
    !/; httponly/i.test(cookie) ||
    !/samesite=strict/i.test(cookie)
  )
    throw new Error("Staging CSRF cookie is not secure");
  if (
    (
      await request("/api/health", {
        headers: { Host: "untrusted.example.test" },
      })
    ).status !== 400
  )
    throw new Error("Untrusted Host was accepted");
  const cors = await request("/api/products", {
    method: "OPTIONS",
    headers: {
      Origin: "https://untrusted.example.test",
      "Access-Control-Request-Method": "POST",
    },
  });
  if (cors.headers["access-control-allow-origin"])
    throw new Error("Untrusted CORS origin was accepted");
  if (process.platform === "win32") {
    const keys = path.join(root, ".runtime/staging/keys");
    const files = fs
      .readdirSync(keys)
      .filter((name) => /^key-.*\.xml$/.test(name));
    if (
      !files.length ||
      files.some(
        (name) =>
          !/encryptedSecret[\s\S]*DpapiXmlDecryptor/.test(
            fs.readFileSync(path.join(keys, name), "utf8"),
          ),
      )
    )
      throw new Error(
        "Staging session keys are missing or not DPAPI-encrypted",
      );
  }
  console.log(
    `Staging HTTPS verified with explicit certificate trust and hostname/chain checks; SHA256 ${certificate.fingerprint256}. Anonymous access, secure CSRF cookie, Host filtering and CORS checks passed. OS trust was not changed.`,
  );
}

verify().catch((error) => {
  // Concise stdout also lets Windows PowerShell poll readiness without treating
  // a normal connection-refused/startup race as a terminating stderr exception.
  console.log(
    `Staging HTTPS verification failed: ${error.code ?? error.message}`,
  );
  process.exitCode = 1;
});
