// Client-side helpers that call the auth API. The browser never touches the
// database or passwords directly — it just posts to these endpoints, and the
// session lives in an httpOnly cookie the server sets.

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "Something went wrong." };
  return { ok: true, user: data.user };
}

export function createAccount({ restaurantName, email, password }) {
  return post("/api/auth/signup", { restaurantName, email, password });
}

export function signIn({ email, password }) {
  return post("/api/auth/signin", { email, password });
}

export function signOut() {
  return post("/api/auth/signout", {});
}

export async function fetchCurrentUser() {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.user || null;
}
