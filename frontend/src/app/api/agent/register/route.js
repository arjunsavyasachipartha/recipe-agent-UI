// Provisions a Recipe Agent API key for the signed-in restaurant.
//
// This is the server side of the "first-time registration" modal. It:
//   1. confirms the caller is signed in (session cookie),
//   2. calls the agent backend's POST /admin/restaurant — sending the ADMIN key
//      from the server env, which the browser never sees,
//   3. stores the returned api_key + restaurant_id (and the details the user
//      gave) on the users row, so future visits skip the modal.
//
// Idempotent: if this restaurant already has an agent_api_key we return early
// without creating a duplicate restaurant on the backend.
//
// ## V4 P-V Day 11 — this route was broken, and that is why the day owns it
//
// It was not a tidy-up. `GET /admin/kitchens` and the `synthesis_kitchen_id`
// this route required were **deleted by P-I Day 8**, when V4 abolished the
// kitchen binding — so the modal's kitchen list 404'd, the required field could
// never be filled, and **no new account could provision a key at all**. Days
// 3-9 of this phase were verified against an account whose key was inserted
// into the database by hand. Anyone opening the workspace on a clean database
// hit this first.
//
// What the backend takes now is a name, a city, a state and an email. It still
// *accepts* `synthesis_kitchen_id`, `venue_type` and `specialty_tags` — dropping
// each and naming it in `warnings`, so that a client which has not shipped the
// V4 form is not 422'd — and this route no longer sends any of the three.
//
// ## The venue kind the plan asked for is not here
//
// Phase 5 Day 11's brief is *"simplify the registration modal to name, city and
// venue kind"*, and the third one is not asked. The reason is in
// `RegisterModal.js`: this modal runs **before** the account has a key, so it
// cannot reach `GET /v4/options`, so its venue list would have to be the
// hand-written copy in `agentOptions.js` — which offers **8 of the registry's
// 15** and would file a bakery under *Specialty*. The control that can read the
// registry already exists on the request screen and remembers its last answer.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { query } from "@/lib/db";

const AGENT_URL = process.env.RECIPE_AGENT_API_URL;
const ADMIN_KEY = process.env.RECIPE_AGENT_ADMIN_KEY;

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Already provisioned — nothing to do. Guards against double-submits and a
  // stale modal, and avoids creating duplicate restaurants on the backend.
  if (user.agent_registered) {
    return NextResponse.json({ ok: true, alreadyRegistered: true });
  }

  if (!AGENT_URL || !ADMIN_KEY) {
    console.error("agent register: RECIPE_AGENT_API_URL / RECIPE_AGENT_ADMIN_KEY not set");
    return NextResponse.json(
      { error: "Recipe agent is not configured on the server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const city = (body.city || "").trim() || null;
  const state = (body.state || "").trim() || null;

  // Location is recorded and drives nothing: the weather lookup and the one-time
  // ingredient price estimate that used to read it both belonged to the ranking
  // API. Synthesis takes the weather on each request instead, because a chef
  // planning Thursday knows more about Thursday than a forecast API does. It is
  // still asked because the backend's account record has the two columns and an
  // account with no location is one nobody can tell apart in a support queue.
  if (!city || !state) {
    return NextResponse.json(
      { error: "Please tell us where your restaurant is (state and city)." },
      { status: 400 }
    );
  }

  // Ask the agent backend to create a restaurant and mint an API key. Four
  // fields, all of which the backend stores. No kitchen, no venue type, no
  // specialty tags — see the note at the top of this file.
  let agentRes;
  try {
    agentRes = await fetch(`${AGENT_URL}/admin/restaurant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({
        name: user.restaurant_name,
        email: user.email,
        city,
        state,
      }),
    });
  } catch (err) {
    // Reaching here almost always means RECIPE_AGENT_API_URL points somewhere
    // the server can't reach (e.g. a stale localhost value) or the backend is
    // down. Log the target so the misconfiguration is obvious.
    console.error(`agent register: backend unreachable at ${AGENT_URL}:`, err);
    return NextResponse.json(
      { error: "Couldn't reach the recipe agent. Please try again." },
      { status: 502 }
    );
  }

  if (!agentRes.ok) {
    const detail = await agentRes.text().catch(() => "");
    console.error("agent register: backend error", agentRes.status, detail);
    // A 401 here means RECIPE_AGENT_ADMIN_KEY doesn't match the backend's
    // ADMIN_API_KEY — a server misconfiguration, not a user error. Surface the
    // backend status so the cause is visible instead of an opaque 502.
    const msg =
      agentRes.status === 401
        ? "The recipe agent rejected the admin key (server misconfiguration). " +
          "Check RECIPE_AGENT_ADMIN_KEY on the deployment."
        : "The recipe agent rejected the registration. Please try again.";
    return NextResponse.json(
      { error: msg, backendStatus: agentRes.status },
      { status: 502 }
    );
  }

  const data = await agentRes.json().catch(() => ({}));
  if (!data.api_key || !data.restaurant_id) {
    console.error("agent register: unexpected backend response", data);
    return NextResponse.json(
      { error: "The recipe agent returned an unexpected response." },
      { status: 502 }
    );
  }

  // Persist the credential. We only ever return a boolean to the client from
  // here on — the api_key stays in the DB. The city and state are not copied
  // here: the backend's account record holds them, and a second copy that
  // nothing reads is a second copy that goes stale.
  try {
    await query(
      `UPDATE users
          SET agent_restaurant_id = $1,
              agent_api_key       = $2,
              agent_registered_at = now()
        WHERE id = $3`,
      [data.restaurant_id, data.api_key, user.id]
    );
  } catch (err) {
    console.error("agent register: failed to store credential:", err);
    return NextResponse.json(
      { error: "Registered, but couldn't save it. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
