"use client";

import { useState } from "react";
import type { GuestSearchRow } from "@instantphotos/core";
import { api } from "@/lib/api";
import {
  Alert,
  Card,
  Icon,
  Modal,
  PageHeading,
  dangerBtn,
  fmtNumber,
  ghostBtn,
  inputClass,
  labelClass,
  primaryBtn,
  useToast,
} from "@/components/admin/ui";

export default function AccountPage() {
  return (
    <>
      <PageHeading
        eyebrow="Super Admin"
        title="Account & privacy"
        description="Your login security and the tools for guest privacy requests."
      />
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <PasswordCard />
        </div>
        <div className="lg:col-span-7">
          <GuestErasureCard />
        </div>
      </div>
    </>
  );
}

// ---------------- change password (ADM-8) ----------------
function strength(pw: string) {
  const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const points = checks.filter(Boolean).length;
  const label = ["None", "Weak", "Weak", "Good", "Very strong"][points]!;
  return { points, label };
}

function PasswordField({ id, label, value, onChange, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
        >
          <Icon name={show ? "visibility_off" : "visibility"} className="text-[18px]" />
        </button>
      </div>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const s = strength(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api("/auth/change-password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Icon name="key" className="text-[20px] text-secondary" />
          <h2 className="font-serif text-headline-sm font-semibold tracking-tight">Change password</h2>
        </div>
        <p className="text-body-sm text-on-surface-variant">Update the password for your Super Admin login.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {done && <Alert tone="success"><strong>Password updated.</strong> Your other sessions have been logged out.</Alert>}
        {error && <Alert tone="error">{error}</Alert>}

        <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <div className="flex flex-col gap-2">
          <PasswordField id="new-password" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
          <div className="flex flex-col gap-1.5" aria-live="polite">
            <div className="flex justify-between text-label-sm text-on-surface-variant">
              <span>Strength: <span className="font-semibold text-secondary">{s.label}</span></span>
              <span>{s.points}/4 criteria</span>
            </div>
            <div className="grid h-1.5 grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className={`rounded-full transition-colors ${s.points >= n ? "bg-secondary" : "bg-surface-high"}`} />
              ))}
            </div>
            <p className="text-label-sm text-on-surface-variant">At least 8 characters, including a number or a symbol. Mixing upper case adds strength.</p>
          </div>
        </div>
        <PasswordField id="confirm-password" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

        <Alert tone="info">Your other sessions will be logged out when you change your password. This session stays signed in.</Alert>

        <button type="submit" disabled={busy} className={`${primaryBtn} w-full py-3`}>
          <Icon name="save" className="text-[18px]" />
          {busy ? "Saving..." : "Save password"}
        </button>
      </form>
    </Card>
  );
}

// ---------------- delete a guest (ADM-7) ----------------
function GuestErasureCard() {
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<GuestSearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<GuestSearchRow | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const { guests } = await api<{ guests: GuestSearchRow[] }>(`/admin/guests?phone=${encodeURIComponent(phone)}`);
      setResults(guests);
    } catch (err) {
      setResults(null);
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-5 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Icon name="no_accounts" className="text-[20px] text-error" />
          <h2 className="font-serif text-headline-sm font-semibold tracking-tight">Delete a guest&apos;s data</h2>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          For privacy requests. Removes the guest&apos;s selfie, face data, matches and sessions. Search by phone number.
        </p>
      </div>

      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Icon name="call" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
          <input
            type="search"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number, e.g. 98765 43210"
            aria-label="Guest phone number"
            required
            className={`${inputClass} pl-10`}
          />
        </div>
        <button type="submit" disabled={searching} className={primaryBtn}>
          <Icon name="search" className="text-[18px]" />
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      <div className="mt-5" aria-live="polite">
        {error && <Alert tone="error">{error}</Alert>}
        {results && results.length === 0 && (
          <p className="rounded-lg bg-surface-container p-4 text-body-sm text-on-surface-variant">No guest found with that phone number.</p>
        )}
        {results && results.length > 0 && (
          <ul className="flex flex-col divide-y divide-outline/60 overflow-hidden rounded-xl ring-1 ring-outline/60">
            {results.map((g) => (
              <li key={g.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <span className="text-label-md font-semibold">{g.name}</span>
                  <span className="text-body-sm text-on-surface-variant">{g.phone}</span>
                  <span className="text-label-sm text-on-surface-variant">
                    {g.eventName} · {g.studioName} · {fmtNumber(g.matchedPhotos)} matched photos
                  </span>
                </div>
                <button type="button" className={`${dangerBtn} shrink-0`} onClick={() => setTarget(g)}>
                  <Icon name="delete_forever" className="text-[18px]" />
                  Delete guest data
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DeleteDialog
        target={target}
        onClose={() => setTarget(null)}
        onDeleted={(g) => {
          setResults((r) => r?.filter((x) => x.id !== g.id) ?? null);
          setTarget(null);
          toast(`${g.name}'s selfie, face data and matches were deleted.`);
        }}
      />
    </Card>
  );
}

function DeleteDialog({ target, onClose, onDeleted }: { target: GuestSearchRow | null; onClose: () => void; onDeleted: (g: GuestSearchRow) => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setTyped("");
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/guests/${target.id}`, { method: "DELETE" });
      setTyped("");
      onDeleted(target);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ready = typed.trim() === "DELETE";

  return (
    <Modal
      open={!!target}
      onClose={close}
      tone="danger"
      icon="warning"
      title="Delete this guest's data?"
      description="This cannot be undone."
      footer={
        <>
          <button type="button" className={ghostBtn} onClick={close}>Cancel</button>
          <button type="button" className={dangerBtn} disabled={!ready || busy} onClick={confirm}>
            <Icon name="delete_forever" className="text-[18px]" />
            {busy ? "Deleting..." : "Permanently delete"}
          </button>
        </>
      }
    >
      {target && (
        <p className="rounded-xl bg-error-container/40 p-4 text-body-sm leading-relaxed text-on-error-container">
          This permanently removes the selfie, face data, {fmtNumber(target.matchedPhotos)} photo matches and access sessions for{" "}
          <strong className="text-on-surface">{target.name} ({target.phone})</strong> from {target.eventName}.
        </p>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-delete" className={labelClass}>
          To confirm, type <span className="font-mono font-bold tracking-widest text-error">DELETE</span> below:
        </label>
        <input
          id="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          placeholder="Type DELETE to enable the button"
          className={`${inputClass} font-mono tracking-wider`}
        />
      </div>
    </Modal>
  );
}
