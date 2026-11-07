"use client";

import { useEffect, useRef, useState } from "react";
import type { GuestPhoto } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";

// G05: full-screen web copy with swipe navigation (GAL-5), single download (GAL-6) and "Not me" (GAL-8).
// Opening it adds a history entry, so the phone's back button closes the viewer instead of leaving the gallery.

const SWIPE_PX = 50;

export function Viewer({
  photos,
  index,
  total,
  onIndex,
  onClose,
  onHide,
  onImageError,
}: {
  photos: GuestPhoto[];
  index: number;
  total: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onHide: (photoId: string) => Promise<void>;
  onImageError: () => void;
}) {
  const photo = photos[Math.min(index, photos.length - 1)]!;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [hideError, setHideError] = useState<string | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;
  const prev = () => hasPrev && onIndex(index - 1);
  const next = () => hasNext && onIndex(index + 1);
  const close = () => history.back(); // the popstate handler below calls onClose

  useEffect(() => {
    history.pushState({ viewer: true }, "");
    const onPop = () => onCloseRef.current();
    window.addEventListener("popstate", onPop);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming) return;
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Fetch the neighbours ahead of time so swiping feels instant.
  useEffect(() => {
    for (const p of [photos[index - 1], photos[index + 1]]) if (p) new Image().src = p.webUrl;
  }, [index, photos]);

  async function confirmHide() {
    setHiding(true);
    setHideError(null);
    try {
      await onHide(photo.id);
      setConfirming(false);
      if (photos.length <= 1) close();
      else if (index >= photos.length - 1) onIndex(index - 1);
    } catch (e) {
      setHideError(e instanceof Error ? e.message : "Couldn't hide the photo. Please try again.");
    } finally {
      setHiding(false);
    }
  }

  const navBtn = "absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition hover:bg-black/50 hover:text-white active:scale-90 sm:flex";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0b0c] text-[#fdf9f5]" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <header className="relative z-10 flex items-center justify-between px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={close} aria-label="Close" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95">
          <Icon name="close" className="text-[24px]" />
        </button>
        <span className="rounded-full bg-white/10 px-4 py-1 text-label-md font-semibold tracking-wider">
          {index + 1} <span className="font-normal text-white/50">/</span> {total}
        </span>
        <span className="w-12" />
      </header>

      <div
        className="relative flex flex-1 touch-pan-y touch-pinch-zoom items-center justify-center overflow-hidden"
        onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || e.touches.length) return;
          const dx = e.changedTouches[0]!.clientX - start.x;
          const dy = e.changedTouches[0]!.clientY - start.y;
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
        }}
      >
        {/* Blur-up: the thumbnail (already cached from the grid) shows until the web copy has loaded. */}
        {loaded !== photo.id && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`t-${photo.id}`} src={photo.thumbUrl} alt="" aria-hidden="true" className="absolute max-h-full max-w-full scale-105 object-contain blur-md" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.webUrl}
          alt={`Photo ${index + 1} of ${total}`}
          onLoad={() => setLoaded(photo.id)}
          onError={onImageError}
          className={`relative max-h-full max-w-full select-none object-contain transition-opacity duration-300 ${loaded === photo.id ? "opacity-100" : "opacity-0"}`}
          draggable={false}
        />
        {loaded !== photo.id && <Icon name="progress_activity" className="absolute animate-spin text-[28px] text-white/60" />}
        {hasPrev && (
          <button type="button" onClick={prev} aria-label="Previous photo" className={`${navBtn} left-3`}>
            <Icon name="chevron_left" className="text-[28px]" />
          </button>
        )}
        {hasNext && (
          <button type="button" onClick={next} aria-label="Next photo" className={`${navBtn} right-3`}>
            <Icon name="chevron_right" className="text-[28px]" />
          </button>
        )}
      </div>

      <footer className="relative z-10 grid grid-cols-2 gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-white/15 text-label-md font-semibold transition hover:bg-white/25 active:scale-95"
        >
          <Icon name="visibility_off" className="text-[20px] text-white/70" />
          Not me
        </button>
        <a
          href={photo.downloadUrl}
          download
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-label-md font-semibold text-white shadow-lg transition hover:bg-primary-container active:scale-95"
        >
          <Icon name="download" className="text-[20px] text-secondary-container" />
          Download
        </a>
      </footer>

      {confirming && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/70 backdrop-blur-sm" onClick={() => !hiding && setConfirming(false)}>
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl bg-surface px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-on-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="hide-title"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-highest" />
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-error-container/60">
                <Icon name="visibility_off" className="text-[26px] text-error" />
              </div>
              <div>
                <h2 id="hide-title" className="font-serif text-headline-sm font-medium text-primary">
                  Hide this photo?
                </h2>
                <p className="mt-0.5 text-body-md text-on-surface-variant">It won't show in your gallery any more.</p>
              </div>
            </div>
            {hideError && <p className="mb-3 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">{hideError}</p>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void confirmHide()}
                disabled={hiding}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-error text-label-md font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
              >
                <Icon name={hiding ? "progress_activity" : "visibility_off"} className={`text-[20px] ${hiding ? "animate-spin" : ""}`} />
                Hide photo
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={hiding} className="h-11 w-full rounded-lg text-label-md font-semibold text-on-surface-variant hover:bg-surface-container">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
