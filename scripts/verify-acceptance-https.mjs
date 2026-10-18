import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function verify() {
  const ca = fs.readFileSync(path.join(root, ".runtime/acceptance/ca.crt"));
  const result = await new Promise((resolve, reject) => {
    const request = https.get(
      "https://127.0.0.1:5843/api/health",
      { ca, rejectUnauthorized: true },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, body }),
        );
      },
    );
    request.on("error", reject);
    request.setTimeout(5000, () => request.destroy(new Error("TLS timeout")));
  });
  if (result.status !== 200 || JSON.parse(result.body).status !== "healthy")
    throw new Error("Acceptance health failed");
  console.log(
    "Acceptance HTTPS certificate/hostname validation and database health passed.",
  );
}
verify().catch((error) => {
  console.log(`Acceptance verification failed: ${error.code ?? error.message}`);
  process.exitCode = 1;
});
