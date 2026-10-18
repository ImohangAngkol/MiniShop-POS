import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
for (const width of [58, 80]) {
  for (const kind of ["device", "browser"]) {
    const file = path.resolve(`../../.runtime/${kind}-receipt-${width}.pdf`);
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
    let allText = "";
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      if (Math.abs(page.view[2] - (width / 25.4) * 72) > 1)
        throw new Error(`${kind} ${width} mm PDF has the wrong paper width`);
      const content = await page.getTextContent();
      allText += content.items
        .filter((item) => "str" in item)
        .map((item) => item.str)
        .join(" ");
      if (index === 1) {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          canvas,
        }).promise;
        await fs.writeFile(
          path.resolve(`../../.runtime/${kind}-receipt-${width}-render.png`),
          canvas.toBuffer("image/png"),
        );
      }
    }
    // Browser letter spacing may be represented as separate PDF text items.
    for (const expected of ["SALES SLIP", "20.00", "30.00", "Cashier"])
      if (!allText.replace(/\s+/g, "").includes(expected.replace(/\s+/g, "")))
        throw new Error(`${kind} ${width} mm PDF is missing ${expected}`);
    console.log(
      `${kind} ${width} mm: ${pdf.numPages} page(s), width and sales/change/cashier content verified and rendered.`,
    );
    await task.destroy();
  }
}
