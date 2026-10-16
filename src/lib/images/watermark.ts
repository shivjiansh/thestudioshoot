import "server-only";
import sharp from "sharp";

export function watermarkSvg(width: number, height: number, label = "TheStudioShot  •  FREE PLAN") {
  const pad = Math.max(12, Math.round(Math.min(width, height) * 0.025));
  const fontSize = Math.max(16, Math.round(Math.min(width, height) * 0.028));
  const boxWidth = Math.min(width - pad * 2, Math.round(label.length * fontSize * 0.61 + pad * 2));
  const boxHeight = Math.round(fontSize * 1.75);
  const x = width - boxWidth - pad;
  const y = height - boxHeight - pad;
  const baseline = y + Math.round(boxHeight * 0.65);
  // `label` is a server-owned constant; do not pass user-provided SVG text here.
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${Math.round(pad * 0.45)}" fill="#15130f" fill-opacity="0.78"/><text x="${x + pad}" y="${baseline}" font-family="Arial, sans-serif" font-size="${Math.round(fontSize * 0.68)}" font-weight="600" fill="#fffaf2">${label}</text></svg>`);
}

export async function renderPng(bytes: Buffer, watermark: boolean, label: string, maxDimension?: number) {
  const metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format || !["png", "jpeg", "webp"].includes(metadata.format)) {
    throw new Error("The stored image format is unsupported.");
  }

  // Resize first, then read the actual output dimensions before composing a watermark.
  let resizePipeline = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 });
  if (maxDimension) {
    resizePipeline = resizePipeline.resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true });
  }
  const resized = await resizePipeline.png().toBuffer();
  let pipeline = sharp(resized, { failOn: "error", limitInputPixels: 40_000_000 });
  if (watermark) {
    const resizedMetadata = await pipeline.metadata();
    if (!resizedMetadata.width || !resizedMetadata.height) throw new Error("Unable to inspect the processed image dimensions.");
    pipeline = sharp(resized, { failOn: "error", limitInputPixels: 40_000_000 }).composite([
      { input: watermarkSvg(resizedMetadata.width, resizedMetadata.height, label), left: 0, top: 0 },
    ]);
  }
  return { output: await pipeline.png().toBuffer(), width: metadata.width, height: metadata.height };
}
