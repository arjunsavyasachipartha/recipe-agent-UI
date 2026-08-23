// Applies src/lib/schema.sql to the database in DATABASE_URL.
// Usage: npm run db:migrate
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Load DATABASE_URL from .env.local (this script runs outside Next.js).
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv(file) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* file may not exist — that's fine */
  }
}
loadEnv(".env.local");

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set (check frontend/.env.local).");
  process.exit(1);
}

const sql = readFileSync(join(root, "src", "lib", "schema.sql"), "utf8");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(sql);
  console.log("✓ Schema applied successfully.");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
