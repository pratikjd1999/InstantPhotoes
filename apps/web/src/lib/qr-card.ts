"use client";

import QRCode from "qrcode";

// Printable QR card (EVT-3): studio name at the top, event name and QR in the middle, the credit line at the bottom.
// Drawn on a canvas so the PNG and the PDF are the same picture.

/** The credit line wording (EVT-3), e.g. "Marketed by" / "Backed by". The brand name below it is drawn large. */
export const QR_CREDIT_PREFIX = "Powered by";
export const QR_BRAND = "InstantPhotos";

export interface QrCardInput {
  studioName: string;
  eventName: string;
  url: string;
}

// 4 x 6 inch card at 300 dpi.
const W = 1200;
const H = 1800;
/** Height of the brand band at the bottom. */
const BAND = 290;

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
  if (lines.length <= 3) return lines;
  // Too long for three lines: end the third with an ellipsis rather than silently dropping words.
  let last = `${lines[2]} ${lines.slice(3).join(" ")}`;
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
  return [lines[0]!, lines[1]!, `${last}…`];
}

/** Simple camera mark (same idea as the app logo), drawn so it never depends on an icon font. */
function drawCamera(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.lineJoin = "round";
  // body with the viewfinder bump on top
  ctx.beginPath();
  ctx.moveTo(4 * s, 7 * s);
  ctx.lineTo(8 * s, 7 * s);
  ctx.lineTo(9.5 * s, 4.5 * s);
  ctx.lineTo(14.5 * s, 4.5 * s);
  ctx.lineTo(16 * s, 7 * s);
  ctx.lineTo(20 * s, 7 * s);
  ctx.quadraticCurveTo(22 * s, 7 * s, 22 * s, 9 * s);
  ctx.lineTo(22 * s, 18 * s);
  ctx.quadraticCurveTo(22 * s, 20 * s, 20 * s, 20 * s);
  ctx.lineTo(4 * s, 20 * s);
  ctx.quadraticCurveTo(2 * s, 20 * s, 2 * s, 18 * s);
  ctx.lineTo(2 * s, 9 * s);
  ctx.quadraticCurveTo(2 * s, 7 * s, 4 * s, 7 * s);
  ctx.closePath();
  ctx.stroke();
  // lens
  ctx.beginPath();
  ctx.arc(12 * s, 13.25 * s, 3.6 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Bottom band: "POWERED BY" and the InstantPhotos mark, large and on wine so the platform stands out. */
function drawBrandBand(ctx: CanvasRenderingContext2D, serif: string, sans: string) {
  const top = H - BAND;
  const bg = ctx.createLinearGradient(0, top, W, H);
  bg.addColorStop(0, "#3f0818");
  bg.addColorStop(1, "#5b1e2c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, top, W, BAND);
  ctx.fillStyle = "#ecbf80";
  ctx.fillRect(0, top, W, 8);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ecbf80";
  ctx.font = `600 32px ${sans}`;
  ctx.letterSpacing = "8px";
  ctx.fillText(QR_CREDIT_PREFIX.toUpperCase(), W / 2, top + 84);
  ctx.letterSpacing = "0px";

  // Logo tile + name, centred as one group.
  ctx.font = `600 92px ${serif}`;
  const nameWidth = ctx.measureText(QR_BRAND).width;
  const tile = 104;
  const gap = 30;
  const startX = (W - (tile + gap + nameWidth)) / 2;
  const tileY = top + 128;
  ctx.fillStyle = "#fdf9f5";
  roundRect(ctx, startX, tileY, tile, tile, 22);
  ctx.fill();
  drawCamera(ctx, startX + 16, tileY + 14, tile - 32, "#5b1e2c");

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(QR_BRAND, startX + tile + gap, tileY + tile / 2 + 4);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
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

  const qrTop = afterTitle + 170;
  // Keep the QR large, but always leave room for the link and the brand band (long event names wrap to 3 lines).
  const qrSize = Math.min(740, H - BAND - 150 - qrTop);
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, input.url, { width: qrSize, margin: 2, errorCorrectionLevel: "M", color: { dark: "#1c1c19", light: "#ffffff" } });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect((W - qrSize) / 2 - 20, qrTop - 20, qrSize + 40, qrSize + 40);
  ctx.drawImage(qr, (W - qrSize) / 2, qrTop, qrSize, qrSize);

  ctx.fillStyle = "#534345";
  ctx.font = `500 34px ${sans}`;
  ctx.fillText(input.url.replace(/^https?:\/\//, ""), W / 2, qrTop + qrSize + 90);

  drawBrandBand(ctx, serif, sans);
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
