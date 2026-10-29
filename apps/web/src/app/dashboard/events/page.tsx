"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotographerEvent } from "@instantphotos/core";
import { api, useApi } from "@/lib/api";
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeading,
  Skeleton,
  fmtDate,
  fmtNumber,
  ghostBtn,
  primaryBtn,
  useToast,
} from "@/components/admin/ui";
import { DeleteEventModal } from "@/components/studio/delete-event-modal";
import { EventStatusBadge, PhotoThumb } from "@/components/studio/ui";

// P02: All events.

const selectClass =
  "h-10 appearance-none rounded-lg bg-surface-low pl-3.5 pr-9 text-label-md outline-none ring-1 ring-outline focus:ring-2 focus:ring-primary";
const PAGE = 12;

type Sort = "date_desc" | "date_asc" | "photos" | "name";
const SORTS: Record<Sort, { label: string; fn: (a: PhotographerEvent, b: PhotographerEvent) => number }> = {
  date_desc: { label: "Event date (newest)", fn: (a, b) => b.eventDate.localeCompare(a.eventDate) },
  date_asc: { label: "Event date (oldest)", fn: (a, b) => a.eventDate.localeCompare(b.eventDate) },
  photos: { label: "Most photos", fn: (a, b) => b.stats.photos - a.stats.photos },
  name: { label: "Name (A–Z)", fn: (a, b) => a.name.localeCompare(b.name) },
};

function CardMenu({ event, onArchive, onDelete }: { event: PhotographerEvent; onArchive: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const item = "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-label-md transition-colors hover:bg-surface-container";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Options for ${event.name}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-lowest/90 text-on-surface shadow-sm hover:bg-surface-lowest"
      >
        <Icon name="more_vert" className="text-[20px]" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl bg-surface-lowest py-1 shadow-xl ring-1 ring-outline">
          <Link role="menuitem" href={`/dashboard/events/${event.id}`} className={item}>
            <Icon name="open_in_new" className="text-[18px] text-secondary" />
            Open event
          </Link>
          <button role="menuitem" type="button" className={item} onClick={() => (setOpen(false), onArchive())}>
            <Icon name={event.status === "active" ? "inventory_2" : "unarchive"} className="text-[18px] text-secondary" />
            {event.status === "active" ? "Archive event" : "Make active again"}
          </button>
          <button role="menuitem" type="button" className={`${item} text-error hover:bg-error-container/40`} onClick={() => (setOpen(false), onDelete())}>
            <Icon name="delete" className="text-[18px]" />
            Delete event
          </button>
        </div>
      )}
    </div>
  );
}

