"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { agentDelete, agentGet, agentPost } from "@/lib/agent/client";

// V4 Phase 5 Days 1-2 — the pantry, client-side.
//
// The saved list of what is in the kitchen. It lives on the agent backend at
// `GET/POST/DELETE /v4/pantry`, keyed on the restaurant, reached through the BFF
// proxy like every other backend call — so the account that owns the pantry is
// the same account `/v4/generate` runs as, and the two can never be looking at
// different lists.
//
// Loads once on mount and persists every add and remove the moment it happens.
// **There is no save button**, deliberately: a save button on a list is a way to
// lose a list. The chef adds three things, gets called to the pass, comes back
// to a reloaded tab and finds nothing — and after that they will not trust the
// pantry enough to use it.
//
// Every change is applied to the screen first and sent second. A chip that waits
// for a round-trip before appearing makes the box feel broken on a slow
// connection, and this is the one control on the screen a chef touches
// repeatedly. If the write fails the previous list is put back and the error is
// surfaced, so the screen is optimistic and never dishonest.
//
// `seq` is why this survives fast picking. Two adds a few hundred milliseconds
// apart can come back out of order, and taking whichever response lands last as
// the truth would silently drop the first ingredient. Only the reply to the most
// recent write may replace the list.
export function usePantry() {
  // `{ canonical_id, name, added_at }`, newest first — the backend's own order
  // and its own names. The workspace does not prettify an id itself: the name is
  // measured off the corpus in `ml.generation.vocabulary`, and a second opinion
  // about what an ingredient is called is a second place to be wrong.
  const [pantry, setPantry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const seq = useRef(0);      // id of the most recent write
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Load once. A failure here is not shouted about — an empty pantry that can
  // still be filled in is a working screen, and the chef finds out on their
  // first add if the backend is really unreachable.
  useEffect(() => {
    let active = true;
    agentGet("/v4/pantry").then((res) => {
      if (!active) return;
      if (res.ok) setPantry(res.data.pantry || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // One write, optimistically applied. `next` is what the list should look like
  // straight away; `send` performs the round-trip and answers with the whole
  // list, which is why nothing here has to merge. On any failure the list the
  // chef was looking at before the click is restored.
  const write = useCallback(async (next, send, failMessage) => {
    const before = pantry;
    const mine = ++seq.current;
    setPantry(next);
    setError(null);

    const res = await send();
    if (!alive.current) return;
    if (!res.ok) {
      setPantry(before);
      setError(res.error || failMessage);
      return;
    }
    // Only the newest write gets to declare what the pantry is.
    if (mine === seq.current) setPantry(res.data.pantry || []);
  }, [pantry]);

  // `ingredient` is a `{ id, name }` from the picker. The optimistic row is
  // built from it rather than from the id alone so the chip reads properly for
  // the moment before the server answers.
  const add = useCallback((ingredient) => {
    const id = String(ingredient?.id || "").trim();
    if (!id || pantry.some((row) => row.canonical_id === id)) return;
    const optimistic = {
      canonical_id: id,
      name: ingredient.name || id.replace(/_/g, " "),
      added_at: new Date().toISOString(),
    };
    return write(
      [optimistic, ...pantry],
      () => agentPost("/v4/pantry", { canonical_id: id }),
      "Could not save that to your pantry."
    );
  }, [pantry, write]);

  const remove = useCallback((id) => {
    if (!pantry.some((row) => row.canonical_id === id)) return;
    return write(
      pantry.filter((row) => row.canonical_id !== id),
      () => agentDelete(`/v4/pantry/${encodeURIComponent(id)}`),
      "Could not remove that from your pantry."
    );
  }, [pantry, write]);

  return { pantry, loading, error, add, remove, dismissError: () => setError(null) };
}
