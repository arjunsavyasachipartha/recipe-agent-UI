"use client";

import { useEffect, useState } from "react";

// Loads the canonical ingredient list (public/ingredients.json — 872 entries)
// once and caches it at module scope, so switching tabs or adding rows never
// refetches. Each entry: { id, name, category }. `id` is the canonical value
// the backend expects; `name` is the friendly label shown in autocomplete.
let cache = null;
let inflight = null;

export function useIngredients() {
  const [list, setList] = useState(cache || []);

  useEffect(() => {
    if (cache) {
      setList(cache);
      return;
    }
    if (!inflight) {
      inflight = fetch("/ingredients.json")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
    }
    let active = true;
    inflight.then((data) => {
      cache = data;
      if (active) setList(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return list;
}
