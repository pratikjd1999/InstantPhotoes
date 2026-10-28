import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type Session } from "@/lib/session";
import { isSessionCurrent } from "./auth-store";

/** For Server Components: the verified, non-revoked session or null. */
export async function getServerSession(): Promise<Session | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  return session && isSessionCurrent(session) ? session : null;
}
