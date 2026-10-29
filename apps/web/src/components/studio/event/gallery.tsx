"use client";

import { useEffect, useMemo, useState } from "react";
import type { PhotoItem, PhotoPage, PhotographerEvent } from "@instantphotos/core";
import { api, useApi } from "@/lib/api";
import { downloadOriginals } from "@/lib/originals";
import { Card, EmptyState, ErrorState, Icon, Modal, Skeleton, dangerBtn, fmtNumber, ghostBtn, primaryBtn, useToast } from "@/components/admin/ui";
import { PhotoStatusBadge, PhotoThumb, fmtBytes, fmtDateTime } from "@/components/studio/ui";

type Filter = "all" | "ready" | "processing" | "failed";

export function GalleryTab({
  event,
  version,
  onChanged,
  goUpload,
}: {
  event: PhotographerEvent;
  /** Bumped by the uploader when new files are confirmed. */
  version: number;
  onChanged: () => void;
  goUpload: () => void;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const { data, error, loading, reload } = useApi<PhotoPage>(`/events/${event.id}/photos?filter=${filter}&page=${page}&v=${version}-${tick}`);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspect, setInspect] = useState<PhotoItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setPage(1), [filter]);
  useEffect(() => setSelected(new Set()), [filter, page]);

  // While photos are still being processed, check back every 15 seconds.
  const working = event.stats.processing > 0;
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => {
      setTick((n) => n + 1);
      onChanged();
    }, 15_000);
    return () => clearInterval(t);
  }, [working, onChanged]);

  const photos = data?.photos ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const s = event.stats;
  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: s.photos },
    { key: "ready", label: "Ready", count: s.ready },
    { key: "processing", label: "Processing", count: s.processing },
    { key: "failed", label: "Failed", count: s.failed },
  ];
  const selectedList = useMemo(() => photos.filter((p) => selected.has(p.id)), [photos, selected]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOnPage = photos.length > 0 && photos.every((p) => selected.has(p.id));

  async function download(ids: string[]) {
    setBusy("download");
    try {
      await downloadOriginals(event.id, ids, `${event.name} originals`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(ids: string[]) {
    setBusy("delete");
    try {
      const res = await api<{ deleted: number }>(`/events/${event.id}/photos/delete`, { method: "POST", json: { photoIds: ids } });
      toast(`${res.deleted} photo${res.deleted === 1 ? "" : "s"} deleted. ${res.deleted === 1 ? "It is" : "They are"} gone from every guest gallery.`);
      setSelected(new Set());
      setConfirmDelete(null);
      setInspect(null);
      reload();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function retry(p: PhotoItem) {
    setBusy(`retry-${p.id}`);
    try {
      await api(`/photos/${p.id}/retry`, { method: "POST" });
      toast(`${p.filename} queued for processing again.`);
      setInspect(null);
      reload();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter photos">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={filter === c.key}
              onClick={() => setFilter(c.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-label-md transition-colors ${
                filter === c.key ? "bg-primary text-white" : "bg-surface-lowest text-on-surface-variant ring-1 ring-outline hover:bg-surface-container"
              }`}
            >
              {c.label}
              {c.key !== "all" && <span className={`text-[11px] ${filter === c.key ? "text-white/80" : ""}`}>{fmtNumber(c.count)}</span>}
            </button>
          ))}
        </div>
        <p className="text-label-sm text-on-surface-variant">Sorted by capture time, oldest first</p>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary px-4 py-2.5 text-white shadow-lg">
          <label className="flex items-center gap-2 text-label-md">
            <input
              type="checkbox"
              checked={allOnPage}
              onChange={() => setSelected(allOnPage ? new Set() : new Set(photos.map((p) => p.id)))}
              className="h-4 w-4 accent-white"
            />
            {selected.size} selected
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => download([...selected])}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary-container px-3 py-1.5 text-label-md text-on-secondary-container disabled:opacity-60"
            >
              <Icon name={busy === "download" ? "progress_activity" : "download"} className={`text-[18px] ${busy === "download" ? "animate-spin" : ""}`} />
              {busy === "download" ? "Preparing zip..." : `Download originals (${selected.size})`}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete([...selected])}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-label-md hover:bg-white/25"
            >
              <Icon name="delete" className="text-[18px]" />
              Delete
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-label-md hover:bg-white/15">
              Clear
            </button>
          </div>
        </div>
      )}

      <Card>
        {loading && !data ? (
          <Skeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : photos.length === 0 ? (
          filter === "all" ? (
            <EmptyState
              icon="add_photo_alternate"
              title="No photos yet"
              text="Upload the event's JPEG photos. Guests can find themselves as soon as each one is processed."
              action={
                <button type="button" className={primaryBtn} onClick={goUpload}>
                  <Icon name="upload" className="text-[20px]" />
                  Upload photos
                </button>
              }
            />
          ) : (
            <EmptyState icon="filter_alt_off" title="Nothing here" text="No photos have this status right now." />
          )
        ) : (
          <div className="flex flex-col gap-4 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {photos.map((p) => {
                const isSel = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`group relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-high ring-offset-2 ${isSel ? "ring-2 ring-primary" : ""}`}
                  >
                    <button type="button" onClick={() => setInspect(p)} className="absolute inset-0" aria-label={`Open ${p.filename}`}>
                      <PhotoThumb src={p.thumbUrl} alt={p.filename} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
                    </button>
                    <label
                      className={`absolute left-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-surface-lowest/90 shadow-sm transition-opacity ${
                        isSel || selected.size > 0 ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100"
                      }`}
                    >
                      <input type="checkbox" checked={isSel} onChange={() => toggle(p.id)} aria-label={`Select ${p.filename}`} className="h-4 w-4 accent-primary" />
                    </label>
                    {p.status !== "ready" && (
                      <span className="absolute right-2 top-2">
                        <PhotoStatusBadge status={p.status} compact />
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 max-w-[85%] truncate rounded bg-inverse-surface/80 px-1.5 py-0.5 text-[11px] text-inverse-on-surface">
                      {p.filename}
                    </span>
                  </div>
                );
              })}
            </div>
            {pages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-outline/60 pt-4 sm:flex-row">
                <p className="text-label-sm text-on-surface-variant">
                  Page <strong className="text-on-surface">{page}</strong> of <strong className="text-on-surface">{pages}</strong> ·{" "}
                  {fmtNumber(data!.total)} photos
                </p>
                <div className="flex gap-2">
                  <button type="button" className={`${ghostBtn} ring-1 ring-outline`} disabled={page === 1} onClick={() => setPage((n) => n - 1)}>
                    <Icon name="chevron_left" className="text-[18px]" />
                    Previous
                  </button>
                  <button type="button" className={`${ghostBtn} ring-1 ring-outline`} disabled={page === pages} onClick={() => setPage((n) => n + 1)}>
                    Next
                    <Icon name="chevron_right" className="text-[18px]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal open={inspect !== null} onClose={() => setInspect(null)} icon="image" title={inspect?.filename ?? ""}>
        {inspect && (
          <div className="flex flex-col gap-4">
            <div className="relative flex h-72 items-center justify-center overflow-hidden rounded-xl bg-inverse-surface sm:h-96">
              {inspect.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inspect.previewUrl} alt={inspect.filename} className="max-h-full max-w-full object-contain" />
              ) : (
                <Icon name="image" className="text-[40px] text-inverse-on-surface/50" />
              )}
              {inspect.faceCount !== null && (
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-surface-lowest/90 px-2.5 py-1 text-label-sm font-semibold">
                  <Icon name="face" className="text-[16px] text-secondary" />
                  {inspect.faceCount} {inspect.faceCount === 1 ? "face" : "faces"} found
                </span>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-body-sm sm:grid-cols-3">
              <div>
                <dt className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">Status</dt>
                <dd className="mt-1">
                  <PhotoStatusBadge status={inspect.status} />
                </dd>
              </div>
              <div>
                <dt className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">File size</dt>
                <dd className="mt-1 font-semibold">{fmtBytes(inspect.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                  {inspect.takenAt ? "Taken" : "Uploaded"}
                </dt>
                <dd className="mt-1 font-semibold">
                  {inspect.takenAt ? fmtDateTime(inspect.takenAt) : inspect.uploadedAt ? fmtDateTime(inspect.uploadedAt) : "—"}
                </dd>
              </div>
            </dl>
            {inspect.failReason && <p className="rounded-lg bg-error-container/50 p-3 text-body-sm text-on-error-container">{inspect.failReason}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {inspect.status === "failed" && (
                <button type="button" className={`${ghostBtn} ring-1 ring-outline`} disabled={busy !== null} onClick={() => retry(inspect)}>
                  <Icon name="refresh" className="text-[18px]" />
                  Retry processing
                </button>
              )}
              {inspect.status !== "upload_failed" && inspect.status !== "pending_upload" && (
                <button type="button" className={primaryBtn} disabled={busy !== null} onClick={() => download([inspect.id])}>
                  <Icon name="download" className="text-[18px]" />
                  Download original
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-error-container px-4 py-2.5 text-label-md text-error hover:bg-error-container/70"
                onClick={() => setConfirmDelete([inspect.id])}
              >
                <Icon name="delete" className="text-[18px]" />
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        icon="delete"
        tone="danger"
        title={confirmDelete?.length === 1 ? "Delete this photo?" : `Delete ${confirmDelete?.length ?? 0} photos?`}
        description="They disappear from every guest gallery and download straight away, together with their face matches."
        footer={
          <>
            <button type="button" className={ghostBtn} onClick={() => setConfirmDelete(null)} disabled={busy === "delete"}>
              Cancel
            </button>
            <button type="button" className={dangerBtn} onClick={() => confirmDelete && remove(confirmDelete)} disabled={busy === "delete"}>
              {busy === "delete" ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        {selectedList.length > 0 && confirmDelete && confirmDelete.length > 1 && (
          <p className="text-body-sm text-on-surface-variant">
            {selectedList
              .slice(0, 3)
              .map((p) => p.filename)
              .join(", ")}
            {selectedList.length > 3 ? ` and ${selectedList.length - 3} more` : ""}
          </p>
        )}
      </Modal>
    </div>
  );
}
