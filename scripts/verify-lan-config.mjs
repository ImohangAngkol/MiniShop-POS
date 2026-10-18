import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { X509Certificate } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, ".runtime/lan");
const config = JSON.parse(
  fs
    .readFileSync(path.join(directory, "runtime.json"), "utf8")
    .replace(/^\uFEFF/, ""),
);
const ca = new X509Certificate(fs.readFileSync(path.join(directory, "ca.crt")));
const leaf = new X509Certificate(
  fs.readFileSync(path.join(directory, "server.crt")),
);
const now = Date.now();
if (
  !ca.ca ||
  !leaf.checkIssued(ca) ||
  !leaf.verify(ca.publicKey) ||
  !leaf.checkHost(config.Lan__HostName) ||
  !leaf.checkIP(config.Lan__ServerAddress) ||
  !leaf.checkIP("127.0.0.1") ||
  now < Date.parse(leaf.validFrom) ||
  now >= Date.parse(leaf.validTo) ||
  now >= Date.parse(ca.validTo)
)
  throw new Error("LAN certificate identity/chain/validity failed");
if (
  config.ASPNETCORE_URLS !== "https://127.0.0.1:5643" ||
  config.Lan__ListenAddress !== "127.0.0.1" ||
  config.Bootstrap__Enabled !== "false" ||
  config.Database__AutoMigrate !== "false" ||
  Object.keys(config).some((k) =>
    /Bootstrap.*Password|Migrations|AdminConnection|CaPassword/i.test(k),
  )
)
  throw new Error(
    "Prepared profile must remain loopback-only and contain no provisioning secrets",
  );
if (
  !/Host=127\.0\.0\.1;.*Port=55433;.*Database=minishop_lan;.*Username=minishop_lan_app;/i.test(
    config.ConnectionStrings__Shop,
  )
)
  throw new Error("LAN runtime database is not isolated");
console.log(
  JSON.stringify({
    profile: "LAN acceptance (fictional)",
    preparedOrigin: config.ASPNETCORE_URLS,
    proposedHost: config.Lan__HostName,
    proposedPrivateIP: config.Lan__ServerAddress,
    leafExpiresUTC: leaf.validTo,
    caExpiresUTC: ca.validTo,
    caFingerprintSHA256: ca.fingerprint256,
    caThumbprintSHA1: ca.fingerprint,
    installsTrust: false,
  }),
);
