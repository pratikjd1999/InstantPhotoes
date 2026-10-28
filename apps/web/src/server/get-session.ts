import { headers } from "next/headers";
import type { AuthUser } from "@instantphotos/core";
import { auth } from "./auth";

/** The signed-in user, checked against the database (not the cookie cache). Null if logged out or suspended. */
export async function getServerSession(): Promise<AuthUser | null> {
  const result = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  if (!result) return null;
  const u = result.user as unknown as AuthUser;
  return u.status === "active" ? { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, mustChangePassword: u.mustChangePassword } : null;
}
