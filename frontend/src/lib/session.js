import { cookies } from "next/headers";
import crypto from "node:crypto";
import { query } from "./db";

const COOKIE = "bb_session";
const MAX_AGE_DAYS = 7;

// Create a new server-side session for a user and drop an httpOnly cookie.
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  await query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt]
  );

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

// Read the raw session token from the cookie (server-only), or null.
export async function getSessionToken() {
  const jar = await cookies();
  return jar.get(COOKIE)?.value || null;
}

// Resolve the currently signed-in user from the session cookie, or null.
//
// **V4 P-V Day 11 removed the two manager booleans this used to compute**, and
// `unlockManager` / `lockManager` with them. The manager view they gated — the
// analytics panels and the catalogue review — went with the V1/V2 ranking API,
// so the unlock had nothing to open: the proxy's allowlist has listed no
// manager-tier path since that removal, which means the gate could only ever
// have returned "locked" about nothing.
export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) return null;

  const { rows } = await query(
    `SELECT u.id, u.restaurant_id, u.restaurant_name, u.email,
            (u.agent_api_key IS NOT NULL) AS agent_registered
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] || null;
}

// End the current session: delete the DB row and clear the cookie.
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
    jar.delete(COOKIE);
  }
}
