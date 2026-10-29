"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { PhotographerEvent } from "@instantphotos/core";
import type { UploadRow, Uploader } from "@/lib/uploader";
import { Alert, Card, Icon, fmtNumber, ghostBtn, primaryBtn } from "@/components/admin/ui";
import { fmtBytes } from "@/components/studio/ui";

const ROW: Record<UploadRow["state"], { icon: string; pill: string; pillClass: string; rowClass?: string; iconClass: string }> = {
  queued: { icon: "schedule", pill: "Waiting", pillClass: "bg-surface-high text-on-surface-variant", iconClass: "text-on-surface-variant" },
  uploading: { icon: "image", pill: "Uploading", pillClass: "bg-secondary-container text-on-secondary-container", iconClass: "text-secondary" },
  done: { icon: "check_circle", pill: "Uploaded", pillClass: "bg-tertiary-container text-on-tertiary-variant", iconClass: "text-tertiary" },
  failed: { icon: "error", pill: "Failed", pillClass: "bg-error-container text-on-error-container", rowClass: "bg-error-container/20", iconClass: "text-error" },
  skipped: { icon: "sync_disabled", pill: "Already uploaded", pillClass: "bg-surface-high text-on-surface-variant", rowClass: "opacity-75", iconClass: "text-on-surface-variant" },
  rejected: { icon: "block", pill: "Not accepted", pillClass: "bg-error-container text-on-error-container", rowClass: "opacity-90", iconClass: "text-error" },
};

export function UploadTab({ event, uploader, goGallery }: { event: PhotographerEvent; uploader: Uploader; goGallery: () => void }) {
  const rows = useSyncExternalStore(
    (fn) => uploader.subscribe(fn),
    () => uploader.rows,
    () => uploader.rows,
  );
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const add = (list: FileList | null) => {
    if (list?.length) void uploader.add(Array.from(list));
  };

  const done = rows.filter((r) => r.state === "done").length;
  const failed = rows.filter((r) => r.state === "failed").length;
  const active = rows.filter((r) => r.state === "queued" || r.state === "uploading").length;
  const counted = rows.filter((r) => r.state !== "skipped" && r.state !== "rejected").length;

  return (
    <div className="flex flex-col gap-5">
      {event.status === "archived" && (
        <Alert tone="info">This event is archived. You can still add photos; guests can no longer register until you make it active again.</Alert>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors sm:p-12 ${
          dragging ? "border-primary bg-primary/5" : "border-outline bg-surface-lowest hover:border-secondary hover:bg-surface-low"
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-container text-on-secondary-container">
          <Icon name="add_photo_alternate" className="text-[32px]" />
        </div>
        <h3 className="font-serif text-headline-sm font-medium text-on-surface">Drop JPEG photos here or browse</h3>
        <p className="max-w-md text-body-sm text-on-surface-variant">
          JPEG only, up to 15 MB each. Originals are kept exactly as uploaded; web copies and thumbnails are made from them.
        </p>
        <span className={primaryBtn}>
          <Icon name="folder_open" className="text-[20px]" />
          Select from computer
        </span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,.jpg,.jpeg"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {rows.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline/60 px-5 py-4">
            <h3 className="flex items-center gap-2 font-serif text-headline-sm font-medium text-on-surface">
              <Icon name="pending_actions" className="text-[22px] text-secondary" />
              Upload queue
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-label-md text-on-surface-variant">
                {fmtNumber(done)} / {fmtNumber(counted)} uploaded{failed ? ` · ${failed} failed` : ""}
              </span>
              {active === 0 && (
                <>
                  <button type="button" className={`${ghostBtn} py-1.5`} onClick={() => uploader.clearFinished()}>
                    Clear finished
                  </button>
                  {done > 0 && (
                    <button type="button" className={`${primaryBtn} py-1.5`} onClick={goGallery}>
                      View in gallery
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <ul className="max-h-[480px] divide-y divide-outline/50 overflow-y-auto">
            {rows.map((r) => {
              const look = ROW[r.state];
              return (
                <li key={r.id} className={`flex items-center gap-3 px-5 py-3 ${look.rowClass ?? ""}`}>
                  <Icon
                    name={look.icon}
                    filled={r.state === "done"}
                    className={`shrink-0 text-[22px] ${look.iconClass}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-md text-on-surface">{r.name}</p>
                    <p className={`truncate text-body-sm ${r.state === "failed" ? "text-error" : "text-on-surface-variant"}`}>
                      {fmtBytes(r.size)}
                      {r.message ? ` · ${r.message}` : ""}
                    </p>
                    {r.state === "uploading" && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-high" aria-hidden="true">
                        <div className="h-full rounded-full bg-secondary transition-[width]" style={{ width: `${r.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-label-sm font-semibold ${look.pillClass}`}>
                    {r.state === "uploading" && <Icon name="progress_activity" className="animate-spin text-[14px]" />}
                    {r.state === "uploading" ? `${look.pill} ${r.progress}%` : look.pill}
                  </span>
                  {r.state === "failed" && r.file && (
                    <button type="button" className={`${ghostBtn} shrink-0 px-3 py-1.5 ring-1 ring-outline`} onClick={() => uploader.retry(r.id)}>
                      <Icon name="refresh" className="text-[18px]" />
                      Retry
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
