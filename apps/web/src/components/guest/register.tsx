"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicEvent } from "@instantphotos/core";
import { Icon } from "@/components/admin/ui";
import { GuestApiError, fmtPhone, guestApi, isValidPhone, phoneDigits } from "@/lib/guest-api";
import { PoweredBy, StudioHeader, fmtEventDate } from "./brand";
import { Finding } from "./finding";
import { GuestMessage } from "./message";

// G01: event page and registration (GST-1..9). The selfie comes from the phone's own camera (input capture="user"),
// is shrunk in the browser, and is checked by the face worker on submit. Problems come back as a message under the selfie.

const SELFIE_EDGE = 1280;
const CONSENT = "I agree that my selfie will be used to find my photos from this event.";

/** Redraws the photo as a JPEG of at most 1280 px. Browsers apply the EXIF rotation when drawing. */
async function shrinkSelfie(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, SELFIE_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Phase = "form" | "finding" | "unavailable";

export function Registration({ event, galleryPath }: { event: PublicEvent; galleryPath: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [selfie, setSelfie] = useState<{ blob: Blob; preview: string } | null>(null);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selfie) return;
    return () => URL.revokeObjectURL(selfie.preview);
  }, [selfie]);

  const phoneOk = isValidPhone(phone);
  const ready = name.trim().length > 0 && phoneOk && selfie && consent && !preparing;

  async function pickSelfie(file: File | undefined) {
    if (!file) return;
    setSelfieError(null);
    setPreparing(true);
    try {
      const blob = await shrinkSelfie(file);
      setSelfie({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setSelfie(null);
      setSelfieError("We couldn't read that photo. Please take the selfie again.");
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = ""; // picking the same file again must fire onChange
    }
  }

  async function submit() {
    if (!ready || !selfie) return;
    setError(null);
    setPhase("finding");
    const form = new FormData();
    form.set("name", name.trim());
    form.set("phone", phone);
    form.set("consent", "true");
    form.set("selfie", selfie.blob, "selfie.jpg");
    try {
      const res = await guestApi<{ redirect: string }>(`/events/${encodeURIComponent(event.code)}/guests`, { method: "POST", body: form });
      router.replace(res.redirect);
    } catch (e) {
      const err = e instanceof GuestApiError ? e : new GuestApiError("Something went wrong. Please try again.", 500);
      if (err.status === 503) return setPhase("unavailable");
      setPhase("form");
      if (err.status === 422) {
        setSelfie(null);
        setSelfieError(err.message);
        requestAnimationFrame(() => selfieRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } else if (err.status === 404 || err.status === 409) {
        router.refresh(); // the event was closed or removed meanwhile: the server shows the right screen
      } else {
        setError(err.message);
      }
    }
  }

  if (phase === "finding") return <Finding studio={event.studio} guestName={name} />;
  if (phase === "unavailable") {
    return <GuestMessage kind="error" studio={event.studio} action={{ label: "Try again", icon: "refresh", onClick: submit }} />;
  }

  const hero = event.studio.brandImageUrl;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <StudioHeader studio={event.studio} />

      {galleryPath && (
        <a
          href={galleryPath}
          className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-tertiary-container px-4 py-3 text-on-tertiary-variant"
        >
          <span className="flex items-center gap-2 text-body-sm font-semibold">
            <Icon name="check_circle" filled className="text-[18px]" />
            You're already registered
          </span>
          <span className="flex items-center gap-1 text-label-md font-semibold">
            Open my photos <Icon name="arrow_forward" className="text-[18px]" />
          </span>
        </a>
      )}

      {/* Event hero, over the photographer's brand image when there is one */}
      <section className="relative mb-4 overflow-hidden rounded-xl bg-surface-low shadow-sm">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-surface-lowest via-surface-low/85 to-primary-container/40" />
        <div className="relative flex min-h-44 flex-col justify-end p-4">
          <h1 className="font-serif text-[1.75rem] font-medium leading-9 text-on-surface">{event.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Icon name="calendar_today" className="text-[14px] text-secondary" />
              {fmtEventDate(event.eventDate)}
            </span>
            {event.venue && (
              <span className="flex items-center gap-1">
                <Icon name="location_on" className="text-[14px] text-secondary" />
                {event.venue}
              </span>
            )}
          </div>
          <p className="mt-2 text-body-sm font-medium text-on-surface">Find all your photos from today in seconds.</p>
        </div>
      </section>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="mb-4 flex flex-col gap-4 rounded-xl bg-surface-lowest p-5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="guest-name" className="text-label-md font-semibold text-on-surface">
              Your name
            </label>
            <div className="relative flex items-center">
              <Icon name="person" className="absolute left-3.5 text-[20px] text-on-surface-variant" />
              <input
                id="guest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                placeholder="e.g. Priya Sharma"
                className="h-12 w-full rounded-lg bg-surface-low pl-11 pr-4 text-body-md text-on-surface outline-none ring-1 ring-outline transition placeholder:text-on-surface-variant/60 focus:bg-surface-lowest focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="guest-phone" className="text-label-md font-semibold text-on-surface">
                Mobile number
              </label>
              {phoneOk && (
                <span className="flex items-center gap-1 rounded-full bg-tertiary-container px-2 py-0.5 text-[11px] font-semibold text-on-tertiary-variant">
                  <Icon name="check_circle" filled className="text-[13px]" />
                  Valid number
                </span>
              )}
            </div>
            <div
              className={`flex overflow-hidden rounded-lg bg-surface-low ring-1 transition focus-within:ring-2 ${
                phoneTouched && !phoneOk ? "ring-error focus-within:ring-error" : "ring-outline focus-within:ring-primary"
              }`}
            >
              <span className="flex select-none items-center bg-surface-container px-3.5 text-body-md font-semibold text-on-surface">+91</span>
              <input
                id="guest-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={fmtPhone(phone)}
                onChange={(e) => setPhone(phoneDigits(e.target.value))}
                onBlur={() => setPhoneTouched(true)}
                placeholder="98765 43210"
                aria-invalid={phoneTouched && !phoneOk}
                aria-describedby="guest-phone-help"
                className="h-12 min-w-0 flex-1 bg-transparent px-3.5 text-body-md tracking-wide text-on-surface outline-none placeholder:text-on-surface-variant/60"
              />
            </div>
            <p id="guest-phone-help" className={`flex items-center gap-1 text-[12px] ${phoneTouched && !phoneOk ? "text-error" : "text-on-surface-variant"}`}>
              <Icon name={phoneTouched && !phoneOk ? "error" : "info"} className="text-[14px]" />
              {phoneTouched && !phoneOk ? "Enter a valid 10-digit mobile number." : "We'll use this if you open your gallery on another phone."}
            </p>
          </div>

          <div ref={selfieRef} className="flex flex-col gap-2 pt-1">
            <span className="text-label-md font-semibold text-on-surface">Your selfie</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void pickSelfie(e.target.files?.[0])}
            />
            {selfie ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-low p-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selfie.preview} alt="Your selfie" className="h-16 w-16 rounded-full object-cover shadow-sm" />
                    <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-variant">
                      <Icon name="check" className="text-[13px]" />
                    </span>
                  </div>
                  <span className="text-body-md font-semibold text-on-surface">Selfie ready</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex min-h-11 items-center gap-1 rounded-lg bg-surface-container px-3 text-body-sm font-semibold text-secondary transition-colors hover:bg-surface-high active:scale-95"
                >
                  <Icon name="refresh" className="text-[16px]" />
                  Retake
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={preparing}
                className={`flex flex-col items-center justify-center rounded-xl p-6 text-center transition active:scale-[0.99] ${
                  selfieError ? "bg-error-container/40 ring-1 ring-error/40" : "bg-surface-low ring-1 ring-outline"
                }`}
              >
                <span
                  className={`mb-2 flex h-14 w-14 items-center justify-center rounded-full shadow-sm ${
                    selfieError ? "bg-error-container text-error" : "bg-secondary-container text-on-secondary-container"
                  }`}
                >
                  <Icon name={preparing ? "progress_activity" : selfieError ? "face" : "photo_camera"} className={`text-[28px] ${preparing ? "animate-spin" : ""}`} />
                </span>
                <span className="font-serif text-headline-sm text-on-surface">{selfieError ? "Take selfie again" : "Take a selfie"}</span>
                <span className={`mt-0.5 max-w-60 text-body-sm ${selfieError ? "font-semibold text-on-error-container" : "text-on-surface-variant"}`} role={selfieError ? "alert" : undefined}>
                  {selfieError ?? "Just you, face the camera, good light"}
                </span>
              </button>
            )}
          </div>

          <label className="mt-1 flex cursor-pointer select-none items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#5B1E2C]"
            />
            <span className="text-body-sm leading-snug text-on-surface">{CONSENT}</span>
          </label>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg bg-error-container px-3.5 py-3 text-body-sm text-on-error-container">
            <Icon name="error" filled className="mt-0.5 text-[18px]" />
            {error}
          </div>
        )}

        <div className="sticky bottom-0 mt-auto w-full bg-surface/95 pb-3 pt-2 backdrop-blur-md">
          <button
            type="submit"
            disabled={!ready}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#5B1E2C] px-4 text-[1.0625rem] font-semibold text-white shadow-md transition-all hover:bg-primary-container active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            <Icon name="search" className="text-[20px]" />
            Find my photos
          </button>
          <p className="mt-2 text-center text-[11px] font-medium text-on-surface-variant">Your selfie is only used to find you in this event's photos.</p>
        </div>
      </form>
      <PoweredBy />
    </main>
  );
}
