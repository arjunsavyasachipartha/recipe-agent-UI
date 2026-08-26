"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { agentDelete, agentGet, agentPost } from "@/lib/agent/client";

// The staple exemption a chef keeps — client-side.
//
// The dial's other half. `dial.match` takes staples out of **both** sides of its
// fraction, so this list decides what counts as a shopping trip: an ingredient
// on it is never held against a dish, and one off it is something the chef is
// told to go and buy. Until now every kitchen in the product read one list, and
// that list is measured over a corpus of mostly savoury Indian recipes — 39 ids
// with no sugar, no milk, no flour and no ghee in them.
//
// Lives on the agent backend at `GET/POST/DELETE /v4/staples` plus
// `POST /v4/staples/reset`, keyed on the restaurant and reached through the BFF
// proxy like everything else, so the account that owns the list is the account
// `/v4/generate` runs as and the two cannot be looking at different lists.
//
// **No save button**, for `usePantry`'s reason: a save button on a list is a way
// to lose a list.
//
// Optimism is deliberately *narrower* here than on the pantry. An add is applied
// straight away, because the chef picked a real ingredient and the row can be
// drawn from the pick alone. A **remove** is not, and the difference is that a
// removal changes what the whole list means — `basis` flips to `custom`, the
// counts move, and the first removal on an untouched account silently seeds the
// other 38 rows on the server. Guessing at all of that on the client would mean
// maintaining a second copy of the seeding rule in a component; the server
// answers with the whole list in one round-trip, and this waits for it.
export function useStaples() {
  // `{ canonical_id, name, source, on_default_list, gates, added_at }`, in the
  // backend's order (by name) and with its names. The workspace does not
  // prettify an id itself — that is `ml.generation.vocabulary`'s job, and a
  // second opinion about what an ingredient is called is a second place to be
  // wrong.
  const [staples, setStaples] = useState([]);
  // `default` while this chef's list is still exactly the shipped one, `custom`
  // once it differs by a single id. The same word the card's
  // `match.staples_basis` carries, so a chef reading *custom* on a dish can find
  // *custom* here.
  const [basis, setBasis] = useState("default");
  const [defaultTotal, setDefaultTotal] = useState(0);
  const [removed, setRemoved] = useState([]);
  const [added, setAdded] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // What the last add cost, when the corpus disagrees with it. Not an error —
  // the write happened — so it is held apart from `error` and rendered as a
  // note under the chip rather than as a failure.
  const [caution, setCaution] = useState(null);

  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const absorb = useCallback((data) => {
    setStaples(data.staples || []);
    setBasis(data.basis || "default");
    setDefaultTotal(data.default_total || 0);
    setRemoved(data.removed || []);
    setAdded(data.added || []);
  }, []);

  useEffect(() => {
    let active = true;
    agentGet("/v4/staples").then((res) => {
      if (!active) return;
      if (res.ok) absorb(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [absorb]);

  // One write. `optimistic` may be null, in which case the list is left alone
  // until the server answers — see the note at the top about removals.
  const write = useCallback(async (optimistic, send, failMessage) => {
    const before = staples;
    const mine = ++seq.current;
    if (optimistic) setStaples(optimistic);
    setError(null);
    setCaution(null);
    setBusy(true);

    const res = await send();
    if (!alive.current) return;
    setBusy(false);
    if (!res.ok) {
      setStaples(before);
      setError(res.error || failMessage);
      return;
    }
    // Only the newest write gets to declare what the list is.
    if (mine === seq.current) {
      absorb(res.data);
      if (res.data.caution) setCaution(res.data.caution);
    }
  }, [staples, absorb]);

  // `ingredient` is a `{ id, name }` from the picker.
  const add = useCallback((ingredient) => {
    const id = String(ingredient?.id || "").trim();
    if (!id || staples.some((row) => row.canonical_id === id)) return;
    const optimistic = [
      ...staples,
      {
        canonical_id: id,
        name: ingredient.name || id.replace(/_/g, " "),
        source: "chef",
        on_default_list: false,
        gates: null,
      },
    ].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return write(
      optimistic,
      () => agentPost("/v4/staples", { canonical_id: id }),
      "Could not add that to your staples."
    );
  }, [staples, write]);

  const remove = useCallback((id) => {
    if (!staples.some((row) => row.canonical_id === id)) return;
    return write(
      null,
      () => agentDelete(`/v4/staples/${encodeURIComponent(id)}`),
      "Could not remove that from your staples."
    );
  }, [staples, write]);

  const reset = useCallback(() => write(
    null,
    () => agentPost("/v4/staples/reset", {}),
    "Could not put your staples back to the standard list."
  ), [write]);

  return {
    staples,
    basis,
    defaultTotal,
    removed,
    added,
    loading,
    busy,
    error,
    caution,
    add,
    remove,
    reset,
    dismissError: () => setError(null),
    dismissCaution: () => setCaution(null),
  };
}
