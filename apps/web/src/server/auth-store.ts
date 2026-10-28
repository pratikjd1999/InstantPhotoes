import { timingSafeEqual, createHash } from "node:crypto";
import { authConfig } from "@/config/auth.config";
import type { Session } from "@/lib/session";

// Mutable auth state kept in memory until the database exists.
// A changed admin password lasts until the server restarts, then the config value applies again.
interface AuthState {
  passwordOverride: string | null;
  sessionVersion: number;
  failures: Map<string, { count: number; resetAt: number }>;
}

const g = globalThis as unknown as { __ipAuth2?: AuthState };
function state(): AuthState {
  g.__ipAuth2 ??= { passwordOverride: null, sessionVersion: 1, failures: new Map() };
  return g.__ipAuth2;
}

const digest = (s: string) => createHash("sha256").update(s).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export const currentSessionVersion = () => state().sessionVersion;
export const isSessionCurrent = (s: Session) => s.v === state().sessionVersion;
export const adminPassword = () => state().passwordOverride ?? authConfig.admin.password;

export function checkAdminCredentials(email: string, password: string): boolean {
  const userOk = safeEqual(email.trim().toLowerCase(), authConfig.admin.email.toLowerCase());
  const passOk = safeEqual(password, adminPassword());
  return userOk && passOk;
}

export function verifyAdminPassword(password: string): boolean {
  return safeEqual(password, adminPassword());
}

/** Sets a new password and invalidates every existing session. Returns the new session version. */
export function setAdminPassword(newPassword: string): number {
  const s = state();
  s.passwordOverride = newPassword;
  s.sessionVersion += 1;
  return s.sessionVersion;
}

// ---- login rate limit (AUTH-8) ----
export function rateLimitStatus(key: string): { blocked: boolean; retryAfterSeconds: number } {
  const entry = state().failures.get(key);
  if (!entry || entry.resetAt < Date.now()) return { blocked: false, retryAfterSeconds: 0 };
  const blocked = entry.count >= authConfig.loginRateLimit.maxFailures;
  return { blocked, retryAfterSeconds: blocked ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 0 };
}

export function recordLoginFailure(key: string) {
  const s = state();
  const now = Date.now();
  const entry = s.failures.get(key);
  if (!entry || entry.resetAt < now) {
    s.failures.set(key, { count: 1, resetAt: now + authConfig.loginRateLimit.windowSeconds * 1000 });
  } else {
    entry.count += 1;
  }
}

export const clearLoginFailures = (key: string) => state().failures.delete(key);
