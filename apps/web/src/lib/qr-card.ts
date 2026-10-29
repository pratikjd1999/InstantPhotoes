"use client";

import QRCode from "qrcode";

// Printable QR card (EVT-3): studio name at the top, event name and QR in the middle, the credit line at the bottom.
// Drawn on a canvas so the PNG and the PDF are the same picture.

/** The credit line under the QR. One editable string (EVT-3), e.g. "Marketed by" / "Backed by". */
export const QR_CREDIT_LINE = "Powered by InstantPhotos";

export interface QrCardInput {
  studioName: string;
  eventName: string;
  url: string;
}

// 4 x 6 inch card at 300 dpi.
const W = 1200;
const H = 1800;

const fontVar = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export async function renderQrCard(input: QrCardInput): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const serif = fontVar("--font-newsreader", "Georgia, serif");
  const sans = fontVar("--font-manrope", "system-ui, sans-serif");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#fdf9f5";
  ctx.fillRect(0, 0, W, H);
  // Brass and wine band along the top, as on the on-screen card.
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, "#ffddb2");
  band.addColorStop(0.5, "#5b1e2c");
  band.addColorStop(1, "#ffddb2");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 28);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#7a5823";
  ctx.font = `600 44px ${sans}`;
  const studio = input.studioName.toUpperCase();
  ctx.fillText(studio.length > 40 ? `${studio.slice(0, 39)}…` : studio, W / 2, 200);

  ctx.fillStyle = "#3f0818";
  ctx.font = `500 96px ${serif}`;
  const titleLines = wrap(ctx, input.eventName, W - 200);
  titleLines.forEach((l, i) => ctx.fillText(l, W / 2, 340 + i * 110));

  const afterTitle = 340 + (titleLines.length - 1) * 110;
  ctx.fillStyle = "#534345";
  ctx.font = `italic 400 48px ${serif}`;
  ctx.fillText("Scan to find all photos of you", W / 2, afterTitle + 100);

  const qrSize = 760;
  const qrTop = afterTitle + 170;
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, input.url, { width: qrSize, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1c1c19", light: "#ffffff" } });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect((W - qrSize) / 2 - 20, qrTop - 20, qrSize + 40, qrSize + 40);
  ctx.drawImage(qr, (W - qrSize) / 2, qrTop, qrSize, qrSize);

  ctx.fillStyle = "#534345";
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(input.url.replace(/^https?:\/\//, ""), W / 2, qrTop + qrSize + 90);

  ctx.fillStyle = "#807474";
  ctx.font = `500 38px ${sans}`;
  ctx.fillText(QR_CREDIT_LINE, W / 2, H - 90);
  return canvas;
}

function save(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

const fileBase = (name: string) => name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "event";

export async function downloadQrPng(input: QrCardInput) {
  const canvas = await renderQrCard(input);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
  save(blob, `${fileBase(input.eventName)}-qr.png`);
}

export async function downloadQrPdf(input: QrCardInput) {
  const { PDFDocument } = await import("pdf-lib");
  const canvas = await renderQrCard(input);
  const png = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.eventName}: QR card`);
  // 4 x 6 inches in PDF points (72 per inch).
  const page = pdf.addPage([288, 432]);
  const image = await pdf.embedPng(await png.arrayBuffer());
  page.drawImage(image, { x: 0, y: 0, width: 288, height: 432 });
  const bytes = await pdf.save();
  save(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${fileBase(input.eventName)}-qr.pdf`);
}

/** Small QR for on-screen use (data URL). */
export function qrDataUrl(url: string, size = 320) {
  return QRCode.toDataURL(url, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1c19", light: "#ffffff" } });
}
