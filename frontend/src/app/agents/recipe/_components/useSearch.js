"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { agentGet } from "@/lib/agent/client";

// V4 Phase 5 Day 10 — the two calls the search view makes.
//
// `GET /v4/search` for the list and `GET /v4/recipes/{id}` for the panel. Both
// are read-only, both return published corpus rows, and neither has anything to
// do with `POST /v4/generate` — which is the whole point of the view and the
// reason its fetching lives in its own file rather than beside the generator's.
//
// ## Why the search is not typed-ahead
//
// The reflex is a debounce on every keystroke. It is wrong here for a measured
// reason rather than a stylistic one: the P-IV freeze puts the **slowest** warm
// request at 85 ms and the median at 6 ms, so latency is not the objection —
// `guidance` is. Every response carries a sentence, a spelling suggestion and a
// counted list of filters worth dropping, and P-IV Day 7 measured the whole call
// including those relaxations at 11 ms. A page that recomputed *"nothing matches
// `pane`, did you mean `paneer`"* four times while a chef types the word `paneer`
// is a page arguing with someone mid-sentence. So a search is a **submit**: the
// button, or Enter in the box.
//
// Changing a *filter*, on the other hand, re-runs immediately — a dropdown has
// no half-typed state to argue with, and a filter the chef has to press a button
// to apply is a filter that gets set and then looks broken.
//
// ## Paging appends rather than replaces
//
// `offset` is the only thing that moves on *Show more*, and the rows are
// appended. A chef comparing the fourth result against the eleventh should not
// have the fourth leave the screen to see the eleventh.

//: Matches the backend's own default. Stated here rather than left to the
//: server's `Query(20)` because the "show more" arithmetic needs the number.
export const PAGE = 20;

//: Every filter `GET /v4/search` composes, in the order the view renders them.
//: The *values* come from `GET /v4/options`'s `search_filters`, which is read
//: off the frozen index — nothing in the browser declares a vocabulary. This
//: list is the four **names**, which are the route's own parameter names and are
//: pinned against `ml.search.index.FILTERS` by `tests/test_v4_screen_labels.py`.
export const FILTERS = ["cuisine", "course", "diet", "family"];

//: A FastAPI `HTTPException` with a structured `detail` reaches the browser as
//: an object, and `agentGet` hands it back on `error` unchanged. Rendering that
//: object in JSX throws, so every error this file surfaces goes through here.
//: The `message` inside a structured detail is the one written for a human —
//: `recipe_quarantined` says *in the corpus but refused during Phase 1* — and it
//: is far better than anything this component could compose from a status code.
export function errorText(error, fallback = "Something went wrong.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    if (typeof error.message === "string") return error.message;
    if (typeof error.error === "string") return error.error;
  }
  return fallback;
}

export function useSearch() {
  const [query, setQuery] = useState("");     // what has been *searched*
  const [filters, setFilters] = useState({}); // { cuisine: "Bengali", ... }
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);    // a "show more" in flight
  const [error, setError] = useState(null);

  // Every request carries the id of the run that started it. A slow first page
  // landing after a fast second one would otherwise overwrite the newer answer
  // — the classic out-of-order fetch, and the one bug a search box always has.
  const runRef = useRef(0);

  const run = useCallback(async (q, activeFilters, offset = 0) => {
    const text = (q || "").trim();
    if (!text) {
      setAnswer(null);
      setError(null);
      return;
    }
    const run = ++runRef.current;
    if (offset) setMore(true);
    else setLoading(true);
    setError(null);

    const res = await agentGet("/v4/search", {
      q: text,
      ...activeFilters,
      limit: PAGE,
      offset,
    });
    if (run !== runRef.current) return; // a newer search has already answered

    setLoading(false);
    setMore(false);
    if (!res.ok) {
      setError(errorText(res.error, "Couldn't reach the recipe corpus."));
      if (!offset) setAnswer(null);
      return;
    }
    setAnswer((prev) =>
      offset && prev
        ? { ...res.data, results: [...prev.results, ...res.data.results] }
        : res.data
    );
  }, []);

  // A submit: the button, or Enter in the box.
  const search = useCallback(
    (text) => {
      setQuery(text);
      run(text, filters, 0);
    },
    [run, filters]
  );

  // A filter change re-runs the *last searched* query, not whatever is half
  // typed in the box — the box's own text becomes a search only when submitted,
  // and applying it here would make a dropdown behave like a hidden Enter key.
  const setFilter = useCallback(
    (name, value) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (value) next[name] = value;
        else delete next[name];
        run(query, next, 0);
        return next;
      });
    },
    [run, query]
  );

  const clearFilters = useCallback(() => {
    setFilters(() => {
      run(query, {}, 0);
      return {};
    });
  }, [run, query]);

  const showMore = useCallback(() => {
    if (!answer) return;
    // A page always starts at offset 0 and later ones are appended, so the rows
    // already on screen *are* the next offset. Reading it off `answer.offset`
    // instead would be reading the last page's start.
    run(query, filters, answer.results.length);
  }, [answer, filters, query, run]);

  return {
    query,
    filters,
    answer,
    loading,
    more,
    error,
    search,
    setFilter,
    clearFilters,
    showMore,
  };
}

// ── The detail panel ────────────────────────────────────────────────────────
//
// One recipe, whole, from `GET /v4/recipes/{id}`. Cached per id for the length
// of the visit: a chef comparing two results clicks back and forth, and the
// corpus is frozen — the answer cannot have changed between two clicks.

export function useRecipe(recipeId) {
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cache = useRef(new Map());

  useEffect(() => {
    if (!recipeId) {
      setRecipe(null);
      setError(null);
      return;
    }
    const hit = cache.current.get(recipeId);
    if (hit) {
      setRecipe(hit);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setRecipe(null);
    agentGet(`/v4/recipes/${encodeURIComponent(recipeId)}`).then((res) => {
      if (!active) return;
      setLoading(false);
      if (res.ok) {
        cache.current.set(recipeId, res.data);
        setRecipe(res.data);
      } else {
        // The backend writes a sentence for each of its three refusals — a
        // quarantined row, an unknown id, a corpus that has moved since the
        // freeze — and each sends the reader somewhere different. Printing our
        // own would flatten them into "not found".
        setError(errorText(res.error, "Couldn't open that recipe."));
      }
    });
    return () => {
      active = false;
    };
  }, [recipeId]);

  return { recipe, loading, error };
}
