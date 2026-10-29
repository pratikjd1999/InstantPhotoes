"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PhotographerEvent } from "@instantphotos/core";
import { api } from "@/lib/api";
import { Alert, Card, Icon, ghostBtn, inputClass, labelClass, useToast } from "@/components/admin/ui";
import { DeleteEventModal } from "@/components/studio/delete-event-modal";

// EVT-1, EVT-4, EVT-5, EVT-6: edit details, gallery expiry, active/archived, delete.

export function SettingsTab({ event, onSaved }: { event: PhotographerEvent; onSaved: (e: PhotographerEvent) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(event.name);
  const [eventDate, setEventDate] = useState(event.eventDate);
  const [venue, setVenue] = useState(event.venue);
  const [expiry, setExpiry] = useState(event.galleryExpiresAt);
  const [active, setActive] = useState(event.status === "active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const dirty =
    name !== event.name || eventDate !== event.eventDate || venue !== event.venue || expiry !== event.galleryExpiresAt || active !== (event.status === "active");

  const reset = () => {
    setName(event.name);
    setEventDate(event.eventDate);
    setVenue(event.venue);
    setExpiry(event.galleryExpiresAt);
    setActive(event.status === "active");
    setError(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Event name is required.");
    if (expiry < eventDate) return setError("Gallery expiry can't be before the event date.");
    setSaving(true);
    try {
      const res = await api<{ event: PhotographerEvent }>(`/events/${event.id}`, {
        method: "PATCH",
        json: { name, eventDate, venue, galleryExpiresAt: expiry, status: active ? "active" : "archived" },
      });
      onSaved(res.event);
      toast("Event settings saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await api(`/events/${event.id}`, { method: "DELETE" });
      toast(`"${event.name}" deleted.`);
      router.push("/dashboard/events");
    } catch (err) {
      toast((err as Error).message, "error");
      setDeleting(false);
    }
  }

  const label = (icon: string, text: string, htmlFor: string) => (
    <label htmlFor={htmlFor} className={`${labelClass} flex items-center gap-1.5`}>
      <Icon name={icon} className="text-[18px] text-secondary" />
      {text}
    </label>
  );

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Card className="p-6 lg:p-8">
        <form onSubmit={save} className="flex flex-col gap-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-serif text-headline-md font-medium text-on-surface">Event settings</h2>
              <p className="text-body-sm text-on-surface-variant">Update the event details, how long the gallery stays open, and whether guests can still register.</p>
            </div>
          </div>
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              {label("celebration", "Event name", "s-name")}
              <input id="s-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              {label("calendar_today", "Event date", "s-date")}
              <input id="s-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              {label("event_available", "Gallery expiry date", "s-expiry")}
              <input id="s-expiry" type="date" value={expiry} min={eventDate} onChange={(e) => setExpiry(e.target.value)} className={inputClass} />
              <p className="text-body-sm text-on-surface-variant">Guests can view their photos until this date.</p>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              {label("pin_drop", "Venue", "s-venue")}
              <input id="s-venue" value={venue} maxLength={200} onChange={(e) => setVenue(e.target.value)} placeholder="Optional" className={inputClass} />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-low p-4 ring-1 ring-outline/60 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Icon name="toggle_on" className="mt-0.5 text-[22px] text-secondary" />
              <div>
                <p className="text-label-md font-semibold text-on-surface">Event status</p>
                <p className="text-body-sm text-on-surface-variant">Archived events don&apos;t accept new guest registrations. Existing guests keep their galleries.</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              onClick={() => setActive((a) => !a)}
              className="flex shrink-0 items-center gap-3 self-start sm:self-center"
            >
              <span className={`relative h-6 w-12 rounded-full transition-colors ${active ? "bg-tertiary" : "bg-surface-highest"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[26px]" : "left-0.5"}`} />
              </span>
              <span className="w-16 text-left text-label-md font-semibold">{active ? "Active" : "Archived"}</span>
            </button>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className={ghostBtn} onClick={reset} disabled={!dirty || saving}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-label-md text-white shadow-sm transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name={saving ? "progress_activity" : "check"} className={`text-[20px] ${saving ? "animate-spin" : ""}`} />
              {saving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>
      </Card>

      <Card className="flex flex-col justify-between gap-4 p-6 ring-error/30 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-serif text-headline-sm font-medium text-error">Delete event</h3>
          <p className="text-body-sm text-on-surface-variant">Hides the event, its photos and its guests everywhere. The QR code and guest links stop working.</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-error-container px-4 py-2.5 text-label-md text-error hover:bg-error-container/70"
        >
          <Icon name="delete" className="text-[18px]" />
          Delete event
        </button>
      </Card>

      <DeleteEventModal event={confirm ? event : null} busy={deleting} onCancel={() => setConfirm(false)} onConfirm={remove} />
    </div>
  );
}
