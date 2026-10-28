import { Hono, type Context, type Next } from "hono";
import {
  DomainError,
  clearLoginFailures,
  clearMustChangePassword,
  createPhotographer,
  deleteGuest,
  getAuthUser,
  getUsage,
  homeForRole,
  listEvents,
  listPhotographers,
  rateLimitStatus,
  recordLoginFailure,
  resetPhotographerPassword,
  revokeUserSessions,
  searchGuests,
  setPhotographerStatus,
  verifyCredentialPassword,
  type AuthUser,
} from "@instantphotos/core";
import { auth } from "./auth";

type Env = { Variables: { user: AuthUser } };

export const api = new Hono<Env>().basePath("/api");

async function readBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * True for a Better Auth "request rejected" error (wrong password, unknown email, ...), as opposed to a crash.
 * Checked by shape, not `instanceof`: proxy.ts and the API route are bundled separately, so each has its own APIError class.
 */
const isAuthRejection = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { name?: string }).name === "APIError" && Number((err as { statusCode?: number }).statusCode) < 500;

/** Copies the cookies Better Auth wants to set (login, logout, rotated session) onto our response. */
function forwardCookies(c: Context, from: Headers) {
  for (const cookie of from.getSetCookie()) c.header("set-cookie", cookie, { append: true });
}

// ---- role guards (AUTH-9, AUTH-10, AUTH-11): enforced on the server, against the database, not by hiding links ----
async function requireSession(c: Context<Env>, next: Next) {
  // Always the database, never the session cache: a suspended account or revoked session must stop working at once.
  const result = await auth.api.getSession({ headers: c.req.raw.headers, query: { disableCookieCache: true } });
  const u = result?.user as unknown as AuthUser | undefined;
  if (!u || u.status !== "active") return c.json({ error: "Please log in." }, 401);
  c.set("user", { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, mustChangePassword: u.mustChangePassword });
  await next();
}

async function requireSuperAdmin(c: Context<Env>, next: Next) {
  if (c.get("user").role !== "super_admin") return c.json({ error: "Not allowed." }, 403);
  await next();
}

// ---- auth ----
api.post("/auth/login", async (c) => {
  const body = await readBody(c);
  const key = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  const limit = await rateLimitStatus(key);
  if (limit.blocked) {
    c.header("Retry-After", String(limit.retryAfterSeconds));
    return c.json({ error: "Too many attempts. Try again in a few minutes." }, 429);
  }

  const email = str(body.email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: "Enter a valid email address." }, 400);

  let signedIn;
  try {
    signedIn = await auth.api.signInEmail({
      body: { email, password: str(body.password) },
      headers: c.req.raw.headers,
      returnHeaders: true,
    });
  } catch (err) {
    if (isAuthRejection(err)) {
      await recordLoginFailure(key);
      return c.json({ error: "Incorrect email or password." }, 401);
    }
    throw err;
  }

  const user = await getAuthUser(signedIn.response.user.id);
  if (!user) return c.json({ error: "Incorrect email or password." }, 401);
  if (user.status !== "active") {
    await revokeUserSessions(user.id);
    return c.json({ error: "This account is suspended. Contact the administrator." }, 403);
  }

  await clearLoginFailures(key);
  forwardCookies(c, signedIn.headers);
  return c.json({ role: user.role, mustChangePassword: user.mustChangePassword, redirect: homeForRole(user.role) });
});

api.post("/auth/logout", async (c) => {
  try {
    const out = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
    forwardCookies(c, out.headers);
  } catch {
    // Already logged out: nothing to clear.
  }
  return c.json({ ok: true });
});

api.get("/auth/me", requireSession, (c) => {
  const { id, name, role } = c.get("user");
  return c.json({ id, role, name });
});

api.post("/auth/change-password", requireSession, async (c) => {
  const user = c.get("user");
  const body = await readBody(c);
  const current = str(body.currentPassword);
  const next = str(body.newPassword);

  if (!(await verifyCredentialPassword(user.id, current))) {
    return c.json({ error: "Incorrect current password. Please verify and try again." }, 400);
  }
  if (next.length < 8) return c.json({ error: "New password must be at least 8 characters." }, 400);
  if (next === current) return c.json({ error: "New password must be different from the current one." }, 400);

  // Other logins are revoked; this one gets a fresh session so the user stays signed in.
  const changed = await auth.api.changePassword({
    body: { currentPassword: current, newPassword: next, revokeOtherSessions: true },
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  await clearMustChangePassword(user.id);
  forwardCookies(c, changed.headers);
  return c.json({ ok: true });
});

// ---- admin (role: super_admin) ----
const admin = new Hono<Env>();
admin.use("*", requireSession, requireSuperAdmin);

admin.get("/photographers", async (c) => c.json({ photographers: await listPhotographers() }));

admin.post("/photographers", async (c) => {
  const body = await readBody(c);
  const photographer = await createPhotographer({
    name: str(body.name),
    email: str(body.email),
    phone: str(body.phone),
    studioName: str(body.studioName),
    temporaryPassword: str(body.temporaryPassword),
  });
  return c.json({ photographer }, 201);
});

admin.patch("/photographers/:id", async (c) => {
  const body = await readBody(c);
  const status = str(body.status);
  if (status !== "active" && status !== "suspended") return c.json({ error: "Invalid status." }, 400);
  return c.json({ photographer: await setPhotographerStatus(c.req.param("id"), status) });
});

admin.post("/photographers/:id/reset-password", async (c) => {
  const body = await readBody(c);
  return c.json({ photographer: await resetPhotographerPassword(c.req.param("id"), str(body.temporaryPassword)) });
});

admin.get("/events", async (c) => c.json({ events: await listEvents() }));
admin.get("/usage", async (c) => c.json(await getUsage()));
admin.get("/guests", async (c) => c.json({ guests: await searchGuests(c.req.query("phone") ?? "") }));
admin.delete("/guests/:id", async (c) => {
  await deleteGuest(c.req.param("id"));
  return c.json({ ok: true });
});

api.route("/admin", admin);

api.onError((err, c) => {
  if (err instanceof DomainError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong." }, 500);
});

api.notFound((c) => c.json({ error: "Not found." }, 404));
