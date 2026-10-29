"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotographerRow } from "@instantphotos/core";
import { api, useApi } from "@/lib/api";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Initials,
  Modal,
  PageHeading,
  Skeleton,
  StatusBadge,
  dangerBtn,
  fmtGb,
  fmtNumber,
  generateTempPassword,
  ghostBtn,
  inputClass,
  labelClass,
  primaryBtn,
  useToast,
  Tooltip,
} from "@/components/admin/ui";

type Filter = "all" | "active" | "suspended";
type Dialog =
  | { kind: "add" }
  | { kind: "reset"; p: PhotographerRow }
  | { kind: "status"; p: PhotographerRow }
  | null;

export default function PhotographersPage() {
  const { data, error, loading, reload, setData } = useApi<{ photographers: PhotographerRow[] }>("/admin/photographers");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const all = data?.photographers ?? [];
  const counts = useMemo(
    () => ({
      all: all.length,
      active: all.filter((p) => p.status === "active").length,
      suspended: all.filter((p) => p.status === "suspended").length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        (!q || [p.name, p.studioName, p.email, p.phone, p.code].some((v) => v.toLowerCase().includes(q))),
    );
  }, [all, query, filter]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  function upsert(p: PhotographerRow, prepend = false) {
    setData((d) => {
      const list = d?.photographers ?? [];
      const exists = list.some((x) => x.id === p.id);
      return { photographers: exists ? list.map((x) => (x.id === p.id ? p : x)) : prepend ? [p, ...list] : [...list, p] };
    });
  }

  const totalPhotos = all.reduce((n, p) => n + p.photos, 0);
  const totalStorage = all.reduce((n, p) => n + p.storageGb, 0);

  return (
    <>
      <PageHeading
        eyebrow="Directory"
        title="Photographers"
        description="Manage photography studios, their access, and how much they use the platform."
        actions={
          <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: "add" })}>
            <Icon name="add" className="text-[20px]" />
            Add photographer
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total photographers" value={loading ? "–" : fmtNumber(counts.all)} icon="domain" />
        <Stat label="Active" value={loading ? "–" : fmtNumber(counts.active)} icon="verified_user" note={`${counts.suspended} suspended`} />
        <Stat label="Photos" value={loading ? "–" : fmtNumber(totalPhotos)} icon="collections_bookmark" note="Includes deleted events" />
        <Stat label="Storage used" value={loading ? "–" : fmtGb(totalStorage)} icon="cloud" note="Includes deleted events" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-outline/60 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, studio, email or phone..."
              aria-label="Search photographers"
              className="h-10 w-full rounded-lg bg-surface-low pl-10 pr-4 text-body-sm outline-none ring-1 ring-outline focus:ring-2 focus:ring-primary"
            />
          </div>
          <div role="tablist" aria-label="Filter by status" className="flex gap-1 rounded-lg bg-surface-container p-1">
            {(["all", "active", "suspended"] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3.5 py-1.5 text-label-md capitalize transition ${
                  filter === f ? "bg-surface-lowest font-semibold text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Skeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="photo_camera_back"
            title={all.length === 0 ? "No photographers yet" : "No photographers found"}
            text={
              all.length === 0
                ? "Add your first photographer to start assigning events."
                : "No photographers match your search or filter."
            }
            action={
              all.length === 0 ? (
                <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: "add" })}>
                  <Icon name="add" className="text-[20px]" />
                  Add photographer
                </button>
              ) : (
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-body-sm">
              <thead>
                <tr className="bg-surface-high/60 text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                  <th scope="col" className="py-3.5 pl-6 pr-4">Photographer</th>
                  <th scope="col" className="px-4 py-3.5">Studio</th>
                  <th scope="col" className="px-4 py-3.5">Email</th>
                  <th scope="col" className="px-4 py-3.5">Phone</th>
                  <th scope="col" className="px-4 py-3.5">Status</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Events</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Photos</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Storage</th>
                  <th scope="col" className="relative py-3.5 pl-4 pr-6 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/50">
                {rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-surface-low">
                    <td className="py-4 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        <Initials name={p.name} />
                        <div className="relative flex flex-col whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-label-md font-semibold">
                            {p.name}
                            {p.mustChangePassword && (
                              <Tooltip
                                label={
                                  <>
                                    <strong className="font-semibold">Temporary password.</strong> {p.name.split(" ")[0]} hasn&apos;t
                                    signed in and set their own password yet. They&apos;ll be asked to at their next login. If they
                                    lost it, use <em>Reset password</em> from the row menu.
                                  </>
                                }
                              >
                                <Icon name="lock_reset" className="text-[16px] text-secondary" />
                              </Tooltip>
                            )}
                          </span>
                          <span className="text-label-sm font-normal text-on-surface-variant">{p.code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[170px] px-4 py-4 font-medium">{p.studioName}</td>
                    <td className="max-w-[190px] truncate px-4 py-4 text-on-surface-variant" title={p.email}>{p.email}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-on-surface-variant">{p.phone}</td>
                    <td className="px-4 py-4">
                      <StatusBadge tone={p.status}>{p.status === "active" ? "Active" : "Suspended"}</StatusBadge>
                    </td>
                    <td className="px-4 py-4 text-right font-medium">{fmtNumber(p.events)}</td>
                    <td className="px-4 py-4 text-right font-medium">{fmtNumber(p.photos)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-primary">{fmtGb(p.storageGb)}</td>
                    <td className="relative py-4 pl-4 pr-6 text-right">
                      <button
                        type="button"
                        aria-label={`Actions for ${p.name}`}
                        aria-haspopup="menu"
                        aria-expanded={menuFor === p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === p.id ? null : p.id);
                        }}
                        className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container"
                      >
                        <Icon name="more_vert" className="text-[20px]" />
                      </button>
                      {menuFor === p.id && (
                        <div role="menu" className="absolute right-6 top-12 z-20 w-52 overflow-hidden rounded-xl bg-surface-lowest py-1 text-left shadow-xl ring-1 ring-outline">
                          <button
                            role="menuitem"
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-label-md hover:bg-surface-container"
                            onClick={() => setDialog({ kind: "reset", p })}
                          >
                            <Icon name="lock_reset" className="text-[18px] text-secondary" />
                            Reset password
                          </button>
                          <button
                            role="menuitem"
                            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-label-md hover:bg-surface-container ${
                              p.status === "active" ? "text-error" : ""
                            }`}
                            onClick={() => setDialog({ kind: "status", p })}
                          >
                            <Icon name={p.status === "active" ? "block" : "check_circle"} className="text-[18px]" />
                            {p.status === "active" ? "Suspend photographer" : "Reactivate photographer"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="border-t border-outline/60 bg-surface-container/50 px-6 py-3.5 text-body-sm text-on-surface-variant">
            Showing {rows.length} of {all.length} photographers
          </div>
        )}
      </Card>

      <AddDialog
        open={dialog?.kind === "add"}
        onClose={() => setDialog(null)}
        onCreated={(p) => {
          upsert(p, true);
          setDialog(null);
          toast(`${p.studioName} added. Share the temporary password with ${p.name}.`);
        }}
      />
      <ResetDialog
        target={dialog?.kind === "reset" ? dialog.p : null}
        onClose={() => setDialog(null)}
        onDone={(p) => {
          upsert(p);
          setDialog(null);
          toast(`Password reset for ${p.name}.`);
        }}
      />
      <StatusDialog
        target={dialog?.kind === "status" ? dialog.p : null}
        onClose={() => setDialog(null)}
        onDone={(p) => {
          upsert(p);
          setDialog(null);
          toast(p.status === "suspended" ? `${p.studioName} suspended.` : `${p.studioName} reactivated.`);
        }}
      />
    </>
  );
}

function Stat({ label, value, icon, note }: { label: string; value: string; icon: string; note?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-lowest p-5 shadow-sm ring-1 ring-outline/60">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-secondary-container/40" />
      <div className="relative flex items-center justify-between">
        <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <Icon name={icon} className="text-[20px] text-secondary" />
      </div>
      <p className="relative mt-2 font-serif text-headline-md font-semibold tracking-tight text-primary">{value}</p>
      {note && <p className="relative mt-1 text-body-sm text-on-surface-variant">{note}</p>}
    </div>
  );
}

function TempPasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const toast = useToast();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor="temp-password" className={labelClass}>Temporary password</label>
        <span className="text-label-sm text-on-surface-variant">Min 10 characters</span>
      </div>
      <div className="flex gap-2">
        <input
          id="temp-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className={`${inputClass} font-mono`}
        />
        <button type="button" onClick={() => onChange(generateTempPassword())} className={`${ghostBtn} shrink-0 ring-1 ring-outline`}>
          Generate
        </button>
        <button
          type="button"
          aria-label="Copy password"
          className={`${ghostBtn} shrink-0 px-3 ring-1 ring-outline`}
          onClick={() => navigator.clipboard?.writeText(value).then(() => toast("Password copied."), () => toast("Couldn't copy.", "error"))}
        >
          <Icon name="content_copy" className="text-[18px]" />
        </button>
      </div>
    </div>
  );
}

function AddDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: PhotographerRow) => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", studioName: "", temporaryPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm({ name: "", email: "", phone: "", studioName: "", temporaryPassword: generateTempPassword() });
      setError(null);
    }
    wasOpen.current = open;
  }, [open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { photographer } = await api<{ photographer: PhotographerRow }>("/admin/photographers", { method: "POST", json: form });
      onCreated(photographer);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="person_add"
      title="Add photographer"
      description="Create a studio profile and set a temporary password."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field id="ph-name" label="Photographer name" value={form.name} onChange={set("name")} placeholder="e.g. Tarun Chawla" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ph-email" type="email" label="Email address" value={form.email} onChange={set("email")} placeholder="tarun@studio.in" />
          <Field id="ph-phone" type="tel" label="Phone number" value={form.phone} onChange={set("phone")} placeholder="98110 00000" />
        </div>
        <Field id="ph-studio" label="Studio name" value={form.studioName} onChange={set("studioName")} placeholder="e.g. Tarun Chawla Visuals" />
        <TempPasswordField value={form.temporaryPassword} onChange={(v) => setForm((f) => ({ ...f, temporaryPassword: v }))} />
        <Alert tone="info">Share the email and temporary password with the photographer. They must set a new password at first login.</Alert>
        <div className="flex justify-end gap-3">
          <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={primaryBtn} disabled={busy}>
            {busy ? "Creating..." : "Create photographer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ id, label, value, onChange, placeholder, type = "text" }: {
  id: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input id={id} type={type} required value={value} onChange={onChange} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

function ResetDialog({ target, onClose, onDone }: { target: PhotographerRow | null; onClose: () => void; onDone: (p: PhotographerRow) => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = target?.id;

  useEffect(() => {
    if (id) {
      setPassword(generateTempPassword());
      setError(null);
    }
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const { photographer } = await api<{ photographer: PhotographerRow }>(`/admin/photographers/${target.id}/reset-password`, {
        method: "POST",
        json: { temporaryPassword: password },
      });
      onDone(photographer);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      icon="lock_reset"
      title="Reset password"
      description={target ? `Set a new temporary password for ${target.name} (${target.studioName}).` : undefined}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <TempPasswordField value={password} onChange={setPassword} />
        <Alert tone="info">This replaces their current password and signs them out. They must choose a new password at next login.</Alert>
        <div className="flex justify-end gap-3">
          <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={primaryBtn} disabled={busy}>{busy ? "Resetting..." : "Reset password"}</button>
        </div>
      </form>
    </Modal>
  );
}

function StatusDialog({ target, onClose, onDone }: { target: PhotographerRow | null; onClose: () => void; onDone: (p: PhotographerRow) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspending = target?.status === "active";

  useEffect(() => setError(null), [target?.id]);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const { photographer } = await api<{ photographer: PhotographerRow }>(`/admin/photographers/${target.id}`, {
        method: "PATCH",
        json: { status: suspending ? "suspended" : "active" },
      });
      onDone(photographer);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      tone={suspending ? "danger" : "default"}
      icon={suspending ? "block" : "check_circle"}
      title={suspending ? "Suspend photographer?" : "Reactivate photographer?"}
      description={target ? `${target.name} · ${target.studioName}` : undefined}
      footer={
        <>
          <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={suspending ? dangerBtn : primaryBtn} disabled={busy} onClick={confirm}>
            {busy ? "Working..." : suspending ? "Suspend" : "Reactivate"}
          </button>
        </>
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-body-sm text-on-surface-variant">
        {suspending
          ? "They won't be able to log in and their active sessions will end. Their events and photos stay as they are."
          : "They will be able to log in again."}
      </p>
    </Modal>
  );
}
