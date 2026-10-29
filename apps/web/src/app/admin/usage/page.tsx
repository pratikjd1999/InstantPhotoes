"use client";

import { useMemo, useState } from "react";
import type { UsageSummary } from "@instantphotos/core";
import { useApi } from "@/lib/api";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Initials,
  PageHeading,
  Skeleton,
  StatCard,
  StatusBadge,
  fmtGb,
  fmtNumber,
  ghostBtn,
  primaryBtn,
} from "@/components/admin/ui";

type SortKey = "storage-desc" | "storage-asc" | "photos-desc" | "name";
const SORT_LABEL: Record<SortKey, string> = {
  "storage-desc": "Storage (high to low)",
  "storage-asc": "Storage (low to high)",
  "photos-desc": "Photos (high to low)",
  name: "Name (A to Z)",
};

export default function UsagePage() {
  const { data, error, loading, reload } = useApi<UsageSummary>("/admin/usage");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("storage-desc");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.perPhotographer ?? []).filter(
      (p) => !q || [p.studioName, p.name, p.code].some((v) => v.toLowerCase().includes(q)),
    );
    return list.sort((a, b) => {
      switch (sort) {
        case "storage-asc": return a.storageGb - b.storageGb;
        case "photos-desc": return b.photos - a.photos;
        case "name": return a.studioName.localeCompare(b.studioName);
        default: return b.storageGb - a.storageGb;
      }
    });
  }, [data, query, sort]);

  const top = useMemo(
    () => [...(data?.perPhotographer ?? [])].sort((a, b) => b.storageGb - a.storageGb).filter((p) => p.storageGb > 0).slice(0, 6),
    [data],
  );

  function downloadCsv() {
    if (!data) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["Photographer", "Studio", "Status", "Events", "Photos", "Guests", "Storage (GB)"].map(esc).join(","),
      ...data.perPhotographer.map((p) =>
        [p.name, p.studioName, p.status, p.events, p.photos, p.guests, p.storageGb].map(esc).join(","),
      ),
      ["Total", "", "", data.totals.events, data.totals.photos, data.totals.guests, data.totals.storageGb].map(esc).join(","),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "instantphotos-usage.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const t = data?.totals;
  const share = (gb: number) => (t && t.storageGb > 0 ? (gb / t.storageGb) * 100 : 0);

  return (
    <>
      <PageHeading
        eyebrow="Super Admin"
        title="Usage & storage"
        description="Storage used, photos processed and guests registered, per photographer and overall."
        actions={
          <>
            <button type="button" onClick={reload} className={`${ghostBtn} bg-surface-high`}>
              <Icon name="sync" className="text-[18px]" />
              Refresh
            </button>
            <button type="button" onClick={downloadCsv} disabled={!data} className={primaryBtn}>
              <Icon name="download" className="text-[18px]" />
              Download CSV
            </button>
          </>
        }
      />

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Total storage" icon="cloud" value={t ? fmtGb(t.storageGb) : null} note="Originals, web copies and selfies" />
            <StatCard label="Total photos" icon="photo_library" value={t ? fmtNumber(t.photos) : null} note="Across all events" />
            <StatCard label="Total guests" icon="face_retouching_natural" value={t ? fmtNumber(t.guests) : null} note="Registered with a selfie" />
            <StatCard label="Total events" icon="auto_stories" value={t ? fmtNumber(t.events) : null} note={t ? `${t.activeEvents} active · ${t.archivedEvents} archived` : undefined} />
            <StatCard
              label="Active photographers"
              icon="badge"
              value={t ? `${t.activePhotographers}` : null}
              suffix={t ? `/ ${t.totalPhotographers}` : undefined}
              note={t ? `${t.suspendedPhotographers} suspended` : undefined}
            />
          </div>

          {data && data.includedDeleted.events > 0 && (
            <Alert tone="info">
              Totals include {data.includedDeleted.events} deleted event{data.includedDeleted.events === 1 ? "" : "s"} (
              {fmtNumber(data.includedDeleted.photos)} photos, {fmtGb(data.includedDeleted.storageGb)}), because deleted events are only hidden and
              their files still use storage.
            </Alert>
          )}

          <Card className="p-6 sm:p-8">
            <span className="text-label-sm font-semibold uppercase tracking-widest text-secondary">Distribution</span>
            <h2 className="mb-6 mt-1 font-serif text-headline-sm font-medium text-primary">Storage by photographer (top consumers)</h2>
            {loading ? (
              <Skeleton rows={4} />
            ) : top.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">No storage used yet.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {top.map((p, i) => (
                  <li key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-label-md font-semibold">{p.studioName}</span>
                      <span className="flex items-center gap-3 text-body-md font-medium text-on-surface-variant">
                        {fmtGb(p.storageGb)}
                        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-semibold text-on-secondary-container">
                          {share(p.storageGb).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container" role="img" aria-label={`${share(p.storageGb).toFixed(1)}% of total storage`}>
                      <div className="h-full rounded-full bg-secondary" style={{ width: `${share(p.storageGb)}%`, opacity: 1 - i * 0.1 }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex flex-col gap-4 border-b border-outline/60 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-serif text-headline-sm font-medium text-primary">Photographer breakdown</h2>
                <p className="text-body-sm text-on-surface-variant">All {data?.perPhotographer.length ?? "–"} accounts with their asset counts.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[240px]">
                  <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by studio or name..."
                    aria-label="Search breakdown"
                    className="w-full rounded-lg bg-surface-low py-2 pl-9 pr-4 text-body-sm outline-none ring-1 ring-outline focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="relative">
                  <Icon name="sort" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
                  <select
                    aria-label="Sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="appearance-none rounded-lg bg-surface-container py-2 pl-9 pr-4 text-label-md outline-none focus:ring-2 focus:ring-primary"
                  >
                    {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                      <option key={k} value={k}>{SORT_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <Skeleton />
            ) : rows.length === 0 ? (
              <EmptyState icon="search_off" title="No photographers match" text="Try a different search." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-body-md">
                  <thead>
                    <tr className="bg-surface-low text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                      <th scope="col" className="px-6 py-3.5">Photographer & studio</th>
                      <th scope="col" className="px-6 py-3.5 text-right">Events</th>
                      <th scope="col" className="px-6 py-3.5 text-right">Photos</th>
                      <th scope="col" className="px-6 py-3.5 text-right">Guests</th>
                      <th scope="col" className="px-6 py-3.5 text-right">Storage used</th>
                      <th scope="col" className="px-6 py-3.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/50">
                    {rows.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-surface-low/60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Initials name={p.studioName} />
                            <div className="flex flex-col">
                              <span className="text-label-md font-semibold">{p.studioName}</span>
                              <span className="text-body-sm text-on-surface-variant">{p.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium">{fmtNumber(p.events)}</td>
                        <td className="px-6 py-4 text-right font-medium">{fmtNumber(p.photos)}</td>
                        <td className="px-6 py-4 text-right font-medium">{fmtNumber(p.guests)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-primary">{fmtGb(p.storageGb)}</span>
                          <span className="ml-1 text-body-sm text-on-surface-variant">({share(p.storageGb).toFixed(1)}%)</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <StatusBadge tone={p.status}>{p.status === "active" ? "Active" : "Suspended"}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {t && !query && (
                    <tfoot>
                      <tr className="bg-surface-high text-label-md font-bold">
                        <td className="px-6 py-4 text-primary">Totals</td>
                        <td className="px-6 py-4 text-right">{fmtNumber(t.events)}</td>
                        <td className="px-6 py-4 text-right">{fmtNumber(t.photos)}</td>
                        <td className="px-6 py-4 text-right">{fmtNumber(t.guests)}</td>
                        <td className="px-6 py-4 text-right text-secondary">{fmtGb(t.storageGb)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
