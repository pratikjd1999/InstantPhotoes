"use client";

import type { StudioBranding } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";
import { ContactCard, PoweredBy, StudioMark } from "./brand";

// G07: full-screen messages for links that can't be used, and for matching being unavailable.

export type GuestMessageKind = "expired" | "closed" | "not_found" | "gallery_not_found" | "error";

const COPY: Record<GuestMessageKind, { icon: string; title: string; text: string }> = {
  expired: { icon: "hourglass_bottom", title: "This gallery has expired", text: "Please contact your photographer for your photos." },
  closed: {
    icon: "archive",
    title: "This event is no longer taking new guests",
    text: "Already registered? Open the link you received earlier.",
  },
  not_found: { icon: "qr_code_scanner", title: "We can't find this event", text: "Check the QR code or link and try again." },
  gallery_not_found: { icon: "link_off", title: "We can't find this gallery", text: "Check the link and try again." },
  error: { icon: "sync", title: "We couldn't find your photos right now", text: "Please try again in a few minutes." },
};

type Action = { label: string; icon: string; href: string } | { label: string; icon: string; onClick: () => void };

export function GuestMessage({ kind, studio, action }: { kind: GuestMessageKind; studio?: StudioBranding; action?: Action }) {
  const copy = COPY[kind];
  const actionClass =
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-label-md font-semibold text-white shadow-sm transition-colors hover:bg-primary-container active:scale-[0.99]";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-6">
      <div className="relative overflow-hidden rounded-2xl bg-surface-lowest p-6 shadow-md">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-secondary-container/25 blur-2xl" />
        <div className="relative flex flex-col items-center text-center">
          {studio ? (
            <div className="mb-8 flex items-center gap-2">
              <StudioMark studio={studio} />
              <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">{studio.studioName}</span>
            </div>
          ) : (
            <div className="mb-8 flex items-center gap-2 rounded-full bg-surface-container px-3.5 py-1.5">
              <Icon name="photo_camera" filled className="text-[18px] text-primary" />
              <span className="text-label-md font-bold tracking-tight text-on-surface">InstantPhotos</span>
            </div>
          )}

          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-low shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container/40">
              <Icon name={copy.icon} className="text-[30px] text-secondary" />
            </div>
          </div>

          <h1 className="mb-2 font-serif text-[1.75rem] leading-9 text-on-surface">{copy.title}</h1>
          <p className="mb-8 max-w-xs text-body-md text-on-surface-variant">{copy.text}</p>

          {action && (
            <div className="mb-6 w-full">
              {"href" in action ? (
                <a href={action.href} className={actionClass}>
                  <Icon name={action.icon} className="text-[20px]" />
                  {action.label}
                </a>
              ) : (
                <button type="button" onClick={action.onClick} className={actionClass}>
                  <Icon name={action.icon} className="text-[20px]" />
                  {action.label}
                </button>
              )}
            </div>
          )}

          {studio && kind !== "error" && <ContactCard studio={studio} />}
        </div>
      </div>
      <PoweredBy />
    </main>
  );
}
