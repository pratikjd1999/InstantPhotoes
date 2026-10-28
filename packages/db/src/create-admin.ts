import { createDb } from "./client";
import { ensureSuperAdmin, superAdminsFromEnv } from "./admin-user";

// Creates or updates the Super Admins from ADMIN_* (and ADMIN2_*). Does not touch any other data.
const admins = superAdminsFromEnv();
const { db, pool } = createDb();
for (const admin of admins) {
  const result = await ensureSuperAdmin(db, admin);
  console.log(`Super Admin ${result}: ${admin.email.trim().toLowerCase()}`);
}
await pool.end();
