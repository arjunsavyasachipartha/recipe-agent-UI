"use client";

import { useEffect, useRef, useState } from "react";
import { agentPost } from "@/lib/agent/client";

// V4 Phase 5 Day 5 — what the dial is about to do.
//
// The phase's own risk list: **a dial whose effect is invisible until you press
// the button gets set once and never moved again.** So the control has to be
// able to say, while it is being moved, how much of the cuisine each setting
// keeps in play. `POST /v4/reach` answers that for one pantry against one
// cuisine — and it answers for **every stop at once**, which is what makes the
// control feel live rather than merely informed.
//
// ## One request per pantry, not one per drag
//
// The whole curve arrives together, so dragging the control costs nothing: the
// count under the chef's thumb is a lookup in an object this hook is already
// holding. A request is made when the *pantry* or the *cuisine* changes, which
// is the only time the curve can move — the dial's own position never changes
// what any stop reaches.
//
// That is also why `ingredient_match_pct` is not sent. The endpoint does not
// take it.
//
// ## Debounced, and stale answers are dropped
//
// A chef adding four things in six seconds should cause one count, not four, so
// the fetch waits `DEBOUNCE_MS` after the list settles. And a slow answer to an
// old pantry must never overwrite a fast answer to the new one: `seq` is the
// same guard `usePantry` uses on its writes, for the same reason.
//
// ## What is deliberately not done here
//
// **No optimistic count.** There is no arithmetic in the browser that could
// guess the number, and there must not be: the count is a reading of the corpus
// through the exact formula the gate uses, and a client-side approximation
// would be a second opinion about what the dial does. While a fetch is in
// flight the previous curve stays on screen, greyed — the last true number is
// better company than a spinner where a number was.

const DEBOUNCE_MS = 350;

export function useReach({ cuisine, ingredients }) {
  const [reach, setReach] = useState(null);
  const [loading, setLoading] = useState(false);

  // The two things that can move the curve, flattened so the effect compares
  // strings rather than an array that is a new object on every render.
  const key = (ingredients || []).join(",");
  const seq = useRef(0);

  useEffect(() => {
    // No cuisine, no pool to count against — and the screen requires one before
    // the button works anyway, so there is nothing to show yet.
    if (!cuisine) {
      setReach(null);
      setLoading(false);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await agentPost("/v4/reach", {
        cuisine,
        ingredients: key ? key.split(",") : [],
      });
      if (mine !== seq.current) return; // a newer pantry is already being counted
      setLoading(false);
      // A failure leaves the previous curve alone and says nothing. This is a
      // label on a control, not the answer — an error banner over a dial for a
      // count that is only ever *roughly* would be the screen shouting about
      // the least important thing on it.
      if (res.ok) setReach(res.data);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [cuisine, key]);

  return { reach, loading };
}
