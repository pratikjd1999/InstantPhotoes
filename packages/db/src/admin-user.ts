import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import type { Db } from "./client";
import { account, user } from "./schema";

export interface SuperAdminInput {
  email: string;
  password: string;
  name: string;
}

/** Creates the Super Admin, or resets its password and name if the email already exists. Safe to re-run. */
export async function ensureSuperAdmin(db: Db, input: SuperAdminInput): Promise<"created" | "updated"> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address.");
  if (input.password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing) {
      await tx.update(user).set({ name: input.name, role: "super_admin", status: "active", mustChangePassword: false, updatedAt: new Date() }).where(eq(user.id, existing.id));
      await tx.update(account).set({ password: passwordHash, updatedAt: new Date() }).where(eq(account.userId, existing.id));
      return "updated" as const;
    }
    const id = randomUUID();
    await tx.insert(user).values({ id, name: input.name, email, emailVerified: true, role: "super_admin" });
    await tx.insert(account).values({ id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: passwordHash });
    return "created" as const;
  });
}

/**
 * Super Admins from the environment: ADMIN_* is required, ADMIN2_* is optional (a second admin).
 * Passwords stay in .env.local, never in code.
 */
export function superAdminsFromEnv(): SuperAdminInput[] {
  const read = (prefix: "ADMIN" | "ADMIN2", fallbackName: string): SuperAdminInput | null => {
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];
    if (!email && !password) return null;
    if (!email || !password) throw new Error(`Set both ${prefix}_EMAIL and ${prefix}_PASSWORD in .env.local.`);
    return { email, password, name: process.env[`${prefix}_DISPLAY_NAME`] || fallbackName };
  };
  const primary = read("ADMIN", "Super Admin");
  if (!primary) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local first.");
  return [primary, read("ADMIN2", "Super Admin 2")].filter((a): a is SuperAdminInput => a !== null);
}