function EventCard({ e, onArchive, onDelete }: { e: PhotographerEvent; onArchive: () => void; onDelete: () => void }) {
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative h-48">
        <PhotoThumb src={e.coverUrl} alt="" className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/20 to-transparent" />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <EventStatusBadge status={e.status} />
          <CardMenu event={e} onArchive={onArchive} onDelete={onDelete} />
        </div>
        <Link href={`/dashboard/events/${e.id}`} className="absolute inset-x-4 bottom-3">
          <h2 className="line-clamp-2 font-serif text-headline-sm font-medium text-inverse-on-surface">{e.name}</h2>
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1 text-body-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="calendar_today" className="text-[16px]" />
            {fmtDate(e.eventDate)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Icon name="location_on" className="text-[16px]" />
            <span className="truncate">{e.venue || "No venue added"}</span>
          </span>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-outline/60 rounded-lg bg-surface-container py-2 text-center">
          {[
            ["Photos", e.stats.photos],
            ["Guests", e.stats.guests],
            ["Matched", e.stats.matchedGuests],
          ].map(([label, n]) => (
            <div key={label} className="flex flex-col">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">{label}</dt>
              <dd className="text-label-md font-semibold text-on-surface">{fmtNumber(Number(n))}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex gap-2">
          <Link href={`/dashboard/events/${e.id}`} className={`${primaryBtn} flex-1 py-2`}>
            Open event
          </Link>
          <Link href={`/dashboard/events/${e.id}?tab=qr`} className={`${ghostBtn} bg-surface-container py-2`} title="QR code">
            <Icon name="qr_code_2" className="text-[20px]" />
            QR
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function EventsPage() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<{ events: PhotographerEvent[] }>("/events");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>("date_desc");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<PhotographerEvent | null>(null);
  const [busy, setBusy] = useState(false);

  const all = data?.events ?? [];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((e) => (status === "all" || e.status === status) && (!q || [e.name, e.venue, e.eventDate].some((v) => v.toLowerCase().includes(q))))
      .sort(SORTS[sort].fn);
  }, [all, query, status, sort]);
  useEffect(() => setPage(1), [query, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const filtersActive = Boolean(query) || status !== "all" || sort !== "date_desc";
  const reset = () => {
    setQuery("");
    setStatus("all");
    setSort("date_desc");
  };

  const replace = (ev: PhotographerEvent) => setData((d) => (d ? { events: d.events.map((x) => (x.id === ev.id ? ev : x)) } : d));

  async function toggleArchive(e: PhotographerEvent) {
    const next = e.status === "active" ? "archived" : "active";
    try {
      const res = await api<{ event: PhotographerEvent }>(`/events/${e.id}`, { method: "PATCH", json: { status: next } });
      replace(res.event);
      toast(next === "archived" ? `"${e.name}" archived. New guests can no longer register.` : `"${e.name}" is active again.`);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/events/${toDelete.id}`, { method: "DELETE" });
      setData((d) => (d ? { events: d.events.filter((x) => x.id !== toDelete.id) } : d));
      toast(`"${toDelete.name}" deleted.`);
      setToDelete(null);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Events"
        description="All your events. Open one to upload photos, see guests and download its QR code."
        actions={
          <Link href="/dashboard/events/new" className={primaryBtn}>
            <Icon name="add" className="text-[20px]" />
            Create new event
          </Link>
        }
      />

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by event name, venue or date..."
              aria-label="Search events"
              className="h-10 w-full rounded-lg bg-surface-low pl-10 pr-4 text-body-sm outline-none ring-1 ring-outline focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="relative">
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} w-full md:w-40`}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
          </div>
          <div className="relative">
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClass} w-full md:w-52`}>
              {(Object.keys(SORTS) as Sort[]).map((k) => (
                <option key={k} value={k}>
                  Sort: {SORTS[k].label}
                </option>
              ))}
            </select>
            <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={!filtersActive}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-label-md text-white shadow-sm transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="restart_alt" className="text-[18px]" />
            Reset filters
          </button>
        </div>
      </Card>

      {loading ? (
        <Card>
          <Skeleton />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon="event"
            title="No events yet"
            text="Create an event, upload its photos and share the QR code with guests."
            action={
              <Link href="/dashboard/events/new" className={primaryBtn}>
                <Icon name="add" className="text-[20px]" />
                Create new event
              </Link>
            }
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="event_busy"
            title="No events found"
            text="No events match your search or filters."
            action={
              <button type="button" className={ghostBtn} onClick={reset}>
                Clear filters
              </button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((e) => (
              <EventCard key={e.id} e={e} onArchive={() => toggleArchive(e)} onDelete={() => setToDelete(e)} />
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-label-sm text-on-surface-variant">
              Showing <strong className="text-on-surface">{(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)}</strong> of{" "}
              <strong className="text-on-surface">{rows.length}</strong> events
            </p>
            {pages > 1 && (
              <nav aria-label="Pages" className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-low ring-1 ring-outline/60 disabled:opacity-40"
                >
                  <Icon name="chevron_left" className="text-[20px]" />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => setPage(n)}
                    className={`h-9 w-9 rounded-lg text-label-md ${n === page ? "bg-primary text-white" : "bg-surface-low ring-1 ring-outline/60 hover:bg-surface-container"}`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page === pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-low ring-1 ring-outline/60 disabled:opacity-40"
                >
                  <Icon name="chevron_right" className="text-[20px]" />
                </button>
              </nav>
            )}
          </div>
        </>
      )}

      <DeleteEventModal event={toDelete} busy={busy} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
    </>
  );
}
