"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_CONTACT } from "@/lib/contact";
import { EyeIcon, EyeOffIcon } from "./icons";

// Logs in through POST /api/auth/login. Accounts and passwords live in the database.
export function LoginCard() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wake the database in the background as soon as the landing page loads. Neon pauses when idle and the first query
  // takes 1–2 s, which would otherwise land on the login button. The result doesn't matter, so failures are ignored.
  useEffect(() => {
    fetch("/api/health", { cache: "no-store", keepalive: true }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok || !data.redirect) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(data.redirect);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-2xl border-2 border-wine/40 bg-white p-6 shadow-xl shadow-stone-200/60 sm:p-8">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Log in</h2>
        <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">Photographers and admins</p>
      </div>

      <div aria-live="polite">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@studio.com"
            className="w-full rounded-xl border border-line bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition hover:bg-white focus:border-wine focus:bg-white focus:ring-4 focus:ring-wine/10"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-700"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="w-full rounded-xl border border-line bg-gray-50/50 py-2.5 pl-3.5 pr-10 text-sm text-gray-900 outline-none transition hover:bg-white focus:border-wine focus:bg-white focus:ring-4 focus:ring-wine/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-wine"
            >
              {showPassword ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              aria-expanded={showForgot}
              aria-controls="forgot-help"
              className="text-xs font-semibold text-wine transition-colors hover:text-wine-dark hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {showForgot && (
            <div
              id="forgot-help"
              className="mt-2 rounded-lg border border-brass/40 bg-parchment p-2.5 text-xs text-wine"
            >
              Contact the admin to reset your password.{" "}
              <span className="font-bold text-gray-900">
                {ADMIN_CONTACT.name}, {ADMIN_CONTACT.phoneDisplay}
              </span>
              .
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-brass/30 bg-wine px-4 py-2.5 text-sm font-semibold text-cream shadow-md shadow-wine/25 transition-all duration-150 hover:bg-wine-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-90"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          <span>{loading ? "Logging in..." : "Log in"}</span>
        </button>
      </form>
    </div>
  );
}
