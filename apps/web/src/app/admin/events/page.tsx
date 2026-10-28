"use client";

import { useMemo, useState } from "react";
import type { AdminEventRow } from "@instantphotos/core";
import { useApi } from "@/lib/api";
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeading,
  Skeleton,
  StatusBadge,
  fmtDate,
  fmtNumber,
  ghostBtn,
} from "@/components/admin/ui";

const selectClass =
  "h-10 appearance-none rounded-lg bg-surface-low pl-3.5 pr-9 text-label-md outline-none ring-1 ring-outline focus:ring-2 focus:ring-primary";

function daysLeft(iso: string) {
  const end = new Date(`${iso}T23:59:59`).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export default function EventsPage() {
  const { data, error, loading, reload } = useApi<{ events: AdminEventRow[] }>("/admin/events");
  const [query, setQuery] = useState("");
  const [studio, setStudio] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const all = data?.events ?? [];
  const studios = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach((e) => map.set(e.photographerId, e.studioName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (e) =>
        (studio === "all" || e.photographerId === studio) &&
        (status === "all" || e.status === status) &&
        (!from || e.eventDate >= from) &&
        (!to || e.eventDate <= to) &&
        (!q || [e.name, e.venue, e.code, e.studioName].some((v) => v.toLowerCase().includes(q))),
    );
  }, [all, query, studio, status, from, to]);

  const filtersActive = query || studio !== "all" || status !== "all" || from || to;
  const reset = () => {
    setQuery("");
    setStudio("all");
    setStatus("all");
    setFrom("");
    setTo("");
  };

  return (
    <>
      <PageHeading
        eyebrow="Read-only"
        title="Events"
        description="Every event across all photographers, so you can monitor storage and activity."
      />

      <div className="flex items-start gap-4 rounded-xl bg-surface-high px-5 py-4 shadow-sm">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/15">
          <Icon name="policy" filled className="text-[22px] text-secondary" />
        </div>
        <p className="text-body-sm leading-relaxed text-on-surface-variant">
          <strong className="text-on-surface">Strictly read-only.</strong> Super Admins can view all events to monitor storage and usage.
          Creating events, uploading photos and editing galleries can only be done by photographers from their own accounts.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-outline/60 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by event, venue or code..."
                aria-label="Search events"
                className="h-10 w-full rounded-lg bg-surface-low pl-10 pr-4 text-body-sm outline-none ring-1 ring-outline focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="relative">
              <select aria-label="Photographer" value={studio} onChange={(e) => setStudio(e.target.value)} className={`${selectClass} w-full md:w-60`}>
                <option value="all">All photographers</option>
                {studios.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
            </div>
            <div className="relative">
              <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} w-full md:w-40`}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                Event date from
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={`${selectClass} pr-3`} />
              </label>
              <label className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                to
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={`${selectClass} pr-3`} />
              </label>
            </div>
            {!loading && !error && (
              <p className="text-label-sm text-on-surface-variant">
                Showing {rows.length} of {all.length} events
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <Skeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="event_busy"
            title="No events found"
            text="No events match your current filters. Adjust the search or clear the filters."
            action={
              filtersActive ? (
                <button type="button" className={ghostBtn} onClick={reset}>Clear filters</button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-body-sm">
              <thead>
                <tr className="bg-surface-high/60 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="py-3.5 pl-6 pr-4">Event</th>
                  <th scope="col" className="px-4 py-3.5">Photographer</th>
                  <th scope="col" className="px-4 py-3.5">Date</th>
                  <th scope="col" className="px-4 py-3.5">Venue</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Photos</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Guests</th>
                  <th scope="col" className="px-4 py-3.5">Gallery expiry</th>
                  <th scope="col" className="py-3.5 pl-4 pr-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/50">
                {rows.map((e) => {
                  const left = daysLeft(e.galleryExpiresAt);
                  const expired = left < 0;
                  return (
                    <tr key={e.id} className={`transition-colors hover:bg-surface-low ${e.status === "archived" ? "opacity-85" : ""}`}>
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex flex-col whitespace-nowrap">
                          <span className="text-label-md font-bold">{e.name}</span>
                          <span className="text-label-sm font-normal text-on-surface-variant">{e.code}</span>
                        </div>
                      </td>
                      <td className="max-w-[180px] px-4 py-4 font-medium">{e.studioName}</td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-on-surface-variant">{fmtDate(e.eventDate)}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1.5">
                          <Icon name="location_on" className="text-[16px] text-secondary" />
                          <span className="max-w-[170px] truncate" title={e.venue}>{e.venue}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold">{fmtNumber(e.photos)}</td>
                      <td className="px-4 py-4 text-right text-on-surface-variant">{fmtNumber(e.guests)}</td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className={`flex items-start gap-1.5 ${expired ? "text-on-surface-variant" : "text-tertiary"}`}>
                          <Icon name={expired ? "event_busy" : "timer"} className="mt-0.5 text-[15px]" />
                          <div className="flex flex-col">
                            <span className="font-medium">{fmtDate(e.galleryExpiresAt)}</span>
                            <span className="text-label-sm font-normal text-on-surface-variant">{expired ? "Expired" : `${left}d left`}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pl-4 pr-6 text-center">
                        <StatusBadge tone={e.status}>{e.status === "active" ? "Active" : "Archived"}</StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
