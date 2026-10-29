"use client";

import { useId, useState } from "react";
import type { EventStatus, PhotoStatus } from "@instantphotos/core";
import { Icon, StatusBadge, inputClass, labelClass } from "@/components/admin/ui";

// Pieces shared by the photographer pages. Everything else comes from the admin UI kit, so both areas look the same.

export const fmtBytes = (n: number) => {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toLocaleString("en-IN", { maximumFractionDigits: 1 })} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toLocaleString("en-IN", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
};

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <StatusBadge tone={status === "active" ? "active" : "archived"}>{status === "active" ? "Active" : "Archived"}</StatusBadge>;
}

export const PHOTO_STATUS: Record<PhotoStatus, { label: string; className: string; icon: string }> = {
  pending_upload: { label: "Waiting to upload", className: "bg-surface-high text-on-surface-variant", icon: "schedule" },
  uploaded: { label: "Uploaded", className: "bg-secondary-container text-on-secondary-container", icon: "cloud_done" },
  processing: { label: "Processing", className: "bg-secondary-container text-on-secondary-container", icon: "progress_activity" },
  ready: { label: "Ready", className: "bg-tertiary-container text-on-tertiary-variant", icon: "check_circle" },
  failed: { label: "Failed", className: "bg-error-container text-on-error-container", icon: "error" },
  upload_failed: { label: "Upload failed", className: "bg-error-container text-on-error-container", icon: "cloud_off" },
};

export function PhotoStatusBadge({ status, compact = false }: { status: PhotoStatus; compact?: boolean }) {
  const s = PHOTO_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-label-sm"} ${s.className}`}>
      <Icon name={s.icon} className={`${compact ? "text-[13px]" : "text-[15px]"} ${status === "processing" ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
}

/** A stored photo whose file may not exist yet (e.g. seeded demo rows): falls back to a neutral tile. */
export function PhotoThumb({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-surface-high text-on-surface-variant ${className}`}>
        <Icon name="image" className="text-[28px] opacity-60" />
      </div>
    );
  }
  // Signed URLs change every load, so next/image caching does not help here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={`object-cover ${className}`} />;
}

// ---------- password (one rule everywhere: 8+ characters with a number or symbol) ----------

export function passwordChecks(pw: string, confirm: string) {
  return [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "Contains a number or symbol", ok: /[0-9]|[^A-Za-z0-9]/.test(pw) },
    { label: "Passwords match", ok: pw.length > 0 && pw === confirm },
  ];
}

export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: React.ReactNode;
  placeholder?: string;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {hint}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name={show ? "visibility_off" : "visibility"} className="text-[20px]" />
        </button>
      </div>
    </div>
  );
}

/** New + confirm fields with the live strength bar and checklist (P06 design; also used in the profile modal). */
export function NewPasswordFields({
  value,
  confirm,
  onChange,
  onConfirm,
}: {
  value: string;
  confirm: string;
  onChange: (v: string) => void;
  onConfirm: (v: string) => void;
}) {
  const checks = passwordChecks(value, confirm);
  const passed = checks.filter((c) => c.ok).length;
  const strength = !value ? null : !checks[0]!.ok ? "Too short" : !checks[1]!.ok ? "Weak" : passed === 3 ? "Strong" : "Moderate";
  const strengthTone = strength === "Too short" || strength === "Weak" ? "text-error" : strength === "Strong" ? "text-tertiary" : "text-secondary";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <PasswordInput
          label="New password"
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint={strength && <span className={`text-label-sm font-semibold ${strengthTone}`} aria-live="polite">{strength}</span>}
        />
        <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-colors ${
                i < passed ? (passed === 3 ? "bg-tertiary" : i === 0 ? "bg-secondary-container" : "bg-secondary") : "bg-surface-high"
              }`}
            />
          ))}
        </div>
      </div>
      <PasswordInput label="Confirm password" value={confirm} onChange={onConfirm} autoComplete="new-password" placeholder="Type it again" />
      <ul className="grid gap-2 rounded-lg bg-surface-low p-3.5 ring-1 ring-outline/60">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-2 text-body-sm ${c.ok ? "text-on-surface" : "text-on-surface-variant"}`}>
            <Icon name={c.ok ? "check_circle" : "radio_button_unchecked"} filled={c.ok} className={`text-[18px] ${c.ok ? "text-tertiary" : ""}`} />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
