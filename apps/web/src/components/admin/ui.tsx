"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

export function Icon({ name, className = "", filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined select-none leading-none ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

// ---------- form styles ----------
export const inputClass =
  "w-full rounded-lg bg-surface-low px-3.5 py-2.5 text-body-md text-on-surface shadow-sm outline-none ring-1 ring-outline transition placeholder:text-on-surface-variant/60 focus:bg-surface-lowest focus:ring-2 focus:ring-primary";
export const labelClass = "text-label-md font-semibold text-on-surface";
export const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-md text-white shadow-sm transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50";
export const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50";
export const dangerBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-error px-4 py-2.5 text-label-md text-white shadow-sm transition-colors hover:bg-on-error-container disabled:cursor-not-allowed disabled:opacity-50";

// ---------- badges ----------
export function StatusBadge({ tone, children }: { tone: "active" | "suspended" | "archived" | "info"; children: React.ReactNode }) {
  const styles = {
    active: ["bg-tertiary-container text-on-tertiary-variant", "bg-tertiary"],
    suspended: ["bg-error-container text-on-error-container", "bg-error"],
    archived: ["bg-surface-high text-on-surface-variant", "bg-on-surface-variant"],
    info: ["bg-secondary-container text-on-secondary-container", "bg-secondary"],
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm font-semibold ${styles[0]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles[1]}`} />
      {children}
    </span>
  );
}

export function Initials({ name }: { name: string }) {
  const text = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-[13px] font-semibold text-on-primary-container">
      {text}
    </div>
  );
}

// ---------- page chrome ----------
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="flex max-w-3xl flex-col gap-2">
        {eyebrow && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-0.5 text-label-sm font-semibold uppercase tracking-wider text-on-secondary-container">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            {eyebrow}
          </span>
        )}
        <h1 className="font-serif text-headline-lg font-medium tracking-tight text-primary">{title}</h1>
        <p className="text-body-md text-on-surface-variant">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl bg-surface-lowest shadow-sm ring-1 ring-outline/60 ${className}`}>{children}</div>;
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-6" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 rounded-lg bg-surface-container p-4">
          <div className="h-9 w-9 rounded-lg bg-surface-highest" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3.5 w-1/3 rounded bg-surface-highest" />
            <div className="h-3 w-1/5 rounded bg-surface-highest" />
          </div>
          <div className="hidden h-3.5 w-24 rounded bg-surface-highest sm:block" />
          <div className="hidden h-3.5 w-16 rounded bg-surface-highest md:block" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-container text-on-secondary-container">
        <Icon name={icon} className="text-[28px]" />
      </div>
      <h3 className="font-serif text-headline-sm font-medium text-on-surface">{title}</h3>
      <p className="max-w-sm text-body-sm text-on-surface-variant">{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon="error"
      title="Couldn't load this"
      text={message}
      action={
        <button type="button" onClick={onRetry} className={primaryBtn}>
          Try again
        </button>
      }
    />
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "bg-error-container text-on-error-container",
    success: "bg-tertiary-container text-on-tertiary-variant",
    info: "bg-secondary-container/40 text-on-surface-variant",
  }[tone];
  const icon = { error: "error", success: "check_circle", info: "info" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-lg p-3.5 text-body-sm ${styles}`}>
      <Icon name={icon} className="mt-0.5 shrink-0 text-[20px]" />
      <div className="leading-snug">{children}</div>
    </div>
  );
}

// ---------- stat card (Usage page, photographer dashboard) ----------
export function StatCard({ label, icon, value, note, suffix }: { label: string; icon: string; value: string | null; note?: string; suffix?: string }) {
  return (
    <div className="rounded-xl bg-surface-lowest p-5 shadow-sm ring-1 ring-outline/60">
      <div className="flex items-center justify-between">
        <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <Icon name={icon} className="text-[20px] text-secondary" />
      </div>
      {value === null ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-surface-container" />
      ) : (
        <p className="mt-2 font-serif text-headline-md font-semibold tracking-tight text-primary">
          {value}
          {suffix && <span className="ml-1.5 font-serif text-headline-sm font-normal text-on-surface-variant">{suffix}</span>}
        </p>
      )}
      {note && <p className="mt-1 text-body-sm text-on-surface-variant">{note}</p>}
    </div>
  );
}

// ---------- modal ----------
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "default",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const focusable = panelRef.current?.querySelector<HTMLElement>("input, button, select, textarea");
    focusable?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-inverse-surface/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-2xl bg-surface-lowest p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start gap-4">
          {icon && (
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                tone === "danger" ? "bg-error-container text-error" : "bg-secondary-container text-secondary"
              }`}
            >
              <Icon name={icon} className="text-[26px]" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={titleId} className="font-serif text-headline-sm font-semibold text-on-surface">
              {title}
            </h2>
            {description && <p className="text-body-sm text-on-surface-variant">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        {children}
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 pt-1">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- toast ----------
interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-4 z-[70] flex flex-col gap-2 sm:right-8" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl bg-inverse-surface px-5 py-3.5 text-body-sm text-inverse-on-surface shadow-xl"
          >
            <Icon
              name={t.tone === "success" ? "task_alt" : "error"}
              className={`text-[20px] ${t.tone === "success" ? "text-tertiary-container" : "text-error-container"}`}
            />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- helpers ----------
export const fmtNumber = (n: number) => n.toLocaleString("en-IN");
export const fmtGb = (gb: number) => (gb >= 1000 ? `${(gb / 1024).toFixed(2)} TB` : `${gb.toLocaleString("en-IN", { maximumFractionDigits: 1 })} GB`);
export const fmtDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  const core = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `${core}#${(bytes[0]! % 90) + 10}`;
}
