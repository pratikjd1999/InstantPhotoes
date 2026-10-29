"use client";

import { api } from "./api";

// PHG-3: download selected originals as one zip built in the browser (no server load), capped at 500 MB per batch.

interface DownloadUrls {
  totalBytes: number;
  files: { photoId: string; name: string; size: number; url: string }[];
}

/** Keeps file names unique inside the zip: IMG_1.jpg, IMG_1 (2).jpg, ... */
function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    if (!count) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)} (${count + 1})${n.slice(dot)}` : `${n} (${count + 1})`;
  });
}

export async function downloadOriginals(eventId: string, photoIds: string[], zipName: string) {
  const { files } = await api<DownloadUrls>(`/events/${eventId}/originals/download-urls`, { method: "POST", json: { photoIds } });
  if (!files.length) throw new Error("None of the selected photos has a stored original yet.");

  // A single photo downloads directly, without a zip.
  if (files.length === 1) {
    const a = document.createElement("a");
    a.href = files[0]!.url;
    a.download = files[0]!.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const { downloadZip } = await import("client-zip");
  const names = uniqueNames(files.map((f) => f.name));
  const inputs = files.map(async (f, i) => {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`Couldn't fetch ${f.name}.`);
    return { name: names[i]!, input: res };
  });
  const blob = await downloadZip(await Promise.all(inputs)).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${zipName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "originals"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}
