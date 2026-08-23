// The one option list the Recipe Agent registration modal still needs, and the
// call behind its button.
//
// **V4 P-V Day 11 deleted the other two.** `VENUE_TYPES` was a hand-written copy
// of `ml/generation/reference/venue_types.csv` that had drifted to **8 of its 15
// rows** — no Bakery, no Tea House, no Street Food, no Casual Dining — and
// `SPECIALTY_GROUPS` was 31 chips feeding a ranking API that no longer exists.
// The venue kind is now asked on the request screen, by a dropdown that reads
// the registry through `GET /v4/options` and therefore cannot drift; see
// `RegisterModal.js` for why the modal is the one place that could not do that.
//
// `fetchAgentKitchens` went with them, and it was not merely unused: it called
// `GET /admin/kitchens`, which P-I Day 8 **deleted**, so the modal that depended
// on it could not complete and no new account could get a key.

// Indian states + union territories. The value equals the label — it is sent to
// the backend as free text and stored on the account record. Nothing reads it:
// the price estimate and the weather lookup that used to are both gone, and
// synthesis takes the weather with each request.
//
// Hand-written, and legitimately so — unlike the venue list this replaced, the
// states of India are not a registry this product owns, derives or validates
// against. The backend takes the field as free text.
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

// Register the current restaurant with the recipe agent. Returns
// { ok: true } or { ok: false, error }.
// Register the current restaurant with the recipe agent. The server route holds
// the admin key and does the provisioning; this only carries the one answer the
// modal collects. Returns { ok, error } — the caller renders the error.
export async function registerAgent({ city, state }) {
  const res = await fetch("/api/agent/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, state }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "Something went wrong." };
  return { ok: true };
}
