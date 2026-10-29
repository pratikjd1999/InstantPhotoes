import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, ensureSuperAdmin, session, user } from "@instantphotos/db";

// Standalone admin tool (not part of the app). Uses the database package only for the connection and the password hashing,
// so the stored hash is exactly what login checks.
//
// Adds a new Super Admin to the database in DATABASE_URL. The password is typed (hidden) or generated, and never saved to a file.
//
//   npm run db:add-admin -- --email akshay@example.com --name "Akshay"             prompts for the password
//   npm run db:add-admin -- --email akshay@example.com --name "Akshay" --generate  creates a strong password and prints it once
//   add --reset to change the password of an existing Super Admin instead

const USAGE = `Usage: npm run db:add-admin -- --email <email> --name "<name>" [--generate] [--reset]`;

function parseArgs(argv: string[]) {
  const out: { email?: string; name?: string; generate: boolean; reset: boolean } = { generate: false, reset: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email") out.email = argv[++i];
    else if (a === "--name") out.name = argv[++i];
    else if (a === "--generate") out.generate = true;
    else if (a === "--reset") out.reset = true;
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}\n${USAGE}`);
      process.exit(2);
    }
  }
  return out;
}

/** Same rule as the app: 8+ characters with a number or a symbol. */
function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 128) return "Password must be 128 characters or fewer.";
  if (!/[0-9]|[^A-Za-z0-9]/.test(pw)) return "Password must contain a number or a symbol.";
  return null;
}

function generatePassword(): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@%^*-_=+"];
  const all = groups.join("");
  const chars = groups.map((g) => g[randomInt(g.length)]!);
  while (chars.length < 20) chars.push(all[randomInt(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** Reads a line from the terminal without echoing it. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) return reject(new Error("No terminal to type a password into. Run it in a terminal, or use --generate."));
    // Hide input before showing the prompt, so nothing typed straight away is echoed.
    stdin.setRawMode(true);
    process.stdout.write(question);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const args = parseArgs(process.argv.slice(2));
const email = args.email?.trim().toLowerCase() ?? "";
const name = args.name?.trim() ?? "";
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`Give a valid --email.\n${USAGE}`);
  process.exit(2);
}
if (!name) {
  console.error(`Give a --name (shown in the admin area).\n${USAGE}`);
  process.exit(2);
}

const { db, pool } = createDb();
try {
  const [existing] = await db.select({ role: user.role }).from(user).where(eq(user.email, email));
  if (existing && existing.role !== "super_admin") {
    throw new Error(`${email} already belongs to a photographer account. Use a different email.`);
  }
  if (existing && !args.reset) {
    throw new Error(`${email} is already a Super Admin. Add --reset to give it a new password.`);
  }
  if (!existing && args.reset) {
    throw new Error(`${email} is not a Super Admin yet. Leave out --reset to create it.`);
  }

  let password: string;
  if (args.generate) {
    password = generatePassword();
  } else {
    password = await askHidden(`New password for ${email}: `);
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    if ((await askHidden("Type it again: ")) !== password) throw new Error("The passwords don't match.");
  }

  const result = await ensureSuperAdmin(db, { email, name, password });
  if (result === "updated") {
    // A reset password should end every existing login of that admin.
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (u) await db.delete(session).where(eq(session.userId, u.id));
  }
  console.log(`Super Admin ${result === "created" ? "created" : "password reset"}: ${email} (${name})`);
  if (args.generate) {
    console.log(`Password: ${password}`);
    console.log("It is shown only now and stored only as a hash. Share it privately; they can change it under Account.");
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
