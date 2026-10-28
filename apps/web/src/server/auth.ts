import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { account, getDb, session, user, verification } from "@instantphotos/db";

// Better Auth owns passwords and sessions; both live in the database (user, account, session tables).
// Its HTTP handler is deliberately not mounted: every auth call goes through our own routes in server/api.ts,
// so sign-up and the other built-in endpoints are not reachable from outside.
function create() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } }),
    // Required in production; development falls back to Better Auth's built-in dev value.
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 128 },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "photographer" },
        status: { type: "string", input: false, defaultValue: "active" },
        mustChangePassword: { type: "boolean", input: false, defaultValue: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 8, // 8 hours, absolute (updateAge stays longer than this, so the session never extends itself)
      // Lets proxy.ts route by role without a database call. Guards that change data re-check the database.
      cookieCache: { enabled: true, maxAge: 60 },
    },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
  });
}

const g = globalThis as unknown as { __ipAuth?: ReturnType<typeof create> };
export const auth = (g.__ipAuth ??= create());
