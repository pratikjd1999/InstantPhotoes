import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/** Opens a pooled connection. The caller owns `pool.end()` (scripts); servers use `getDb()` instead. */
export function createDb(connectionString = process.env.DATABASE_URL, max = 10) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  // Neon scales to zero, so the first query after a pause can take a couple of seconds.
  const pool = new Pool({ connectionString, max, connectionTimeoutMillis: 20_000, idleTimeoutMillis: 30_000 });
  const db = drizzle(pool, { schema, casing: "snake_case" });
  return { db, pool };
}

// One pool per server process. Kept on globalThis so Next.js dev reloads do not open a new pool each time.
const g = globalThis as unknown as { __ipDb?: Db };

/** The shared database handle for the web app and API. */
export function getDb(): Db {
  g.__ipDb ??= createDb(undefined, 5).db;
  return g.__ipDb;
}
