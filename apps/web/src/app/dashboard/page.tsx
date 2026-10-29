"use client";

import Link from "next/link";
import type { DashboardSummary, PhotographerEvent } from "@instantphotos/core";
import { useApi } from "@/lib/api";
import { Card, EmptyState, ErrorState, Icon, PageHeading, Skeleton, StatCard, fmtDate, fmtNumber, ghostBtn, primaryBtn } from "@/components/admin/ui";
import { EventStatusBadge, PhotoThumb, fmtBytes } from "@/components/studio/ui";

// P01: Photographer dashboard.

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const today = () => new Date().toISOString().slice(0, 10);

function EventRow({ e }: { e: PhotographerEvent }) {
  const pct = e.stats.photos ? Math.round((e.stats.ready / e.stats.photos) * 100) : 0;
  return (
    <article className="flex flex-col gap-4 p-4 transition-colors hover:bg-surface-low sm:flex-row sm:p-5">
      <Link href={`/dashboard/events/${e.id}`} className="relative block h-40 shrink-0 overflow-hidden rounded-lg sm:h-32 sm:w-48">
        <PhotoThumb src={e.coverUrl} alt="" className="h-full w-full" />
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-inverse-surface/80 px-3 py-1.5 text-label-sm text-inverse-on-surface">
          <Icon name="photo_camera" className="text-[15px]" />
          {fmtNumber(e.stats.photos)} photos
        </span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/dashboard/events/${e.id}`} className="min-w-0">
            <h3 className="truncate font-serif text-headline-sm font-medium text-primary hover:underline">{e.name}</h3>
          </Link>
          <EventStatusBadge status={e.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-1">
            <Icon name="calendar_month" className="text-[16px]" />
            {fmtDate(e.eventDate)}
          </span>
          {e.venue && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Icon name="location_on" className="text-[16px]" />
              <span className="truncate">{e.venue}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Icon name="groups" className="text-[16px]" />
            {fmtNumber(e.stats.guests)} guests
          </span>
        </p>
        {e.stats.photos > 0 && (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-high" aria-hidden="true">
              <div className="h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-label-sm text-on-surface-variant">{pct}% processed</span>
          </div>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Link href={`/dashboard/events/${e.id}`} className={`${primaryBtn} px-3 py-2`}>
            <Icon name="open_in_new" className="text-[18px]" />
            Open event
          </Link>
          <Link href={`/dashboard/events/${e.id}?tab=upload`} className={`${ghostBtn} bg-surface-container px-3 py-2`}>
            <Icon name="upload" className="text-[18px]" />
            Upload photos
          </Link>
          <Link href={`/dashboard/events/${e.id}?tab=qr`} className={`${ghostBtn} bg-surface-container px-3 py-2`}>
            <Icon name="qr_code_2" className="text-[18px]" />
            QR code
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useApi<DashboardSummary>("/me/dashboard");
  const me = useApi<{ profile: { displayName: string; name: string } }>("/me/profile");
  const first = (me.data?.profile.displayName || me.data?.profile.name || "").split(/\s+/)[0];

  const t = data?.totals;
  const upcoming = data?.events
    .filter((e) => e.status === "active" && e.eventDate >= today())
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
  const recent = data?.events.slice(0, 4) ?? [];

  return (
    <>
      <PageHeading
        title={first ? `${greeting()}, ${first}` : greeting()}
        description="Your events, uploads and guests at a glance."
        actions={
          <Link href="/dashboard/events/new" className={primaryBtn}>
            <Icon name="add" className="text-[20px]" />
            Create new event
          </Link>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total events"
              icon="auto_stories"
              value={t ? fmtNumber(t.events) : null}
              note={t ? `${t.activeEvents} active · ${t.events - t.activeEvents} archived` : undefined}
            />
            <StatCard
              label="Active events"
              icon="camera_outdoor"
              value={t ? fmtNumber(t.activeEvents) : null}
              note={t ? (upcoming ? `Next: ${upcoming.name}, ${fmtDate(upcoming.eventDate)}` : "No upcoming events") : undefined}
            />
            <StatCard
              label="Photos"
              icon="collections"
              value={t ? fmtNumber(t.photos) : null}
              note={t ? (t.processing ? `${fmtNumber(t.processing)} still processing` : "All photos processed") : undefined}
            />
            <StatCard
              label="Guests"
              icon="groups"
              value={t ? fmtNumber(t.guests) : null}
              note={t ? "Registered with a selfie" : undefined}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <div className="flex items-end justify-between gap-4 border-b border-outline/60 px-5 py-4">
                <div>
                  <h2 className="font-serif text-headline-sm font-medium text-primary">Recent events</h2>
                  <p className="text-body-sm text-on-surface-variant">Upload progress and guests for your latest events.</p>
                </div>
                {data && data.events.length > 0 && (
                  <Link href="/dashboard/events" className="inline-flex shrink-0 items-center gap-1 text-label-md text-primary hover:underline">
                    View all ({data.events.length})
                    <Icon name="arrow_forward" className="text-[18px]" />
                  </Link>
                )}
              </div>
              {loading ? (
                <Skeleton rows={3} />
              ) : recent.length === 0 ? (
                <EmptyState
                  icon="add_photo_alternate"
                  title="No events yet"
                  text="Create your first event, upload the photos and share its QR code so guests can find themselves."
                  action={
                    <Link href="/dashboard/events/new" className={primaryBtn}>
                      <Icon name="add" className="text-[20px]" />
                      Create new event
                    </Link>
                  }
                />
              ) : (
                <div className="divide-y divide-outline/60">
                  {recent.map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-4 p-5 lg:col-span-4">
              <div className="flex items-center gap-2">
                <Icon name="cloud" className="text-[22px] text-secondary" />
                <h2 className="font-serif text-headline-sm font-medium text-primary">Storage used</h2>
              </div>
              {t ? (
                <>
                  <p className="font-serif text-headline-md font-semibold text-primary">{fmtBytes(t.storageBytes)}</p>
                  <p className="text-body-sm text-on-surface-variant">
                    Original photos across your {t.events === 1 ? "event" : `${t.events} events`}. Web copies and thumbnails are made
                    from these and are not counted here.
                  </p>
                </>
              ) : (
                <div className="h-8 w-28 animate-pulse rounded bg-surface-container" />
              )}
              <div className="h-px bg-outline/60" />
              <div className="flex flex-col gap-2">
                <Link href="/dashboard/events/new" className={`${ghostBtn} justify-start bg-surface-container`}>
                  <Icon name="add_circle" className="text-[20px] text-secondary" />
                  Create new event
                </Link>
                <Link href="/dashboard/profile" className={`${ghostBtn} justify-start bg-surface-container`}>
                  <Icon name="palette" className="text-[20px] text-secondary" />
                  Update branding
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
