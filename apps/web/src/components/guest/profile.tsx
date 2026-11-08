"use client";

import { useEffect, useRef, useState } from "react";
import type { StudioBranding } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";
import { ContactLinks, StudioMark, contactLinks } from "./brand";

// The photographer's profile as a sheet over the guest page: cover image, logo, names and ways to get in touch.
// Like the photo viewer, opening it adds a history entry so the phone's back button closes it.

export function StudioProfileButton({ studio }: { studio: StudioBranding }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 text-label-sm font-semibold text-primary ring-1 ring-outline transition-colors hover:bg-surface-high"
      >
        <Icon name="person" className="text-[16px]" />
        View profile
      </button>
      {open && <StudioProfile studio={studio} onClose={() => setOpen(false)} />}
    </>
  );
}

function StudioProfile({ studio, onClose }: { studio: StudioBranding; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = () => history.back(); // the popstate handler below calls onClose

  useEffect(() => {
    history.pushState({ profile: true }, "");
    const onPop = () => onCloseRef.current();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && history.back();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const showName = studio.displayName && studio.displayName.trim().toLowerCase() !== studio.studioName.trim().toLowerCase();
  const hasContact = contactLinks(studio).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-inverse-surface/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-profile-title"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-surface-lowest shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="relative w-full overflow-hidden bg-linear-to-br from-primary to-primary-container">
          {studio.brandImageUrl ? (
            // Natural height, so a banner with text in it isn't cropped. Very tall images are capped.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={studio.brandImageUrl} alt="" className="block max-h-64 w-full object-cover" />
          ) : (
            <div className="h-28" />
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="relative -mt-7 mb-3 w-fit rounded-full ring-4 ring-surface-lowest">
            <StudioMark studio={studio} size="lg" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-secondary">Photographer</p>
          <h2 id="studio-profile-title" className="font-serif text-headline-sm font-medium text-primary">
            {studio.studioName}
          </h2>
          {showName && <p className="text-body-sm text-on-surface-variant">by {studio.displayName}</p>}

          <div className="mt-5 rounded-xl bg-surface-container p-3">
            {hasContact ? (
              <ContactLinks studio={studio} />
            ) : (
              <p className="px-1 py-2 text-body-sm text-on-surface-variant">This photographer hasn't added contact details yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
