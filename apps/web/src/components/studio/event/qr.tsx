"use client";

import { useEffect, useState } from "react";
import type { PhotographerEvent } from "@instantphotos/core";
import { QR_BRAND, QR_CREDIT_PREFIX, downloadQrPdf, downloadQrPng, qrDataUrl } from "@/lib/qr-card";
import { Alert, Card, Icon, primaryBtn, useToast } from "@/components/admin/ui";

// EVT-2/3: the event QR (encodes {APP_URL}/e/{code}) as a printable card, PNG and PDF.

export function QrTab({ event, studioName }: { event: PhotographerEvent; studioName: string }) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    qrDataUrl(event.publicUrl, 480).then(setQr);
  }, [event.publicUrl]);

  const card = { studioName: studioName || "Your studio", eventName: event.name, url: event.publicUrl };

  async function download(kind: "png" | "pdf") {
    setBusy(kind);
    try {
      await (kind === "png" ? downloadQrPng(card) : downloadQrPdf(card));
    } catch {
      toast("Couldn't create the file. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(event.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy. Select the link and copy it by hand.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="flex justify-center lg:w-7/12">
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface-lowest p-8 text-center shadow-xl ring-1 ring-outline/60 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-secondary-container via-primary-container to-secondary-container" />
          <p className="text-label-sm font-semibold uppercase tracking-[0.2em] text-secondary">{card.studioName}</p>
          <h2 className="mt-3 font-serif text-headline-lg font-medium text-primary">{event.name}</h2>
          <p className="mt-2 font-serif text-body-md italic text-on-surface-variant">Scan to find all photos of you</p>
          <div className="mx-auto mt-6 flex h-60 w-60 items-center justify-center rounded-2xl bg-white p-3 shadow-sm ring-1 ring-outline/60">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code for ${event.publicUrl}`} className="h-full w-full" />
            ) : (
              <div className="h-full w-full animate-pulse rounded-lg bg-surface-container" />
            )}
          </div>
          <div className="-mx-8 -mb-8 mt-8 flex flex-col items-center gap-2 border-t-4 border-secondary-container bg-gradient-to-br from-primary to-primary-container px-6 py-5 lg:-mx-10 lg:-mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary-container">{QR_CREDIT_PREFIX}</span>
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
                <Icon name="photo_camera" className="text-[22px] text-primary-container" />
              </span>
              <span className="font-serif text-headline-md font-semibold text-white">{QR_BRAND}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:w-5/12">
        {event.status === "archived" && (
          <Alert tone="info">This event is archived. The link still opens, but new guests can't register until you make it active again.</Alert>
        )}
        <Card className="flex flex-col gap-4 p-6">
          <h3 className="font-serif text-headline-sm font-medium text-on-surface">Guest link</h3>
          <p className="text-body-sm text-on-surface-variant">The QR code opens this page. You can also share the link directly, for example on WhatsApp.</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={event.publicUrl}
              onFocus={(e) => e.target.select()}
              aria-label="Guest link"
              className="h-10 min-w-0 flex-1 rounded-lg bg-surface-low px-3 text-body-sm ring-1 ring-outline"
            />
            <button type="button" onClick={copy} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-surface-high px-3.5 text-label-md text-primary hover:bg-surface-highest">
              <Icon name={copied ? "check" : "content_copy"} className="text-[18px]" />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </Card>
        <Card className="flex flex-col gap-4 p-6">
          <h3 className="font-serif text-headline-sm font-medium text-on-surface">Download the card</h3>
          <p className="text-body-sm text-on-surface-variant">A 4 × 6 inch card for table tents and easel boards: your studio name, the event name and the QR code.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={primaryBtn} onClick={() => download("png")} disabled={busy !== null}>
              <Icon name={busy === "png" ? "progress_activity" : "image"} className={`text-[20px] ${busy === "png" ? "animate-spin" : ""}`} />
              Download PNG
            </button>
            <button
              type="button"
              onClick={() => download("pdf")}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary-container px-4 py-2.5 text-label-md text-on-secondary-container shadow-sm transition-colors hover:bg-secondary-container/80 disabled:opacity-50"
            >
              <Icon name={busy === "pdf" ? "progress_activity" : "picture_as_pdf"} className={`text-[20px] ${busy === "pdf" ? "animate-spin" : ""}`} />
              Download PDF
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
