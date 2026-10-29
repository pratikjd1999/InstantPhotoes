"use client";

import type { UploadBatchResult } from "@instantphotos/core";
import { api } from "./api";

// Browser side of the photo upload (UPL-1..8):
// 1. send the batch (name, size, type) to the app, get one presigned PUT URL per file;
// 2. PUT the files straight to storage, 4 at a time, with progress and up to 3 attempts each;
// 3. tell the app which files arrived (it verifies them and queues processing) and which gave up.

export type UploadState = "queued" | "uploading" | "done" | "failed" | "skipped" | "rejected";

export interface UploadRow {
  id: string;
  name: string;
  size: number;
  state: UploadState;
  progress: number;
  message?: string;
  file?: File;
  photoId?: string;
  url?: string;
}

const CONCURRENCY = 4;
const ATTEMPTS = 3;
const COMPLETE_EVERY = 20;

function put(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "image/jpeg");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage answered ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timed out"));
    xhr.send(file);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Uploader {
  rows: UploadRow[] = [];
  running = false;
  private listeners = new Set<() => void>();

  constructor(
    private eventId: string,
    /** Called after each batch of files is confirmed, so the gallery can refresh. */
    private onConfirmed: () => void,
  ) {}

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit() {
    this.rows = [...this.rows];
    this.listeners.forEach((fn) => fn());
  }

  private update(id: string, patch: Partial<UploadRow>) {
    this.rows = this.rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    this.listeners.forEach((fn) => fn());
  }

  clearFinished() {
    this.rows = this.rows.filter((r) => r.state === "queued" || r.state === "uploading" || r.state === "failed");
    this.emit();
  }

  /** Adds files and starts uploading. Files are announced to the app in chunks of 500. */
  async add(files: File[]) {
    const fresh: UploadRow[] = files.map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, state: "queued", progress: 0, file: f }));
    this.rows = [...fresh, ...this.rows];
    this.emit();

    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500);
      let res: UploadBatchResult;
      try {
        res = await api<UploadBatchResult>(`/events/${this.eventId}/uploads`, {
          method: "POST",
          json: { files: chunk.map((r) => ({ name: r.name, size: r.size, type: r.file?.type ?? "" })) },
        });
      } catch (e) {
        chunk.forEach((r) => this.update(r.id, { state: "failed", message: (e as Error).message }));
        continue;
      }
      // The server answers per file name + size; map its answers back onto our rows.
      const pending = new Map(chunk.map((r) => [`${r.name}\n${r.size}`, r]));
      for (const t of res.uploads) {
        const row = pending.get(`${t.name}\n${t.size}`);
        if (row) {
          this.update(row.id, { photoId: t.photoId, url: t.url });
          pending.delete(`${t.name}\n${t.size}`);
        }
      }
      for (const s of res.skipped) {
        const row = [...pending.values()].find((r) => r.name === s.name);
        if (row) {
          this.update(row.id, { state: "skipped", message: s.reason, file: undefined });
          pending.delete(`${row.name}\n${row.size}`);
        }
      }
      for (const s of res.rejected) {
        const row = [...pending.values()].find((r) => r.name === s.name);
        if (row) {
          this.update(row.id, { state: "rejected", message: s.reason, file: undefined });
          pending.delete(`${row.name}\n${row.size}`);
        }
      }
    }
    void this.run();
  }

  /** Puts a failed row back in the queue. Asks the app for a fresh URL if the old one may have expired. */
  async retry(id: string) {
    const row = this.rows.find((r) => r.id === id);
    if (!row?.file) return;
    this.update(id, { state: "queued", progress: 0, message: undefined, url: undefined, photoId: undefined });
    try {
      const res = await api<UploadBatchResult>(`/events/${this.eventId}/uploads`, {
        method: "POST",
        json: { files: [{ name: row.name, size: row.size, type: row.file.type }] },
      });
      const t = res.uploads[0];
      if (t) this.update(id, { photoId: t.photoId, url: t.url });
      else this.update(id, { state: res.skipped.length ? "skipped" : "rejected", message: (res.skipped[0] ?? res.rejected[0])?.reason });
    } catch (e) {
      this.update(id, { state: "failed", message: (e as Error).message });
      return;
    }
    void this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    const confirmed: string[] = [];
    const gaveUp: string[] = [];

    const flush = async () => {
      if (confirmed.length) {
        const batch = confirmed.splice(0);
        try {
          const res = await api<{ uploaded: number; failed: string[] }>(`/events/${this.eventId}/uploads/complete`, {
            method: "POST",
            json: { photoIds: batch },
          });
          for (const pid of res.failed) {
            const row = this.rows.find((r) => r.photoId === pid);
            if (row) this.update(row.id, { state: "failed", message: "The file did not arrive. Retry it." });
          }
        } catch {
          // The cleanup sweep (UPL-8b) catches anything left in pending_upload.
        }
        this.onConfirmed();
      }
      if (gaveUp.length) {
        const batch = gaveUp.splice(0);
        await api(`/events/${this.eventId}/uploads/failed`, { method: "POST", json: { photoIds: batch } }).catch(() => {});
      }
    };

    const worker = async () => {
      for (;;) {
        const row = this.rows.find((r) => r.state === "queued" && r.url && r.file);
        if (!row) return;
        this.update(row.id, { state: "uploading", progress: 0 });
        let lastError = "";
        for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
          try {
            await put(row.url!, row.file!, (progress) => this.update(row.id, { progress }));
            lastError = "";
            break;
          } catch (e) {
            lastError = (e as Error).message;
            if (attempt < ATTEMPTS) await wait(800 * attempt);
          }
        }
        if (lastError) {
          this.update(row.id, { state: "failed", message: lastError });
          gaveUp.push(row.photoId!);
        } else {
          this.update(row.id, { state: "done", progress: 100 });
          confirmed.push(row.photoId!);
          if (confirmed.length >= COMPLETE_EVERY) await flush();
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    await flush();
    this.running = false;
    // Rows that got their URL while the workers were finishing.
    if (this.rows.some((r) => r.state === "queued" && r.url)) void this.run();
  }
}
