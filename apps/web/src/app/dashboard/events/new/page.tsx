"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PhotographerEvent } from "@instantphotos/core";
import { api } from "@/lib/api";
import { Alert, Card, Icon, fmtDate, ghostBtn, inputClass, labelClass, primaryBtn, useToast } from "@/components/admin/ui";

// P03: Create new event (full page, as designed). Only the fields the product uses: name, date, venue, gallery expiry (EVT-1, EVT-4).

const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const todayIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

type Field = "name" | "eventDate" | "galleryExpiresAt";

export default function NewEventPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState(todayIso());
  const [venue, setVenue] = useState("");
  const [expiry, setExpiry] = useState(plusDays(todayIso(), 7));
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function changeDate(v: string) {
    setEventDate(v);
    // Keep the default (event date + 7 days) until the photographer picks their own expiry.
    if (!expiryTouched && v) setExpiry(plusDays(v, 7));
  }

  function validate() {
    const e: Partial<Record<Field, string>> = {};
    if (!name.trim()) e.name = "Give the event a name.";
    if (!eventDate) e.eventDate = "Choose the event date.";
    if (!expiry) e.galleryExpiresAt = "Choose until when guests can see their photos.";
    else if (eventDate && expiry < eventDate) e.galleryExpiresAt = "This can't be before the event date.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev?: React.FormEvent) {
    ev?.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await api<{ event: PhotographerEvent }>("/events", {
        method: "POST",
        json: { name, eventDate, venue, galleryExpiresAt: expiry },
      });
      toast(`"${res.event.name}" created. Add its photos next.`);
      router.push(`/dashboard/events/${res.event.id}?tab=upload`);
    } catch (e) {
      setFormError((e as Error).message);
      setSaving(false);
    }
  }

  const err = (f: Field) =>
    errors[f] && (
      <p id={`${f}-error`} className="text-body-sm text-error">
        {errors[f]}
      </p>
    );
  const fieldClass = (f: Field) => `${inputClass} h-12 ${errors[f] ? "ring-2 ring-error" : ""}`;

  const saveButton = (big = false) => (
    <button type="submit" form="new-event" disabled={saving} className={`${primaryBtn} ${big ? "px-6 py-3" : ""}`}>
      {saving ? (
        <>
          <Icon name="progress_activity" className="animate-spin text-[20px]" />
          Creating...
        </>
      ) : (
        <>
          <Icon name="add_circle" className="text-[20px]" />
          Create event
        </>
      )}
    </button>
  );

  return (
    <>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            <Icon name="calendar_month" className="text-[16px]" />
            <Link href="/dashboard/events" className="hover:text-primary">
              Events
            </Link>
            <Icon name="chevron_right" className="text-[16px]" />
            <span className="text-primary">Create new event</span>
          </nav>
          <h1 className="font-serif text-headline-lg font-medium tracking-tight text-primary">Create new event</h1>
          <p className="max-w-2xl text-body-md text-on-surface-variant">
            Add the basics. You can change them any time from the event&apos;s settings.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/events" className={`${ghostBtn} bg-surface-container`}>
            <Icon name="close" className="text-[20px]" />
            Cancel
          </Link>
          {saveButton()}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <form id="new-event" onSubmit={submit} noValidate className="flex flex-col gap-6 lg:col-span-8">
          <Card className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                <Icon name="event_note" className="text-[22px]" />
              </div>
              <div>
                <h2 className="font-serif text-headline-sm font-medium text-on-surface">Event basics</h2>
                <p className="text-body-sm text-on-surface-variant">Name, date and place, as guests will see them.</p>
              </div>
            </div>

            {formError && <Alert tone="error">{formError}</Alert>}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className={labelClass}>
                Event name <span className="text-error">*</span>
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Aarav & Ananya Wedding"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={fieldClass("name")}
                autoFocus
              />
              {err("name")}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="eventDate" className={labelClass}>
                  Event date <span className="text-error">*</span>
                </label>
                <input
                  id="eventDate"
                  type="date"
                  value={eventDate}
                  onChange={(e) => changeDate(e.target.value)}
                  aria-invalid={Boolean(errors.eventDate)}
                  aria-describedby={errors.eventDate ? "eventDate-error" : undefined}
                  className={fieldClass("eventDate")}
                />
                {err("eventDate")}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="expiry" className={labelClass}>
                    Gallery expiry date <span className="text-error">*</span>
                  </label>
                  {!expiryTouched && (
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-semibold text-on-secondary-container">
                      +7 days default
                    </span>
                  )}
                </div>
                <input
                  id="expiry"
                  type="date"
                  value={expiry}
                  min={eventDate || undefined}
                  onChange={(e) => {
                    setExpiry(e.target.value);
                    setExpiryTouched(true);
                  }}
                  aria-invalid={Boolean(errors.galleryExpiresAt)}
                  aria-describedby={errors.galleryExpiresAt ? "galleryExpiresAt-error" : "expiry-help"}
                  className={fieldClass("galleryExpiresAt")}
                />
                {err("galleryExpiresAt") || (
                  <p id="expiry-help" className="text-body-sm text-on-surface-variant">
                    Guests can view their photos until this date.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="venue" className={labelClass}>
                Venue <span className="font-normal text-on-surface-variant">(optional)</span>
              </label>
              <div className="relative">
                <Icon name="location_on" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
                <input
                  id="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Umaid Bhawan Palace, Jodhpur"
                  className={`${inputClass} h-12 pl-11`}
                />
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard/events" className={ghostBtn}>
              <Icon name="close" className="text-[20px]" />
              Cancel
            </Link>
            {saveButton(true)}
          </div>
        </form>

        <aside className="lg:col-span-4">
          <Card className="sticky top-24 flex flex-col gap-4 p-5">
            <p className="flex items-center gap-2 text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              <Icon name="visibility" className="text-[18px]" />
              Preview
            </p>
            <div className="relative flex h-44 flex-col justify-end overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-container p-4">
              <Icon name="photo_camera" className="absolute right-4 top-4 text-[28px] text-white/30" />
              <p className="line-clamp-2 font-serif text-headline-sm font-medium text-white">{name.trim() || "Your event name"}</p>
              <p className="mt-1 flex items-center gap-1 truncate text-body-sm text-white/80">
                <Icon name="location_on" className="text-[16px]" />
                {venue.trim() || "Venue"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-container p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">Date</p>
                <p className="text-label-md font-semibold">{eventDate ? fmtDate(eventDate) : "—"}</p>
              </div>
              <div className="rounded-lg bg-surface-container p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">Gallery until</p>
                <p className="text-label-md font-semibold">{expiry ? fmtDate(expiry) : "—"}</p>
              </div>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              After you create it, the event gets its own QR code. Guests scan it, take a selfie and see the photos they appear in.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
