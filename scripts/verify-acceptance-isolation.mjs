import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";

const root = new URL("../.runtime/", import.meta.url);
const profiles = [
  ["development", "http://localhost:5080", null],
  ["staging", "https://localhost:5443", "staging/localhost.crt"],
  ["LAN rehearsal", "https://127.0.0.1:5643", "lan/ca.crt"],
  ["software acceptance", "https://127.0.0.1:5843", "acceptance/ca.crt"],
];
for (const [name, origin, certificate] of profiles) {
  await new Promise((resolve, reject) => {
    const transport = certificate ? https : http;
    const options = certificate
      ? {
          ca: fs.readFileSync(new URL(certificate, root)),
          rejectUnauthorized: true,
        }
      : {};
    const request = transport.get(
      origin + "/api/health",
      options,
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          try {
            assert.equal(response.statusCode, 200);
            assert.equal(JSON.parse(body).status, "healthy");
            console.log(
              `${name}: healthy (${origin}); TLS verification enabled for HTTPS`,
            );
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.setTimeout(5000, () =>
      request.destroy(new Error("Health timeout")),
    );
  });
}
const configurations = ["staging", "lan", "acceptance"].map((name) =>
  JSON.parse(
    fs
      .readFileSync(new URL(name + "/runtime.json", root), "utf8")
      .replace(/^\uFEFF/, ""),
  ),
);
for (const key of [
  "ConnectionStrings__Shop",
  "ASPNETCORE_URLS",
  "DataProtection__Directory",
  "DataProtection__ApplicationName",
])
  assert.equal(
    new Set(configurations.map((config) => config[key])).size,
    configurations.length,
    `Profiles must not share ${key}`,
  );
console.log(
  "All isolated profile connections/origins/session-key directories/application identities remain distinct.",
);
for (const field of ["Database", "Username"]) {
  const values = configurations.map((config) => {
    const match = new RegExp(`(?:^|;)\\s*${field}\\s*=\\s*([^;]+)`, "i").exec(
      config.ConnectionStrings__Shop,
    );
    assert(match, `Missing ${field}`);
    return match[1].toLowerCase();
  });
  assert.equal(
    new Set(values).size,
    configurations.length,
    `Profiles must have separate ${field} identities`,
  );
}
