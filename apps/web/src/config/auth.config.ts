// Temporary login config until the database and Better Auth are in place (Phase 1).
//
// The only account right now is the Super Admin. There are no photographer accounts.
// Values can be overridden with environment variables (copy apps/web/.env.example to .env.local).
// The fallbacks below are for local development only: a production server refuses to use them.
//
// Values are read lazily (getters) so `next build` does not need them; the check runs when the server first uses them.

function value(name: string, devFallback: string): string {
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} must be set in production.`);
  return devFallback;
}

export const authConfig = {
  admin: {
    /** The admin logs in with this email address and the password below. */
    get email() {
      return value("ADMIN_EMAIL", "admin@instantphotos.local");
    },
    get password() {
      return value("ADMIN_PASSWORD", "admin@123");
    },
    get displayName() {
      return process.env.ADMIN_DISPLAY_NAME || "Pratik";
    },
  },
  session: {
    /** Signs the session cookie. Change it to log everyone out. */
    get secret() {
      return value("SESSION_SECRET", "dev-only-secret-change-me-please-0123456789");
    },
    maxAgeSeconds: 60 * 60 * 8,
  },
  loginRateLimit: { maxFailures: 5, windowSeconds: 15 * 60 },
};
