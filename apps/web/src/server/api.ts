import { Hono, type Context, type Next } from "hono";
import {
  DomainError,
  clearLoginFailures,
  MAX_PHOTO_BYTES,
  brandingUploadUrl,
  clearMustChangePassword,
  completeUploads,
  contentDisposition,
  createEvent,
  createPhotographer,
  createUploads,
  deleteEvent,
  deleteGuest,
  deletePhotos,
  getAuthUser,
  getDashboard,
  getMyEvent,
  getProfile,
  getStorage,
  getUsage,
  guestMatchedPhotos,
  homeForRole,
  listEventGuests,
  listEvents,
  listMyEvents,
  listPhotographers,
  listPhotos,
  localRead,
  localWrite,
  originalDownloadUrls,
  passwordProblem,
  pingDatabase,
  rateLimitStatus,
  recordLoginFailure,
  reportUploadFailures,
  resetPhotographerPassword,
  retryPhoto,
  revokeUserSessions,
  searchGuests,
  setBranding,
  setPhotographerStatus,
  updateEvent,
  updateProfile,
  verifyCredentialPassword,
  verifyLocalSignature,
  type AuthUser,
  type BrandingKind,
  type PhotoFilter,
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

async function requirePhotographer(c: Context<Env>, next: Next) {
  const user = c.get("user");
  if (user.role !== "photographer") return c.json({ error: "Not allowed." }, 403);
  // AUTH-4: a temporary password must be replaced before anything else.
  if (user.mustChangePassword) return c.json({ error: "Set a new password first.", code: "must_change_password" }, 403);
  await next();
}

const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// ---- health: also used by the landing page to wake the database before someone logs in ----
api.get("/health", async (c) => {
  c.header("Cache-Control", "no-store");
  try {
    await pingDatabase();
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

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
  const redirect = user.mustChangePassword ? "/change-password" : homeForRole(user.role);
  return c.json({ role: user.role, mustChangePassword: user.mustChangePassword, redirect });
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
  const problem = passwordProblem(next);
  if (problem) return c.json({ error: problem }, 400);
  if (next === current) return c.json({ error: "New password must be different from the current one." }, 400);

  // Other logins are revoked; this one gets a fresh session so the user stays signed in.
  const changed = await auth.api.changePassword({
    body: { currentPassword: current, newPassword: next, revokeOtherSessions: true },
    headers: c.req.raw.headers,
    returnHeaders: true,
  });
  await clearMustChangePassword(user.id);
  forwardCookies(c, changed.headers);
  return c.json({ ok: true, redirect: homeForRole(user.role) });
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

// ---- photographer (role: photographer, own data only; ownership is checked inside every core function) ----
const studio = new Hono<Env>();
// Guard only the photographer paths: this sub-app is mounted at the API root, so "*" would also cover login and storage.
for (const path of ["/me/*", "/events", "/events/*", "/photos/*"]) studio.use(path, requireSession, requirePhotographer);
const me = (c: Context<Env>) => c.get("user").id;

studio.get("/me/dashboard", async (c) => c.json(await getDashboard(me(c))));
studio.get("/me/profile", async (c) => c.json({ profile: await getProfile(me(c)) }));
studio.patch("/me/profile", async (c) => {
  const b = await readBody(c);
  const profile = await updateProfile(me(c), {
    studioName: str(b.studioName),
    displayName: str(b.displayName),
    phone: str(b.phone),
    website: str(b.website),
    instagram: str(b.instagram),
  });
  return c.json({ profile });
});
studio.post("/me/profile/branding-upload-url", async (c) => {
  const b = await readBody(c);
  return c.json(await brandingUploadUrl(me(c), str(b.kind) as BrandingKind, str(b.contentType), Number(b.size)));
});
studio.put("/me/profile/branding", async (c) => {
  const b = await readBody(c);
  const key = b.key === null ? null : str(b.key);
  return c.json({ profile: await setBranding(me(c), str(b.kind) as BrandingKind, key) });
});

studio.get("/events", async (c) => c.json({ events: await listMyEvents(me(c)) }));
studio.post("/events", async (c) => {
  const b = await readBody(c);
  const event = await createEvent(me(c), {
    name: str(b.name),
    eventDate: str(b.eventDate),
    venue: str(b.venue),
    galleryExpiresAt: str(b.galleryExpiresAt),
  });
  return c.json({ event }, 201);
});
studio.get("/events/:id", async (c) => c.json({ event: await getMyEvent(me(c), c.req.param("id")) }));
studio.patch("/events/:id", async (c) => {
  const b = await readBody(c);
  const patch: Record<string, string> = {};
  for (const k of ["name", "eventDate", "venue", "galleryExpiresAt", "status"]) if (typeof b[k] === "string") patch[k] = b[k] as string;
  return c.json({ event: await updateEvent(me(c), c.req.param("id"), patch) });
});
studio.delete("/events/:id", async (c) => {
  await deleteEvent(me(c), c.req.param("id"));
  return c.json({ ok: true });
});

studio.get("/events/:id/photos", async (c) => {
  const filter = (c.req.query("filter") ?? "all") as PhotoFilter;
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  return c.json(await listPhotos(me(c), c.req.param("id"), filter, page));
});
studio.post("/events/:id/uploads", async (c) => {
  const b = await readBody(c);
  const files = Array.isArray(b.files) ? (b.files as { name: string; size: number; type: string }[]) : [];
  return c.json(await createUploads(me(c), c.req.param("id"), files));
});
studio.post("/events/:id/uploads/complete", async (c) => {
  const b = await readBody(c);
  return c.json(await completeUploads(me(c), c.req.param("id"), ids(b.photoIds)));
});
studio.post("/events/:id/uploads/failed", async (c) => {
  const b = await readBody(c);
  await reportUploadFailures(me(c), c.req.param("id"), ids(b.photoIds));
  return c.json({ ok: true });
});
studio.post("/events/:id/photos/delete", async (c) => {
  const b = await readBody(c);
  return c.json({ deleted: await deletePhotos(me(c), c.req.param("id"), ids(b.photoIds)) });
});
studio.post("/photos/:id/retry", async (c) => {
  await retryPhoto(me(c), c.req.param("id"));
  return c.json({ ok: true });
});
studio.get("/events/:id/guests", async (c) => c.json({ guests: await listEventGuests(me(c), c.req.param("id")) }));
studio.get("/events/:id/guests/:guestId/photos", async (c) =>
  c.json(await guestMatchedPhotos(me(c), c.req.param("id"), c.req.param("guestId"))),
);
studio.post("/events/:id/originals/download-urls", async (c) => {
  const b = await readBody(c);
  return c.json(await originalDownloadUrls(me(c), c.req.param("id"), ids(b.photoIds)));
});

api.route("/", studio);

// ---- local file storage (development only; R2 replaces this when configured) ----
// Access is granted by the signed URL itself, exactly like an R2 presigned URL, so no session is needed here.
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const storageKey = (c: Context) => decodeURIComponent(c.req.path.replace(/^\/api\/storage\//, ""));

api.put("/storage/*", async (c) => {
  if (getStorage().driver !== "local") return c.json({ error: "Not found." }, 404);
  const key = storageKey(c);
  if (!verifyLocalSignature("PUT", key, new URL(c.req.url).searchParams)) return c.json({ error: "Link expired or invalid." }, 403);
  if (Number(c.req.header("content-length") ?? 0) > MAX_PHOTO_BYTES) return c.json({ error: "File too large." }, 413);
  const data = new Uint8Array(await c.req.arrayBuffer());
  if (data.byteLength > MAX_PHOTO_BYTES) return c.json({ error: "File too large." }, 413);
  await localWrite(key, data);
  return c.body(null, 200);
});

api.get("/storage/*", async (c) => {
  if (getStorage().driver !== "local") return c.json({ error: "Not found." }, 404);
  const key = storageKey(c);
  const params = new URL(c.req.url).searchParams;
  if (!verifyLocalSignature("GET", key, params)) return c.json({ error: "Link expired or invalid." }, 403);
  const data = await localRead(key);
  if (!data) return c.json({ error: "Not found." }, 404);
  const name = params.get("name");
  c.header("Content-Type", TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream");
  c.header("Cache-Control", "private, max-age=3600");
  if (name) c.header("Content-Disposition", contentDisposition(name));
  return c.body(data as unknown as ArrayBuffer);
});

api.onError((err, c) => {
  if (err instanceof DomainError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Something went wrong." }, 500);
});

api.notFound((c) => c.json({ error: "Not found." }, 404));
