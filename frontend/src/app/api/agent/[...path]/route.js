// The BFF (Backend-for-Frontend) proxy — one catch-all route that forwards every
// browser call under /api/agent/* to the deployed FastAPI backend with the
// signed-in restaurant's API key injected server-side. The browser never holds a
// key. This replaces writing ~20 near-identical proxy routes by hand.
//
// GET, POST and DELETE. DELETE arrived with the pantry (V4 P-V Day 1) — the
// first backend route the workspace calls that removes something. It carries no
// body, so it skips the restaurant-id injection below and is otherwise the same
// forward as a GET.
//
// Order of checks (fail closed, cheapest + safest first):
//   1. Signed in?            → 401 if not.
//   2. Path allowlisted?     → 404 if not (the hard boundary: /admin/* is never
//                              listed, so it can never be forwarded).
//   3. Agent registered?     → 409 if this restaurant has no key yet.
//   4. Forward method + query + body with `X-API-Key`.
//   5. Relay the backend's status + body back unchanged.
//
// **V4 P-V Day 11 removed a step 3.** The tier gate held manager-tier paths
// behind a manager-unlocked session. Every manager-tier path belonged to the
// V1/V2 ranking API and was deleted with it, and the gate was then kept on the
// argument that *a gate is easier to keep than to add back*. That argument is
// wrong about this gate: with no path at either tier it could never fire, so it
// was untested code on the security-critical path, and its presence made the
// allowlist look like it expressed a privilege model when the only boundary it
// draws is the list itself. What is left is the boundary that does work —
// **a path not on the list is never forwarded** — and nothing that reads like a
// second one.
//
// The API key is read from the DB, used only as a header, and never logged or
// returned.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { query } from "@/lib/db";
import { isAllowed } from "@/lib/agent/proxy-allowlist";

const AGENT_URL = process.env.RECIPE_AGENT_API_URL;

async function handle(req, ctx, method) {
  // 1. Auth.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Resolve the requested backend path from the catch-all segments.
  const { path: segments } = await ctx.params;
  const path = "/" + (segments || []).join("/");

  // 2. Allowlist. Anything not listed is invisible — a plain 404, no hint that
  //    the path exists on the backend. This is checked BEFORE any DB work so a
  //    non-exposed path (e.g. /admin/restaurants) 404s regardless of the
  //    caller's registration state.
  if (!isAllowed(path)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // 3. Load this restaurant's agent key + backend restaurant id (server-side
  //    only, never sent to the browser).
  const { rows } = await query(
    "SELECT agent_api_key, agent_restaurant_id FROM users WHERE id = $1",
    [user.id]
  );
  const apiKey = rows[0]?.agent_api_key;
  const restaurantId = rows[0]?.agent_restaurant_id;
  if (!apiKey) {
    return NextResponse.json({ error: "Agent not registered." }, { status: 409 });
  }

  if (!AGENT_URL) {
    console.error("agent proxy: RECIPE_AGENT_API_URL not set");
    return NextResponse.json({ error: "Recipe agent is not configured." }, { status: 500 });
  }

  // 4. Forward. Preserve the query string (needed for /v4/search?q=…, etc.).
  const search = new URL(req.url).search;
  const init = { method, headers: { "X-API-Key": apiKey } };
  if (method === "POST") {
    // Several backend request models require a `restaurant_id` even though the
    // handler authoritatively takes the restaurant from the API key (see
    // main.py: `restaurant_id = restaurant.id`). Inject it server-side so the
    // browser never has to know or send a backend id — and can't spoof one.
    const raw = await req.text();
    init.body = injectRestaurantId(raw, restaurantId);
    init.headers["Content-Type"] = "application/json";
  }

  let backendRes;
  try {
    backendRes = await fetch(`${AGENT_URL}${path}${search}`, init);
  } catch (err) {
    console.error("agent proxy: backend unreachable:", err);
    return NextResponse.json({ error: "Couldn't reach the recipe agent." }, { status: 502 });
  }

  // 5. Relay status + body unchanged (JSON pass-through).
  const text = await backendRes.text();
  return new NextResponse(text, {
    status: backendRes.status,
    headers: {
      "Content-Type": backendRes.headers.get("content-type") || "application/json",
    },
  });
}

// Set `restaurant_id` on a JSON object body from the authenticated restaurant.
// Endpoints whose models don't declare it simply ignore the extra field
// (Pydantic defaults to ignoring unknown keys). Non-object bodies pass through
// unchanged.
function injectRestaurantId(raw, restaurantId) {
  if (!restaurantId) return raw;
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parsed.restaurant_id = restaurantId;
      return JSON.stringify(parsed);
    }
  } catch {
    /* not JSON — forward as-is */
  }
  return raw;
}

// How long this function may run before the platform kills it.
//
// Declared rather than left to the default because the default is not one
// number: on Vercel's Hobby plan a function running Fluid compute (now the
// default for new projects) gets 300s, and one with Fluid compute disabled gets
// **10s**, which `POST /v4/generate` does not reliably fit inside -- the load
// measurement is p50 6.5s / p95 7.5s for the composition alone, and a request
// whose sentence box is read by the model adds that round trip on top
// (`RECIPE_AGENT_INTENT_MODEL_TIMEOUT`, 12s by default, with the service
// refusing any deadline under 10s). 60 is valid under both configurations.
//
// The symptom of hitting the 10s ceiling is specific and misleading:
// `GET /v4/search` answers off an in-memory index in milliseconds and works
// perfectly, while Invent fails with **no traceback on the backend** -- because
// the backend never failed. It was still composing when the caller was cut off.
export const maxDuration = 60;

export async function GET(req, ctx) {
  return handle(req, ctx, "GET");
}

export async function POST(req, ctx) {
  return handle(req, ctx, "POST");
}

export async function DELETE(req, ctx) {
  return handle(req, ctx, "DELETE");
}
