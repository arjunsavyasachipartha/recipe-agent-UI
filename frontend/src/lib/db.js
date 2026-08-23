import { Pool } from "pg";

// A single shared connection pool for the whole app. In Next.js dev the module
// can be re-evaluated on hot reload, so we stash the pool on globalThis to
// avoid opening a new pool (and leaking connections) every time.
const globalForPool = globalThis;

export const pool =
  globalForPool._bbPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (!globalForPool._bbPool) globalForPool._bbPool = pool;

// Small helper so callers can write `const { rows } = await query(sql, params)`.
export function query(text, params) {
  return pool.query(text, params);
}
