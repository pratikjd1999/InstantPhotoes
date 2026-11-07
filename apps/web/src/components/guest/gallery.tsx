"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GuestGalleryPage, GuestPhoto, PublicEvent } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";
import { GuestApiError, guestApi } from "@/lib/guest-api";
import { uniqueNames } from "@/lib/originals";
import { ContactCard, PoweredBy, StudioHeader } from "./brand";
import { Viewer } from "./viewer";

// G04: the guest's private gallery (GAL-4..9). Thumbnails in capture-time order, 50 per page with infinite scroll.
// New matches appear while the page is open: it checks every minute and offers to show them.

const POLL_MS = 60_000;

type Download = { state: "idle" } | { state: "running"; done: number; total: number } | { state: "done"; total: number } | { state: "error"; message: string };

const zipName = (event: string) => `${event.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "photos"}.zip`;

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

export function Gallery({ token, event, guestName, initial }: { token: string; event: PublicEvent; guestName: string; initial: GuestGalleryPage }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<GuestPhoto[]>(initial.photos);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<GuestGalleryPage | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [download, setDownload] = useState<Download>({ state: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);

  const base = `/gallery/${encodeURIComponent(token)}`;
  const first = guestName.trim().split(/\s+/)[0];

  /** 401 or 410: the session ended or the gallery expired. The server page shows the right screen. */
  const handleAccess = useCallback(
    (e: unknown) => {
      if (e instanceof GuestApiError && (e.status === 401 || e.status === 410 || e.status === 404)) {
        router.refresh();
        return true;
      }
      return false;
    },
    [router],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 2800);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || photos.length >= total) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const next = await guestApi<GuestGalleryPage>(`${base}/photos?page=${page + 1}`);
      setPhotos((list) => {
        const seen = new Set(list.map((p) => p.id));
        return [...list, ...next.photos.filter((p) => !seen.has(p.id))];
      });
      setTotal(next.total);
      setPage(next.page);
    } catch (e) {
      if (!handleAccess(e)) setLoadError(e instanceof Error ? e.message : "Couldn't load more photos.");
    } finally {
      setLoadingMore(false);
    }
  }, [base, handleAccess, loadingMore, page, photos.length, total]);

  // Infinite scroll: load the next page well before the end of the grid comes into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // New matches: check page 1 every minute while the page is visible, and when the guest comes back to it.
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const latest = await guestApi<GuestGalleryPage>(`${base}/photos?page=1`);
        if (latest.total > total) setFresh(latest);
      } catch (e) {
        handleAccess(e);
      }
    };
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [base, handleAccess, total]);

  async function checkAgain() {
    try {
      showFresh(await guestApi<GuestGalleryPage>(`${base}/photos?page=1`));
      showToast("Checked for new photos");
    } catch (e) {
      if (!handleAccess(e)) showToast(e instanceof Error ? e.message : "Couldn't check. Please try again.");
    }
  }

  function showFresh(next: GuestGalleryPage) {
    setPhotos(next.photos);
    setTotal(next.total);
    setPage(1);
    setFresh(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Signed URLs last an hour (GAL-10). If an image fails after that, fetch fresh URLs for everything loaded so far. */
  const refreshUrls = useCallback(async () => {
    if (Date.now() - lastRefresh.current < 5 * 60_000) return;
    lastRefresh.current = Date.now();
    try {
      const pages = await Promise.all(Array.from({ length: page }, (_, i) => guestApi<GuestGalleryPage>(`${base}/photos?page=${i + 1}`)));
      const byId = new Map(pages.flatMap((p) => p.photos).map((p) => [p.id, p]));
      setPhotos((list) => list.map((p) => byId.get(p.id) ?? p));
      setTotal(pages[0]?.total ?? total);
    } catch (e) {
      handleAccess(e);
    }
  }, [base, handleAccess, page, total]);

  async function hide(photoId: string) {
    await guestApi(`${base}/hide/${photoId}`, { method: "POST" });
    setPhotos((list) => list.filter((p) => p.id !== photoId));
    setTotal((t) => Math.max(0, t - 1));
    showToast("Photo hidden");
  }

  // GAL-7: zip of the web copies, built in the browser (D24).
  async function downloadAll() {
    const controller = new AbortController();
    abort.current = controller;
    try {
      setDownload({ state: "running", done: 0, total });
      const { files } = await guestApi<{ files: { name: string; url: string }[] }>(`${base}/download-all`, { signal: controller.signal });
      if (!files.length) return setDownload({ state: "idle" });
      setDownload({ state: "running", done: 0, total: files.length });
      const names = uniqueNames(files.map((f) => f.name));
      const fetchFile = (i: number) => {
        const p = fetch(files[i]!.url, { signal: controller.signal }).then((res) => {
          if (!res.ok) throw new Error(`Couldn't download ${files[i]!.name}.`);
          return res.blob();
        });
        p.catch(() => {}); // a cancelled download must not surface as an unhandled rejection
        return p;
      };
      // A few files in flight at once: fast on good connections, gentle on weak ones.
      async function* entries() {
        const ahead: Promise<Blob>[] = [];
        for (let i = 0; i < Math.min(4, files.length); i++) ahead.push(fetchFile(i));
        for (let i = 0; i < files.length; i++) {
          const blob = await ahead[i]!;
          if (i + 4 < files.length) ahead.push(fetchFile(i + 4));
          setDownload({ state: "running", done: i + 1, total: files.length });
          yield { name: names[i]!, input: blob };
        }
      }
      const { downloadZip } = await import("client-zip");
      const zip = await downloadZip(entries()).blob();
      if (controller.signal.aborted) return;
      saveBlob(zip, zipName(event.name));
      setDownload({ state: "done", total: files.length });
    } catch (e) {
      if (controller.signal.aborted) return setDownload({ state: "idle" });
      if (handleAccess(e)) return setDownload({ state: "idle" });
      setDownload({ state: "error", message: e instanceof Error ? e.message : "The download failed. Please try again." });
    }
  }

  function cancelDownload() {
    abort.current?.abort();
    setDownload({ state: "idle" });
  }

  const count = `${total} photo${total === 1 ? "" : "s"}`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-24 sm:pb-6">
      <StudioHeader studio={event.studio} />

      <div className="mb-5 flex flex-col gap-1">
        <h1 className="font-serif text-[1.75rem] leading-9 tracking-tight text-primary sm:text-headline-lg">{event.name}</h1>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-body-md font-medium text-on-surface">
            Hi {first}
            {total > 0 && (
              <>
                <span className="mx-1.5 text-outline">·</span>
                <span className="text-secondary">{count} of you</span>
              </>
            )}
          </p>
          {total > 0 && (
            <button
              type="button"
              onClick={() => void downloadAll()}
              className="hidden h-10 items-center gap-1.5 rounded-lg bg-surface-container px-3.5 text-label-md font-semibold text-secondary shadow-sm transition-colors hover:bg-secondary-container hover:text-on-secondary-container sm:flex"
            >
              <Icon name="download" className="text-[18px]" />
              Download all
            </button>
          )}
        </div>
      </div>

      {total > 0 ? (
        <>
          <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-surface-container p-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary-container">
              <Icon name="bolt" filled className="text-[14px] text-on-secondary-container" />
            </span>
            <p className="text-body-sm leading-snug text-on-surface">New photos appear here as the photographer uploads them. Check back later.</p>
          </div>

          <div className="grid grid-cols-3 gap-0.75 overflow-hidden rounded-xl sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setViewing(i)}
                aria-label={`Open photo ${i + 1} of ${total}`}
                className="group relative aspect-square overflow-hidden bg-surface-container"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbUrl}
                  alt=""
                  loading={i < 12 ? "eager" : "lazy"}
                  decoding="async"
                  onError={() => void refreshUrls()}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>

          <div ref={sentinel} className="flex flex-col items-center py-6 text-center">
            {loadingMore ? (
              <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                <Icon name="progress_activity" className="animate-spin text-[18px] text-secondary" />
                Loading more photos…
              </span>
            ) : loadError ? (
              <button type="button" onClick={() => void loadMore()} className="flex items-center gap-1.5 text-label-md font-semibold text-error">
                <Icon name="refresh" className="text-[18px]" />
                {loadError} Tap to retry.
              </button>
            ) : (
              photos.length >= total && (
                <span className="rounded-full bg-surface-container px-4 py-2 text-label-sm text-on-surface-variant">
                  {total === 1 ? "That's your photo so far" : `That's all ${count} so far`}
                </span>
              )
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary-container/50 shadow-sm">
            <Icon name="face" className="text-[40px] text-secondary" />
          </div>
          <h2 className="mb-1 font-serif text-headline-sm text-primary">We haven't found you yet</h2>
          <p className="mb-6 max-w-xs text-body-md text-on-surface-variant">Photos are still being uploaded. Check back later.</p>
          <button
            type="button"
            onClick={() => void checkAgain()}
            className="mb-6 flex h-12 items-center gap-2 rounded-xl bg-surface-container px-5 text-label-md font-semibold text-secondary transition-colors hover:bg-secondary-container"
          >
            <Icon name="refresh" className="text-[18px]" />
            Check again
          </button>
          <div className="w-full max-w-sm">
            <ContactCard studio={event.studio} />
          </div>
        </div>
      )}

      <PoweredBy />

      {total > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(42,31,34,0.08)] backdrop-blur-md sm:hidden">
          <button
            type="button"
            onClick={() => void downloadAll()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-label-md font-semibold text-white shadow-md transition-all hover:bg-primary-container active:scale-[0.98]"
          >
            <Icon name="download" className="text-[20px]" />
            Download all {count}
          </button>
        </div>
      )}

      {fresh && (
        <button
          type="button"
          onClick={() => showFresh(fresh)}
          className="fixed left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-label-md font-semibold text-white shadow-xl"
        >
          <Icon name="arrow_upward" className="text-[18px]" />
          {fresh.total - total} new photo{fresh.total - total === 1 ? "" : "s"} · Show
        </button>
      )}

      {viewing !== null && photos[viewing] && (
        <Viewer
          photos={photos}
          index={viewing}
          total={total}
          onIndex={(i) => {
            setViewing(i);
            if (i >= photos.length - 5) void loadMore();
          }}
          onClose={() => setViewing(null)}
          onHide={hide}
          onImageError={() => void refreshUrls()}
        />
      )}

      {download.state !== "idle" && <DownloadSheet download={download} onCancel={cancelDownload} onClose={() => setDownload({ state: "idle" })} onRetry={() => void downloadAll()} />}

      {toast && (
        <div role="status" className="fixed left-1/2 top-4 z-60 flex -translate-x-1/2 items-center gap-2 rounded-full bg-inverse-surface px-4 py-2.5 text-label-md text-inverse-on-surface shadow-xl">
          <Icon name="check_circle" className="text-[18px] text-secondary-container" />
          {toast}
        </div>
      )}
    </main>
  );
}

