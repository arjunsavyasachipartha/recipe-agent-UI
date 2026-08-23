// The browser-side entry point for every backend call in the agent workspace.
// Components never hand-write `fetch` — they call agentGet / agentPost, which hit
// the same-origin BFF proxy (`/api/agent/...`). The proxy injects the
// restaurant's API key server-side, so no key ever reaches the browser.
//
// Both wrappers normalize the outcome to a single shape so callers can branch on
// one thing instead of juggling try/catch + res.ok + res.json():
//
//   { ok: boolean, data: any|null, error: string|null, status: number }
//
// `status` is the backend's HTTP status (0 on a network failure) so callers /
// the shared error renderer (Phase VI) can map 401/403/404/409/503 to messages.

async function normalize(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      data: null,
      error: data.error || data.detail || `Request failed (${res.status}).`,
      status: res.status,
    };
  }
  return { ok: true, data, error: null, status: res.status };
}

// Drop undefined/null params so we don't send "?x=undefined".
function toQuery(params) {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") usp.append(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// DELETE /api/agent<path>. No body — the id is in the path, which is the one
// shape a browser, a curl and a retry all agree on.
export async function agentDelete(path) {
  let res;
  try {
    res = await fetch(`/api/agent${path}`, { method: "DELETE" });
  } catch {
    return { ok: false, data: null, error: "Network error — check your connection.", status: 0 };
  }
  return normalize(res);
}

// GET /api/agent<path>?<params>. `path` must start with "/" (e.g. "/health").
export async function agentGet(path, params) {
  let res;
  try {
    res = await fetch(`/api/agent${path}${toQuery(params)}`, { cache: "no-store" });
  } catch {
    return { ok: false, data: null, error: "Network error — check your connection.", status: 0 };
  }
  return normalize(res);
}

// POST /api/agent<path> with a JSON body.
export async function agentPost(path, body) {
  let res;
  try {
    res = await fetch(`/api/agent${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, data: null, error: "Network error — check your connection.", status: 0 };
  }
  return normalize(res);
}
