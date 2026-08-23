"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { agentDelete, agentGet, agentPost } from "@/lib/agent/client";

// What a chef keeps, client-side — two lists that are deliberately not one.
//
// `GET/POST/DELETE /v4/kept/recipes` is the published recipes a chef saved.
// `GET /v4/kept/creations` is the invented dishes they said they would cook.
// The backend keeps them apart in the response shape, for the reason the whole
// product keeps found and invented apart, and nothing here merges them: two
// hooks, two states, and no combined list anywhere in this file.
//
// ## Why the saved list is a context and the pantry is not
//
// The keep control lives in the search view and the list that control writes to
// lives in the collection view — two components that never meet, both mounted
// for the life of the visit (`page.js` hides rather than unmounts). Two calls to
// a plain hook would be two states over one table, and the bookmark a chef
// pressed in search would not be lit when they walked over to look at it. So the
// saved list is held once, above both, and read from context.
//
// The pantry needs none of that: one component owns it, and `usePantry` stays a
// plain hook.
//
// ## The creations list is a plain hook, and read-only
//
// It has no writes to be optimistic about. A chef keeps an invented dish by
// answering *yes* to *would you cook this?* — `POST /v4/feedback`, on the card —
// and that is the only way a row enters this list. It refetches when the
// collection view is opened rather than polling, because the one thing that
// changes it is something the chef did in the other view a moment ago.

const KeptContext = createContext(null);

export function KeptProvider({ children }) {
  // `{ recipe_id, name, cuisine, …, note, saved_at, available }`, newest first.
  // The backend's own order and the corpus's own facts, resolved at read time —
  // the workspace stores no copy of a recipe's name, for the same reason the
  // table does not.
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const seq = useRef(0); // id of the most recent write
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Load once. A failure here is not shouted about: a chef who has kept nothing
  // and a chef whose list failed to load both see an empty collection, and the
  // second finds out the moment they press keep.
  useEffect(() => {
    let active = true;
    agentGet("/v4/kept/recipes").then((res) => {
      if (!active) return;
      if (res.ok) setSaved(res.data.saved || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // One write, optimistically applied — `usePantry`'s shape, and its reasoning.
  // The bookmark has to light up under the finger; a control that waits for a
  // round-trip before changing reads as broken on a slow connection. On failure
  // the list the chef was looking at before the press is restored, so the screen
  // is optimistic and never dishonest.
  const write = useCallback(async (next, send, failMessage) => {
    const before = saved;
    const mine = ++seq.current;
    setSaved(next);
    setError(null);

    const res = await send();
    if (!alive.current) return;
    if (!res.ok) {
      setSaved(before);
      setError(res.error || failMessage);
      return;
    }
    if (mine === seq.current) setSaved(res.data.saved || []);
  }, [saved]);

  const isSaved = useCallback(
    (recipeId) => saved.some((row) => row.recipe_id === recipeId),
    [saved],
  );

  // `row` is a search result or a recipe detail — whatever the caller has. The
  // optimistic entry is built from it so the row reads properly for the moment
  // before the server answers with the resolved one.
  const keep = useCallback((row, note) => {
    const id = String(row?.recipe_id || "").trim();
    if (!id || isSaved(id)) return;
    const optimistic = {
      recipe_id: id,
      name: row.name || null,
      cuisine: row.cuisine || null,
      course: row.course || null,
      diet: row.diet || null,
      total_time_min: row.total_time_min ?? null,
      ingredient_count: row.ingredient_count || 0,
      used_by_generation: row.used_by_generation !== false,
      note: note || null,
      saved_at: new Date().toISOString(),
      available: true,
    };
    return write(
      [optimistic, ...saved],
      () => agentPost("/v4/kept/recipes", { recipe_id: id, ...(note ? { note } : {}) }),
      "Could not add that to your collection."
    );
  }, [saved, isSaved, write]);

  const drop = useCallback((recipeId) => {
    if (!isSaved(recipeId)) return;
    return write(
      saved.filter((row) => row.recipe_id !== recipeId),
      () => agentDelete(`/v4/kept/recipes/${encodeURIComponent(recipeId)}`),
      "Could not remove that from your collection."
    );
  }, [saved, isSaved, write]);

  const toggle = useCallback(
    (row) => (isSaved(row?.recipe_id) ? drop(row.recipe_id) : keep(row)),
    [isSaved, keep, drop],
  );

  const value = {
    saved,
    loading,
    error,
    isSaved,
    keep,
    drop,
    toggle,
    dismissError: () => setError(null),
  };

  return <KeptContext.Provider value={value}>{children}</KeptContext.Provider>;
}

export function useKept() {
  const value = useContext(KeptContext);
  if (!value) {
    throw new Error("useKept must be used inside <KeptProvider>");
  }
  return value;
}

// The accepted dishes. Read-only, and refetched on demand rather than polled —
// `reload` is called when the collection view is opened, because the only thing
// that changes this list is a verdict the chef logged in the other view.
export function useCreations() {
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await agentGet("/v4/kept/creations");
    if (res.ok) {
      setCreations(res.data.creations || []);
      setError(null);
    } else {
      setError(res.error || "Could not load the dishes you kept.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { creations, loading, error, reload };
}