function DownloadSheet({ download, onCancel, onClose, onRetry }: { download: Download; onCancel: () => void; onClose: () => void; onRetry: () => void }) {
  const pct = download.state === "running" && download.total ? Math.round((download.done / download.total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-inverse-surface/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="download-title">
      <div className="mx-auto w-full max-w-md rounded-t-3xl bg-surface-lowest p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-surface-highest" />
        {download.state === "running" && (
          <div className="flex flex-col">
            <div className="mb-2 flex items-start justify-between">
              <h3 id="download-title" className="font-serif text-headline-sm text-primary">
                Preparing your photos…
              </h3>
              <Icon name="progress_activity" className="animate-spin text-[22px] text-secondary" />
            </div>
            <p className="mb-4 text-body-md text-on-surface" aria-live="polite">
              {download.done} of {download.total}
            </p>
            <div className="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-surface-container p-3">
              <Icon name="info" className="text-[20px] text-secondary" />
              <span className="text-[13px] text-on-surface">Keep this page open until the download finishes.</span>
            </div>
            <button type="button" onClick={onCancel} className="h-11 w-full rounded-lg bg-surface-container text-label-md font-semibold text-on-surface-variant hover:bg-surface-high">
              Cancel
            </button>
          </div>
        )}
        {download.state === "done" && (
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-variant">
              <Icon name="check_circle" filled className="text-[32px]" />
            </div>
            <h3 id="download-title" className="mb-1 font-serif text-headline-sm text-primary">
              Your photos are downloaded
            </h3>
            <p className="mb-6 text-body-md text-on-surface-variant">Look for the zip file in your Downloads.</p>
            <button type="button" onClick={onClose} className="h-12 w-full rounded-xl bg-primary text-label-md font-semibold text-white hover:bg-primary-container">
              Done
            </button>
          </div>
        )}
        {download.state === "error" && (
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
              <Icon name="error" className="text-[30px]" />
            </div>
            <h3 id="download-title" className="mb-1 font-serif text-headline-sm text-primary">
              The download didn't finish
            </h3>
            <p className="mb-6 text-body-md text-on-surface-variant">{download.message}</p>
            <div className="grid w-full grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="h-12 rounded-xl bg-surface-container text-label-md font-semibold text-on-surface">
                Close
              </button>
              <button type="button" onClick={onRetry} className="h-12 rounded-xl bg-primary text-label-md font-semibold text-white hover:bg-primary-container">
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
