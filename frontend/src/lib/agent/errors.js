// Phase VI — one consistent status → friendly-message map for every agent call.
// The client (client.js) already normalizes failures to { ok, error, status };
// this turns the HTTP status into calm, plain-language copy so each panel doesn't
// reinvent it. Panels pass the backend's own `error` text as the fallback (used
// for statuses without a specific message, e.g. 422 validation detail).
//
// Usage:
//   const res = await agentPost("/forecast", body);
//   if (!res.ok) setError(friendlyError(res));

const STATUS_MESSAGES = {
  0: "Network error — check your connection and try again.",
  401: "Your session has expired. Please sign in again.",
  // No 403 entry, as of V4 P-V Day 11. The proxy's only 403 was the manager
  // tier gate, and that gate is gone — every remaining path is reachable by any
  // registered restaurant. A 403 arriving now means something this map has no
  // business guessing about, and `res.error` (the backend's own words) is a
  // better answer than a sentence about a manager view that does not exist.
  404: "Not found — the item may have expired. Try running it again.",
  409: "That was already processed. Refreshing should show the latest state.",
  422: "Some values weren't accepted. Please check the form and try again.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "The server hit an error. Please try again shortly.",
  503: "The AI is temporarily unavailable. Please try again in a moment.",
};

// Map a normalized failure result ({ error, status }) to display copy. Prefers a
// status-specific message; falls back to the backend's own error text, then a
// generic line. Never returns null so callers can render it directly.
export function friendlyError(res) {
  if (!res) return "Something went wrong. Please try again.";
  const byStatus = STATUS_MESSAGES[res.status];
  if (byStatus) return byStatus;
  return res.error || "Something went wrong. Please try again.";
}

// True when the failure means the session is gone and the user should re-auth.
export function isAuthExpired(res) {
  return res && res.status === 401;
}
