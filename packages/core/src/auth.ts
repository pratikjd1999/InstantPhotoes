import { and, eq, sql } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { account, getDb, loginAttempts, session, user } from "@instantphotos/db";

// Database-backed helpers around authentication. Login itself (passwords, sessions) is handled by Better Auth in apps/web.

export const LOGIN_RATE_LIMIT = { maxFailures: 5, windowSeconds: 15 * 60 };

export type Role = "super_admin" | "photographer";
export type AccountStatus = "active" | "suspended";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  mustChangePassword: boolean;
}

/** One password rule for every account (first login, profile, admin account). */
export const PASSWORD_RULES = { minLength: 8 };
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_RULES.minLength) return "New password must be at least 8 characters.";
  if (pw.length > 128) return "New password must be 128 characters or fewer.";
  if (!/[0-9]|[^A-Za-z0-9]/.test(pw)) return "New password must contain a number or a symbol.";
  return null;
}

/** Runs a trivial query. Wakes the database if it was paused (Neon scales to zero when idle). */
export async function pingDatabase(): Promise<void> {
  await getDb().execute(sql`select 1`);
}

export const homeForRole = (role: Role) => (role === "super_admin" ? "/admin" : "/dashboard");

export async function getAuthUser(id: string): Promise<AuthUser | null> {
  const [row] = await getDb()
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, mustChangePassword: user.mustChangePassword })
    .from(user)
    .where(eq(user.id, id));
  return row ?? null;
}

/** Ends every login of this user (used on suspension and password reset). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await getDb().delete(session).where(eq(session.userId, userId));
}

/** True when `password` matches the user's stored password (used to confirm the current password before a change). */
export async function verifyCredentialPassword(userId: string, password: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ hash: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  return row?.hash ? verifyPassword({ hash: row.hash, password }) : false;
}

/** Called after the user chooses their own password, so the temporary-password prompt stops. */
export async function clearMustChangePassword(userId: string): Promise<void> {
  await getDb().update(user).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(user.id, userId));
}

// ---- login rate limit (AUTH-8): failures per client key inside a time window ----
export async function rateLimitStatus(key: string): Promise<{ blocked: boolean; retryAfterSeconds: number }> {
  const [row] = await getDb().select().from(loginAttempts).where(eq(loginAttempts.key, key));
  if (!row || row.resetAt.getTime() < Date.now()) return { blocked: false, retryAfterSeconds: 0 };
  const blocked = row.count >= LOGIN_RATE_LIMIT.maxFailures;
  return { blocked, retryAfterSeconds: blocked ? Math.ceil((row.resetAt.getTime() - Date.now()) / 1000) : 0 };
}

export async function recordLoginFailure(key: string): Promise<void> {
  const resetAt = new Date(Date.now() + LOGIN_RATE_LIMIT.windowSeconds * 1000);
  await getDb()
    .insert(loginAttempts)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`case when ${loginAttempts.resetAt} < now() then 1 else ${loginAttempts.count} + 1 end`,
        resetAt: sql`case when ${loginAttempts.resetAt} < now() then ${resetAt.toISOString()}::timestamptz else ${loginAttempts.resetAt} end`,
      },
    });
}

export async function clearLoginFailures(key: string): Promise<void> {
  await getDb().delete(loginAttempts).where(eq(loginAttempts.key, key));
}
