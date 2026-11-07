"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicEvent } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";
import { GuestApiError, fmtPhone, guestApi, isValidPhone, phoneDigits } from "@/lib/guest-api";
import { PoweredBy, StudioMark, fmtEventDate } from "./brand";

// G06 (GAL-2): the gallery link was opened on a browser without the guest's cookie (new phone, WhatsApp's in-app
// browser, cleared data). The guest re-enters the number they registered with.

export function Reclaim({ token, event }: { token: string; event: PublicEvent }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; limited: boolean } | null>(null);
  const ok = isValidPhone(phone);

  async function submit() {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await guestApi(`/gallery/${encodeURIComponent(token)}/reclaim`, { method: "POST", json: { phone } });
      router.refresh(); // now signed in: the server renders the gallery
    } catch (e) {
      const err = e instanceof GuestApiError ? e : new GuestApiError("Something went wrong. Please try again.", 500);
      if (err.status === 404 || err.status === 410) return router.refresh();
      setError({ message: err.message, limited: err.status === 429 });
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <header className="flex flex-col items-center pb-5 text-center">
        <div className="mb-2">
          <StudioMark studio={event.studio} size="lg" />
        </div>
        <p className="font-serif text-headline-sm leading-tight text-on-surface">{event.studio.studioName}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3.5 py-1 shadow-sm ring-1 ring-outline/60">
          <Icon name="favorite" filled className="text-[15px] text-secondary" />
          <span className="text-label-sm font-semibold">{event.name}</span>
          <span className="text-on-surface-variant/60">·</span>
          <span className="text-label-sm text-on-surface-variant">{fmtEventDate(event.eventDate)}</span>
        </div>
      </header>

      <section className="relative flex flex-col items-center overflow-hidden rounded-xl bg-surface-lowest p-6 text-center shadow-sm">
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-secondary-container/30 blur-2xl" />
        <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-container shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container/40">
            <Icon name="lock" filled className="text-[24px] text-secondary" />
          </div>
        </div>
        <h1 className="mb-1 font-serif text-[1.75rem] leading-9 text-on-surface">Open your gallery</h1>
        <p className="mb-5 max-w-[270px] text-body-md text-on-surface-variant">Enter the mobile number you registered with.</p>

        {error && (
          <div
            role="alert"
            className={`mb-4 flex w-full items-start gap-2.5 rounded-lg p-3 text-left ${
              error.limited ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"
            }`}
          >
            <Icon name={error.limited ? "hourglass_top" : "error"} filled className={`mt-0.5 text-[20px] ${error.limited ? "text-secondary" : "text-error"}`} />
            <p className="text-body-sm">{error.message}</p>
          </div>
        )}

        <form
          className="flex w-full flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex w-full flex-col gap-1.5 text-left">
            <label htmlFor="reclaim-phone" className="text-label-md font-semibold text-on-surface">
              Mobile number
            </label>
            <div className="flex w-full overflow-hidden rounded-lg bg-surface-low ring-1 ring-outline transition focus-within:ring-2 focus-within:ring-primary">
              <span className="flex select-none items-center bg-surface-container px-3.5 text-body-md font-semibold text-on-surface">+91</span>
              <input
                id="reclaim-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                value={fmtPhone(phone)}
                onChange={(e) => setPhone(phoneDigits(e.target.value))}
                placeholder="98765 43210"
                className="h-12 min-w-0 flex-1 bg-transparent px-3.5 text-body-md font-medium tracking-wider text-on-surface outline-none placeholder:text-on-surface-variant/60"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!ok || busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-label-md font-semibold text-white shadow-md transition-all hover:bg-primary-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={busy ? "progress_activity" : "lock_open"} className={`text-[20px] ${busy ? "animate-spin" : ""}`} />
            Open my photos
          </button>
        </form>
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-xl bg-surface-low p-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tertiary-container">
          <Icon name="verified_user" className="text-[18px] text-on-tertiary-variant" />
        </div>
        <p className="text-body-sm leading-relaxed text-on-surface-variant">Your gallery is private. Only someone with this link and your number can open it.</p>
      </section>
      <PoweredBy />
    </main>
  );
}
