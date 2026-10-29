"use client";

import { useMemo, useState } from "react";
import type { EventGuest, PhotoItem, PhotographerEvent } from "@instantphotos/core";
import { useApi } from "@/lib/api";
import { downloadOriginals } from "@/lib/originals";
import { Card, EmptyState, ErrorState, Icon, Initials, Modal, Skeleton, fmtNumber, primaryBtn, useToast } from "@/components/admin/ui";
import { PhotoThumb, fmtDateTime } from "@/components/studio/ui";

// PHG-1/2: guests with their full phone number and matched photos.

function GuestPhotos({ event, guest, onClose }: { event: PhotographerEvent; guest: EventGuest; onClose: () => void }) {
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ guest: EventGuest; photos: PhotoItem[] }>(`/events/${event.id}/guests/${guest.id}/photos`);
  const [busy, setBusy] = useState(false);
  const photos = data?.photos ?? [];

  async function download() {
    setBusy(true);
    try {
      await downloadOriginals(event.id, photos.map((p) => p.id), `${guest.name} - ${event.name}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} icon="person" title={guest.name} description={`${fmtNumber(guest.matchedPhotos)} matched photos · ${guest.phone}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">Matched photos</p>
          <button type="button" className={`${primaryBtn} py-2`} onClick={download} disabled={busy || photos.length === 0}>
            <Icon name={busy ? "progress_activity" : "download"} className={`text-[18px] ${busy ? "animate-spin" : ""}`} />
            {busy ? "Preparing..." : "Download originals"}
          </button>
        </div>
        {loading && !data ? (
          <Skeleton rows={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : (
          <div className="grid max-h-[55vh] grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <figure key={p.id} className="relative aspect-square overflow-hidden rounded-lg">
                <PhotoThumb src={p.thumbUrl} alt={p.filename} className="h-full w-full" />
                <figcaption className="absolute inset-x-0 bottom-0 truncate bg-inverse-surface/75 px-1.5 py-0.5 text-[11px] text-inverse-on-surface">
                  {p.filename}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function GuestsTab({ event, goQr }: { event: PhotographerEvent; goQr: () => void }) {
  const { data, error, loading, reload } = useApi<{ guests: EventGuest[] }>(`/events/${event.id}/guests`);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<EventGuest | null>(null);

  const all = data?.guests ?? [];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return all.filter((g) => !q || g.name.toLowerCase().includes(q) || (digits.length > 0 && g.phone.replace(/\D/g, "").includes(digits)));
  }, [all, query]);

  return (
    <Card>
      {all.length > 0 && (
        <div className="flex flex-col justify-between gap-3 border-b border-outline/60 p-4 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-md">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone..."
              aria-label="Search guests"
              className="h-10 w-full rounded-lg bg-surface-low pl-10 pr-4 text-body-sm outline-none ring-1 ring-outline focus:ring-2 focus:ring-primary"
            />
          </div>
          <p className="text-label-sm text-on-surface-variant">
            Showing {rows.length} of {all.length} guests
          </p>
        </div>
      )}
      {loading && !data ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : all.length === 0 ? (
        <EmptyState
          icon="qr_code_scanner"
          title="No guests yet"
          text="Share your event QR code so guests can find their photos. They scan it, take a quick selfie, and their matches appear."
          action={
            <button type="button" className={primaryBtn} onClick={goQr}>
              <Icon name="qr_code_2" className="text-[20px]" />
              Open QR code
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon="person_search" title="No guests found" text="No guest matches that name or number." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-body-sm">
            <thead>
              <tr className="bg-surface-high/60 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                <th scope="col" className="py-3.5 pl-6 pr-4">Guest name</th>
                <th scope="col" className="px-4 py-3.5">Phone number</th>
                <th scope="col" className="px-4 py-3.5">Registered at</th>
                <th scope="col" className="px-4 py-3.5">Matched photos</th>
                <th scope="col" className="py-3.5 pl-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/50">
              {rows.map((g) => (
                <tr key={g.id} className="transition-colors hover:bg-surface-low">
                  <td className="py-3 pl-6 pr-4">
                    <div className="flex items-center gap-3">
                      <Initials name={g.name} />
                      <span className="whitespace-nowrap text-label-md font-semibold text-on-surface">{g.name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{g.phone}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">{fmtDateTime(g.registeredAt)}</td>
                  <td className="px-4 py-3">
                    {g.matchedPhotos > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-container px-2.5 py-1 text-label-sm font-semibold text-on-tertiary-variant">
                        <Icon name="photo" className="text-[15px]" />
                        {fmtNumber(g.matchedPhotos)} photos
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-high px-2.5 py-1 text-label-sm font-semibold text-on-surface-variant">
                        <Icon name="hourglass_empty" className="text-[15px]" />
                        No matches yet
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-4 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() => setOpen(g)}
                      disabled={g.matchedPhotos === 0}
                      className="whitespace-nowrap rounded-lg bg-surface-high px-3 py-1.5 text-label-md text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-high disabled:hover:text-primary"
                    >
                      View photos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <GuestPhotos event={event} guest={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}
