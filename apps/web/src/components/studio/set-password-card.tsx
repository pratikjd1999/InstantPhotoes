"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { ADMIN_CONTACT } from "@/lib/contact";
import { Icon } from "@/components/admin/ui";
import { NewPasswordFields, PasswordInput, passwordChecks } from "@/components/studio/ui";

export function SetPasswordCard() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Enter the temporary password you signed in with.");
    const checks = passwordChecks(next, confirm);
    if (!checks[2]!.ok && next) return setError("Passwords do not match. Please check both fields.");
    if (!checks.every((c) => c.ok)) return setError("Please meet all the requirements above.");
    setState("saving");
    try {
      const res = await api<{ redirect: string }>("/auth/change-password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      setState("done");
      setTimeout(() => {
        router.push(res.redirect);
        router.refresh();
      }, 900);
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-[480px] flex-col items-center">
      <div className="mb-8 flex items-center gap-2 text-primary">
        <Icon name="photo_camera" className="text-[28px]" />
        <span className="font-serif text-headline-sm font-medium">InstantPhotos</span>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl bg-surface-lowest p-6 shadow-xl ring-1 ring-outline/60 md:p-10">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
              <Icon name="key" className="text-[24px]" />
            </div>
            <p className="text-label-sm font-semibold uppercase tracking-[0.2em] text-secondary">Security update</p>
            <h1 className="font-serif text-headline-md font-medium text-primary">Set a new password to continue</h1>
            <div className="flex items-start gap-2 rounded-lg bg-surface-low p-3 text-body-sm text-on-surface-variant">
              <Icon name="verified_user" filled className="mt-0.5 shrink-0 text-[18px] text-secondary" />
              You signed in with a temporary password from your administrator. Choose your own password to open your workspace.
            </div>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <PasswordInput label="Temporary password" value={current} onChange={setCurrent} autoComplete="current-password" placeholder="The one you just used" />
            <NewPasswordFields value={next} confirm={confirm} onChange={setNext} onConfirm={setConfirm} />

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg bg-error-container p-3 text-body-sm text-on-error-container">
                <Icon name="error" className="mt-0.5 shrink-0 text-[18px]" />
                {error}
              </div>
            )}
            {state === "done" && (
              <div role="status" className="flex items-start gap-2 rounded-lg bg-tertiary-container p-3 text-body-sm text-on-tertiary-variant">
                <Icon name="check_circle" filled className="mt-0.5 shrink-0 text-[18px]" />
                Password updated. Opening your workspace...
              </div>
            )}

            <button
              type="submit"
              disabled={state !== "idle"}
              className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-label-md text-white shadow-md transition-colors disabled:cursor-not-allowed ${
                state === "done" ? "bg-tertiary" : "bg-primary-container hover:bg-primary disabled:opacity-70"
              }`}
            >
              {state === "saving" ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-[20px]" />
                  Saving...
                </>
              ) : state === "done" ? (
                <>
                  <Icon name="done" className="text-[20px]" />
                  Saved
                </>
              ) : (
                <>
                  Save and continue
                  <Icon name="arrow_forward" className="text-[20px]" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-center text-body-sm text-on-surface-variant">
        Need help? Contact {ADMIN_CONTACT.name} on{" "}
        <a href={ADMIN_CONTACT.whatsappUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
          WhatsApp
        </a>
        .{" "}
        <button type="button" onClick={logout} className="font-semibold text-primary hover:underline">
          Log out
        </button>
      </p>
    </div>
  );
}
