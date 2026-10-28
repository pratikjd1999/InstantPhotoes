import { Hono, type Context, type Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  DomainError,
  createPhotographer,
  deleteGuest,
  getUsage,
  listEvents,
  listPhotographers,
  resetPhotographerPassword,
  searchGuests,
  setPhotographerStatus,
} from "@instantphotos/core";
import { authConfig } from "@/config/auth.config";
import { SESSION_COOKIE, homeForRole, signSession, verifySession, type Session } from "@/lib/session";
import {
  checkAdminCredentials,
  clearLoginFailures,
  currentSessionVersion,
  isSessionCurrent,
  rateLimitStatus,
  recordLoginFailure,
  setAdminPassword,
  verifyAdminPassword,
} from "./auth-store";

type Env = { Variables: { session: Session } };

export const api = new Hono<Env>().basePath("/api");

const cookieOptions = {
  httpOnly: true,
  sameSite: "Lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: authConfig.session.maxAgeSeconds,
};

async function readBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function issueSession(c: Context, session: Pick<Session, "sub" | "role" | "name" | "v">) {
  setCookie(c, SESSION_COOKIE, await signSession(session), cookieOptions);
}

// ---- role guards (AUTH-9, AUTH-10, AUTH-11): enforced on the server, not by hiding links ----
async function requireSession(c: Context<Env>, next: Next) {
  const session = await verifySession(getCookie(c, SESSION_COOKIE));
  if (!session || !isSessionCurrent(session)) return c.json({ error: "Please log in." }, 401);
  c.set("session", session);
  await next();
}

async function requireSuperAdmin(c: Context<Env>, next: Next) {
  if (c.get("session").role !== "super_admin") return c.json({ error: "Not allowed." }, 403);
  await next();
}

// ---- auth ----
api.post("/auth/login", async (c) => {
  const body = await readBody(c);
  const key = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  const limit = rateLimitStatus(key);
  if (limit.blocked) {
    c.header("Retry-After", String(limit.retryAfterSeconds));
    return c.json({ error: "Too many attempts. Try again in a few minutes." }, 429);
  }

  const email = str(body.email).trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: "Enter a valid email address." }, 400);

  if (!checkAdminCredentials(email, str(body.password))) {
    recordLoginFailure(key);
    return c.json({ error: "Incorrect email or password." }, 401);
  }

  clearLoginFailures(key);
  await issueSession(c, {
    sub: "admin",
    role: "super_admin",
    name: authConfig.admin.displayName,
    v: currentSessionVersion(),
  });
  return c.json({ role: "super_admin", redirect: homeForRole("super_admin") });
});

api.post("/auth/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

api.get("/auth/me", requireSession, (c) => {
  const { sub, role, name } = c.get("session");
  return c.json({ id: sub, role, name });
});

api.post("/auth/change-password", requireSession, async (c) => {
  const session = c.get("session");
  if (session.role !== "super_admin") return c.json({ error: "Not allowed." }, 403);

  const body = await readBody(c);
  const current = str(body.currentPassword);
  const next = str(body.newPassword);

  if (!verifyAdminPassword(current)) return c.json({ error: "Incorrect current password. Please verify and try again." }, 400);
  if (next.length < 8) return c.json({ error: "New password must be at least 8 characters." }, 400);
  if (next === current) return c.json({ error: "New password must be different from the current one." }, 400);

  // Other sessions are revoked by bumping the version; this one is re-issued so the admin stays logged in.
  const v = setAdminPassword(next);
  await issueSession(c, { sub: session.sub, role: session.role, name: session.name, v });
  return c.json({ ok: true });
});

// ---- admin (role: super_admin) ----
const admin = new Hono<Env>();
admin.use("*", requireSession, requireSuperAdmin);

admin.get("/photographers", (c) => c.json({ photographers: listPhotographers() }));

admin.post("/photographers", async (c) => {
  const body = await readBody(c);
  const photographer = createPhotographer({
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
  return c.json({ photographer: setPhotographerStatus(c.req.param("id"), status) });
});

admin.post("/photographers/:id/reset-password", async (c) => {
  const body = await readBody(c);
  return c.json({ photographer: resetPhotographerPassword(c.req.param("id"), str(body.temporaryPassword)) });
});

admin.get("/events", (c) => c.json({ events: listEvents() }));
admin.get("/usage", (c) => c.json(getUsage()));
admin.get("/guests", (c) => c.json({ guests: searchGuests(c.req.query("phone") ?? "") }));
admin.delete("/guests/:id", (c) => {
  deleteGuest(c.req.param("id"));
  return c.json({ ok: true });
});

api.route("/admin", admin);

api.onError((err, c) => {
  if (err instanceof DomainError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong." }, 500);
});

api.notFound((c) => c.json({ error: "Not found." }, 404));
