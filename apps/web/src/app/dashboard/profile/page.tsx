"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotographerProfile } from "@instantphotos/core";
import { api, useApi } from "@/lib/api";
import { Alert, Card, ErrorState, Icon, Modal, PageHeading, Skeleton, ghostBtn, inputClass, labelClass, primaryBtn, useToast } from "@/components/admin/ui";
import { NewPasswordFields, PasswordInput, passwordChecks } from "@/components/studio/ui";

// P05: Profile & branding (PRO-1..3) and change password (AUTH-7).

type Kind = "logo" | "brand";
const MAX = 5 * 1024 * 1024;

function BrandingTile({
  kind,
  title,
  hint,
  url,
  busy,
  onPick,
  onRemove,
}: {
  kind: Kind;
  title: string;
  hint: string;
  url: string | null;
  busy: boolean;
  onPick: (kind: Kind, file: File) => void;
  onRemove: (kind: Kind) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-4 rounded-xl bg-surface-low p-4 ring-1 ring-outline/60">
      <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-surface-lowest ring-1 ring-outline/60 ${kind === "logo" ? "h-16 w-16 rounded-xl" : "h-16 w-28 rounded-lg"}`}>
        {busy ? (
          <Icon name="progress_activity" className="animate-spin text-[24px] text-secondary" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={`h-full w-full ${kind === "logo" ? "object-contain p-1" : "object-cover"}`} />
        ) : (
          <Icon name={kind === "logo" ? "photo_camera" : "landscape"} className="text-[26px] text-on-surface-variant/60" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-label-md font-semibold text-on-surface">{title}</p>
        <p className="text-body-sm text-on-surface-variant">{hint}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 text-label-md text-primary hover:underline disabled:opacity-50">
            <Icon name="upload_file" className="text-[18px]" />
            {url ? "Change" : "Upload"}
          </button>
          {url && (
            <button type="button" disabled={busy} onClick={() => onRemove(kind)} className="inline-flex items-center gap-1 text-label-md text-error hover:underline disabled:opacity-50">
              <Icon name="delete" className="text-[18px]" />
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onPick(kind, f);
          }}
        />
      </div>
    </div>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Enter your current password.");
    if (!passwordChecks(next, confirm).every((c) => c.ok)) return setError("The new password doesn't meet all the requirements yet.");
    setSaving(true);
    try {
      await api("/auth/change-password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      toast("Password updated. You've been signed out on your other devices.");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} icon="lock_reset" title="Change password" description="Confirm your current password, then choose a new one.">
      <form onSubmit={save} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <PasswordInput label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" placeholder="Your current password" />
        <NewPasswordFields value={next} confirm={confirm} onChange={setNext} onConfirm={setConfirm} />
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className={ghostBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={saving}>
            <Icon name={saving ? "progress_activity" : "enhanced_encryption"} className={`text-[20px] ${saving ? "animate-spin" : ""}`} />
            {saving ? "Saving..." : "Save password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProfilePage() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<{ profile: PhotographerProfile }>("/me/profile");
  const p = data?.profile;
  const [form, setForm] = useState({ studioName: "", displayName: "", phone: "", website: "", instagram: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Kind | null>(null);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (p) setForm({ studioName: p.studioName, displayName: p.displayName, phone: p.phone, website: p.website, instagram: p.instagram ? `@${p.instagram}` : "" });
  }, [p?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.studioName.trim()) return setFormError("Studio name is required.");
    setSaving(true);
    try {
      const res = await api<{ profile: PhotographerProfile }>("/me/profile", { method: "PATCH", json: form });
      setData(res);
      setForm({ ...form, phone: res.profile.phone, website: res.profile.website, instagram: res.profile.instagram ? `@${res.profile.instagram}` : "" });
      toast("Profile saved. Guests will see the changes on your event pages.");
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function pick(kind: Kind, file: File) {
    if (!["image/jpeg", "image/png"].includes(file.type)) return toast("Use a JPEG or PNG image.", "error");
    if (file.size > MAX) return toast("The image must be 5 MB or smaller.", "error");
    setUploading(kind);
    try {
      const { key, url } = await api<{ key: string; url: string }>("/me/profile/branding-upload-url", {
        method: "POST",
        json: { kind, contentType: file.type, size: file.size },
      });
      const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("The upload didn't go through. Please try again.");
      const res = await api<{ profile: PhotographerProfile }>("/me/profile/branding", { method: "PUT", json: { kind, key } });
      setData(res);
      toast(kind === "logo" ? "Logo updated." : "Brand image updated.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(null);
    }
  }

  async function removeImage(kind: Kind) {
    setUploading(kind);
    try {
      setData(await api<{ profile: PhotographerProfile }>("/me/profile/branding", { method: "PUT", json: { kind, key: null } }));
      toast(kind === "logo" ? "Logo removed." : "Brand image removed.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(null);
    }
  }

  const field = (id: keyof typeof form, label: string, icon: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label} {required && <span className="text-error">*</span>}
      </label>
      <div className="relative">
        <input id={id} value={form[id]} onChange={set(id)} className={`${inputClass} pr-10`} {...props} />
        <Icon name={icon} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant/50" />
      </div>
    </div>
  );

  return (
    <>
      <PageHeading title="Profile & branding" description="Your studio details and the branding guests see on your event pages and galleries." />

      {loading && !p ? (
        <Card>
          <Skeleton rows={4} />
        </Card>
      ) : error || !p ? (
        <Card>
          <ErrorState message={error ?? "Couldn't load your profile."} onRetry={reload} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="p-6 sm:p-8 xl:col-span-7">
            <form onSubmit={save} className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                  <Icon name="palette" className="text-[22px]" />
                </div>
                <div>
                  <h2 className="font-serif text-headline-sm font-medium text-on-surface">Studio details</h2>
                  <p className="text-body-sm text-on-surface-variant">Shown on your QR card, event pages and guest galleries.</p>
                </div>
              </div>
              {formError && <Alert tone="error">{formError}</Alert>}

              {field("studioName", "Studio name", "verified_user", { maxLength: 120, placeholder: "e.g. Kabir Sharma Photography" }, true)}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {field("displayName", "Photographer name", "person", { maxLength: 80, placeholder: p.name })}
                {field("phone", "Contact number", "call", { type: "tel", inputMode: "tel", placeholder: "98200 00000" }, true)}
              </div>

              <div className="flex flex-col gap-4 border-t border-outline/60 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-label-md font-semibold text-on-surface">
                    <Icon name="share" className="text-[18px] text-secondary" />
                    Website & social
                  </h3>
                  <span className="text-label-sm text-on-surface-variant">Shown on your guest gallery page</span>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {field("website", "Website", "language", { placeholder: "yourstudio.in", inputMode: "url" })}
                  {field("instagram", "Instagram", "alternate_email", { placeholder: "@yourstudio" })}
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-outline/60 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-label-md font-semibold text-on-surface">
                    <Icon name="imagesmode" className="text-[18px] text-secondary" />
                    Logo & brand image
                  </h3>
                  <span className="text-label-sm text-on-surface-variant">JPEG or PNG, up to 5 MB each</span>
                </div>
                <BrandingTile kind="logo" title="Studio logo" hint="A square PNG with a transparent background works best." url={p.logoUrl} busy={uploading === "logo"} onPick={pick} onRemove={removeImage} />
                <BrandingTile kind="brand" title="Brand image" hint="A wide photo for the top of your guest pages." url={p.brandImageUrl} busy={uploading === "brand"} onPick={pick} onRemove={removeImage} />
              </div>

              <div className="flex justify-end">
                <button type="submit" className={primaryBtn} disabled={saving}>
                  <Icon name={saving ? "progress_activity" : "check"} className={`text-[20px] ${saving ? "animate-spin" : ""}`} />
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </Card>

          <div className="flex flex-col gap-6 xl:col-span-5">
            <Card className="overflow-hidden">
              <p className="flex items-center gap-2 px-5 pt-4 text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                <Icon name="visibility" className="text-[18px]" />
                Guest page preview
              </p>
              <div className="p-5">
                <div className="overflow-hidden rounded-xl ring-1 ring-outline/60">
                  <div className="relative h-28 bg-gradient-to-br from-primary to-primary-container">
                    {p.brandImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.brandImageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <div className="absolute -bottom-7 left-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-surface-lowest shadow-md ring-2 ring-surface-lowest">
                      {p.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logoUrl} alt="" className="h-full w-full object-contain p-1" />
                      ) : (
                        <Icon name="photo_camera" className="text-[24px] text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="bg-surface-lowest px-4 pb-4 pt-9">
                    <p className="font-serif text-headline-sm font-medium text-primary">{form.studioName.trim() || "Your studio"}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      {[form.instagram.trim(), form.website.trim().replace(/^https?:\/\//, "")].filter(Boolean).join(" · ") || "Add your website or Instagram"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                  <Icon name="lock_reset" className="text-[22px]" />
                </div>
                <div>
                  <h2 className="font-serif text-headline-sm font-medium text-on-surface">Account & security</h2>
                  <p className="text-body-sm text-on-surface-variant">You sign in with this email address.</p>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-3 rounded-lg bg-surface-low p-4 text-body-sm ring-1 ring-outline/60 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">Email</dt>
                  <dd className="truncate font-semibold">{p.email}</dd>
                </div>
                <div>
                  <dt className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">Photographer ID</dt>
                  <dd className="font-semibold">{p.code}</dd>
                </div>
              </dl>
              <p className="text-body-sm text-on-surface-variant">To change your email, contact the platform administrator.</p>
              <button type="button" onClick={() => setPwOpen(true)} className={`${primaryBtn} w-full`}>
                <Icon name="enhanced_encryption" className="text-[20px]" />
                Change password
              </button>
            </Card>
          </div>
        </div>
      )}

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}
