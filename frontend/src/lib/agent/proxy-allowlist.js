// The single audited list of backend paths the browser is allowed to reach
// through the BFF proxy (`src/app/api/agent/[...path]/route.js`). This is the
// hard security boundary: any path NOT listed here is never forwarded (the proxy
// 404s it), so `/admin/*` — account creation, key rotation — can never be called
// from the browser.
//
// A pattern segment beginning with ":" matches any single path segment
// (e.g. "/v4/generations/:id" matches "/v4/generations/abc123").
//
// ## One flat list, V4 P-V Day 11
//
// Each entry used to carry a **tier** — `meta`, `core` or `manager` — and the
// proxy refused a `manager` path unless the session had been unlocked with a
// PIN. Every manager-tier path was a V1/V2 analytics route and went with the
// ranking API; the tier machinery outlived them by two phases, listing nothing
// at the tier it gated. What that left was a privilege model with no privileges
// in it: a reader of this file would reasonably conclude the app distinguishes
// staff from owners, and it does not.
//
// So the tiers are gone and the list is what it always actually was — **the set
// of paths the browser may reach.** The boundary is unchanged, because the
// boundary was never the tier: it is that a path absent from this list does not
// exist as far as the browser is concerned. Adding a privileged surface later
// means adding a gate deliberately, against a real feature, with a test —
// which is a better position than inheriting a dormant one nobody has exercised.
//
// The V2 ranking routes that used to fill this list — /recommend, /confirm,
// /inventory/*, /search, /variations, /create, /catalog/*, /prices*, /wishlist/*,
// /dashboard/*, /weights/*, /forecast — were removed with the API behind them.

const ROUTES = [
  // ── Meta ────────────────────────────────────────────────────────────────
  // Liveness, and whether synthesis is warm. `useHealth` polls this while the
  // backend is cold so a slow first request reads as a loading corpus rather
  // than a hung page.
  "/health",

  // ── V4 — the one screen ─────────────────────────────────────────────────
  // Every V4 path the workspace touches, and no more.
  "/v4/options",
  "/v4/generate",
  "/v4/feedback",
  "/v4/generations/:id",
  "/v4/search",
  "/v4/recipes/:id",
  // The pantry. DELETE reaches the backend through the same catch-all as the
  // other two; the allowlist is about the path, not the method, which is why
  // `/v4/pantry/:id` is listed separately — it is a different segment count.
  "/v4/pantry",
  "/v4/pantry/:id",
  // The dial's live count. A read with a body — it writes nothing, stores
  // nothing, and costs one pass over a pool already in memory.
  "/v4/reach",
  // What a chef kept. Two lists, and only one of them takes writes: a published
  // recipe is kept and un-kept here, while an invented dish enters the other
  // list by being **accepted** at `/v4/feedback` — which is why there is no
  // `POST /v4/kept/creations` on the backend to list. The DELETE reaches the
  // backend through the same catch-all as the POST; `/v4/kept/recipes/:id` is
  // listed separately because it is a different segment count, exactly as the
  // pantry's two entries are.
  "/v4/kept/recipes",
  "/v4/kept/recipes/:id",
  "/v4/kept/creations",

  // `POST /v4/generations/:id/reproduce` is deliberately absent: replaying a
  // generation re-runs the whole pipeline, seconds of backend CPU per call, and
  // that is an ops tool rather than a button. It stays available with a
  // restaurant key directly, or via `python -m ml.delivery.reproduce`.
  //
  // **Every `/v3/*` path is absent too, as of V4 P-V Day 11.** `/v3` is still
  // served and still means what it meant — a client that has one may keep
  // calling it — but nothing in this workspace speaks it any more: the V3 panel
  // and its results component were deleted on Day 11 and the request screen has
  // spoken `/v4` since Day 3. A route left on this list for a component that no
  // longer exists is a browser-reachable surface with no caller, which is the
  // definition of what an allowlist is for excluding.
  //
  // NOTE: every `/admin/*` route is DELIBERATELY absent — account creation and
  // key rotation are ops-only and are never exposed through this user proxy.
  // Registration reaches `/admin/restaurant` from `api/agent/register/route.js`,
  // which runs server-side with the admin key.
];

// Whether the proxy may forward this backend path. Trailing slashes and query
// strings are the caller's job to strip before calling.
export function isAllowed(path) {
  const segs = path.split("/").filter(Boolean);
  return ROUTES.some((pattern) => {
    const pat = pattern.split("/").filter(Boolean);
    if (pat.length !== segs.length) return false;
    return pat.every((p, i) => p.startsWith(":") || p === segs[i]);
  });
}
