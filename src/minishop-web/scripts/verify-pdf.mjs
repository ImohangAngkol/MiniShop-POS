import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const file = path.resolve(
  process.argv[2] ?? "../../.runtime/verified-sales-slip.pdf",
);
const output = path.resolve(
  process.argv[3] ?? "../../.runtime/generated-pdf-render.png",
);
const task = getDocument({
  data: new Uint8Array(await fs.readFile(file)),
  useSystemFonts: false,
  disableFontFace: true,
  standardFontDataUrl:
    path
      .resolve("node_modules/pdfjs-dist/standard_fonts")
      .replaceAll("\\", "/") + "/",
});
const pdf = await task.promise;
const page = await pdf.getPage(1);
const content = await page.getTextContent();
const text = content.items
  .filter((x) => "str" in x)
  .map((x) => x.str)
  .join(" ");
for (const expected of ["SALES SLIP", "65.96", "45.96", "Cashier"])
  if (!text.includes(expected))
    throw new Error(`Missing PDF content: ${expected}`);
const viewport = page.getViewport({ scale: 3 });
const canvas = createCanvas(
  Math.ceil(viewport.width),
  Math.ceil(viewport.height),
);
await page.render({ canvasContext: canvas.getContext("2d"), viewport, canvas })
  .promise;
await fs.writeFile(output, canvas.toBuffer("image/png"));
console.log(
  JSON.stringify({
    pages: pdf.numPages,
    widthPoints: page.view[2],
    heightPoints: page.view[3],
    verifiedText: true,
    rendered: output,
  }),
);
await task.destroy();
