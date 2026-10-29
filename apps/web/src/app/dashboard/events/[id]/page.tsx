"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { PhotographerEvent, PhotographerProfile } from "@instantphotos/core";
import { useApi } from "@/lib/api";
import { qrDataUrl } from "@/lib/qr-card";
import { Uploader } from "@/lib/uploader";
import { Card, ErrorState, Icon, Skeleton, fmtDate, fmtNumber } from "@/components/admin/ui";
import { GalleryTab } from "@/components/studio/event/gallery";
import { GuestsTab } from "@/components/studio/event/guests";
import { QrTab } from "@/components/studio/event/qr";
import { SettingsTab } from "@/components/studio/event/settings";
import { UploadTab } from "@/components/studio/event/upload";
import { EventStatusBadge } from "@/components/studio/ui";

// P04: Event workspace with tabs (EVT-7, UPL-*, PHG-*, EVT-3, EVT-4..6).

const TABS = [
  { key: "gallery", label: "Gallery", icon: "collections" },
  { key: "upload", label: "Upload photos", icon: "upload_file" },
  { key: "guests", label: "Guests", icon: "groups" },
  { key: "qr", label: "QR code", icon: "qr_code" },
  { key: "settings", label: "Settings", icon: "settings" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 1000) / 10}%` : "—");

function Workspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = (TABS.some((t) => t.key === search.get("tab")) ? search.get("tab") : "gallery") as Tab;
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false });

  const { data, error, loading, reload, setData } = useApi<{ event: PhotographerEvent }>(`/events/${id}`);
  const profile = useApi<{ profile: PhotographerProfile }>("/me/profile");
  const event = data?.event;

  // Gallery refreshes when uploads are confirmed; the header numbers refresh with it.
  const [galleryVersion, setGalleryVersion] = useState(0);
  const uploader = useRef<Uploader | null>(null);
  if (!uploader.current) {
    uploader.current = new Uploader(id, () => {
      setGalleryVersion((v) => v + 1);
      reload();
    });
  }

  // Warn before leaving the page while files are still uploading.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (uploader.current?.running) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (event) qrDataUrl(event.publicUrl, 160).then(setQr);
  }, [event?.publicUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !event) {
    return (
      <Card>
        <Skeleton rows={4} />
      </Card>
    );
  }
  if (error || !event) {
    return (
      <Card>
        <ErrorState message={error ?? "Event not found."} onRetry={reload} />
      </Card>
    );
  }

  const s = event.stats;
  const tiles = [
    { label: "Total photos", value: fmtNumber(s.photos), note: s.failed ? `${fmtNumber(s.failed)} need attention` : "uploaded", tone: "text-primary" },
    { label: "Processed", value: fmtNumber(s.ready), note: pct(s.ready, s.photos), tone: "text-secondary" },
    { label: "Guests", value: fmtNumber(s.guests), note: "registered", tone: "text-primary" },
    { label: "With matches", value: fmtNumber(s.matchedGuests), note: s.guests ? `${pct(s.matchedGuests, s.guests)} of guests` : "no guests yet", tone: "text-tertiary" },
  ];

  return (
    <>
      <nav aria-label="Breadcrumb" className="-mb-2 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
        <Link href="/dashboard/events" className="hover:text-primary">
          Events
        </Link>
        <Icon name="chevron_right" className="text-[16px]" />
        <span className="max-w-[60vw] truncate font-semibold text-on-surface">{event.name}</span>
      </nav>

      <section className="relative overflow-hidden rounded-2xl bg-surface-low p-6 shadow-sm ring-1 ring-outline/60 lg:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-on-surface-variant">
              <EventStatusBadge status={event.status} />
              <span className="inline-flex items-center gap-1">
                <Icon name="calendar_today" className="text-[16px]" />
                {fmtDate(event.eventDate)}
              </span>
              {event.venue && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="location_on" className="text-[16px]" />
                  {event.venue}
                </span>
              )}
            </div>
            <h1 className="font-serif text-headline-lg font-medium tracking-tight text-primary">{event.name}</h1>
            <p className="text-body-sm text-on-surface-variant">
              {profile.data?.profile.studioName ? `${profile.data.profile.studioName} · ` : ""}Gallery open until {fmtDate(event.galleryExpiresAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTab("qr")}
            className="flex shrink-0 items-center gap-3 self-start rounded-xl bg-surface-lowest p-2 pr-4 shadow-sm ring-1 ring-outline/60 transition-shadow hover:shadow-md"
            title="Open the QR code"
          >
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="" className="h-14 w-14 rounded-md" />
            ) : (
              <div className="h-14 w-14 animate-pulse rounded-md bg-surface-container" />
            )}
            <span className="text-left text-label-sm text-on-surface-variant">
              <span className="block font-semibold text-on-surface">Event QR</span>
              Print or share
            </span>
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-surface-lowest/90 p-4 ring-1 ring-outline/50">
              <p className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">{t.label}</p>
              <p className={`mt-1 font-serif text-headline-md font-semibold ${t.tone}`}>
                {t.value}
                <span className="ml-1.5 font-sans text-label-sm font-medium text-on-surface-variant">{t.note}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Event sections" className="inline-flex gap-1 rounded-xl bg-surface-high/60 p-1.5 shadow-inner">
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = t.key === "gallery" ? s.photos : t.key === "guests" ? s.guests : null;
            return (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-label-md transition-colors ${
                  active ? "bg-surface-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name={t.icon} className="text-[18px]" filled={active} />
                {t.label}
                {count !== null && count > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{fmtNumber(count)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {tab === "gallery" && <GalleryTab event={event} version={galleryVersion} onChanged={reload} goUpload={() => setTab("upload")} />}
        {tab === "upload" && <UploadTab event={event} uploader={uploader.current} goGallery={() => setTab("gallery")} />}
        {tab === "guests" && <GuestsTab event={event} goQr={() => setTab("qr")} />}
        {tab === "qr" && <QrTab event={event} studioName={profile.data?.profile.studioName ?? ""} />}
        {tab === "settings" && <SettingsTab event={event} onSaved={(ev) => setData({ event: ev })} />}
      </div>
    </>
  );
}

export default function EventPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <Skeleton rows={4} />
        </Card>
      }
    >
      <Workspace />
    </Suspense>
  );
}
