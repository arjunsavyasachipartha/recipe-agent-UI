"use client";

import { useEffect, useMemo, useState } from "react";
import { agentGet } from "@/lib/agent/client";

// V4 Phase 5 Day 4 — every dropdown on the request screen, from the backend.
//
// One call to `GET /v4/options` and nothing in this file declares a vocabulary.
// That is the whole point of the endpoint, and it is V3's own lesson written
// down: a request screen that hard-codes its enums drifts from what the
// validator accepts, and the drift is invisible until a chef picks the entry
// that no longer exists. Cuisines, regions, venues, meal slots, courses, diets,
// allergens, the seasons and the two dial defaults are all read from registries
// on the server; the only literals below are English words for the blank option.
//
// Cached at module scope, so moving between the request screen and the search
// view does not refetch a payload that cannot change between two clicks.

let cache = null;
let inflight = null;

export function useOptions() {
  const [data, setData] = useState(cache);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    if (!inflight) inflight = agentGet("/v4/options");
    let active = true;
    inflight.then((res) => {
      if (!active) return;
      if (res.ok) {
        cache = res.data;
        setData(res.data);
      } else {
        // Let the next mount try again — a failed load must not be cached as
        // "the agent has no cuisines".
        inflight = null;
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { options: data, loading, error };
}

// ── Shapes the controls want ────────────────────────────────────────────────

// The cuisine picker is two levels, and P-I Day 2 is why: 76 fine cuisines is
// too many for one list and the tail is thin, while the 7 regions alone are too
// coarse — Punjabi and Bengali both live inside "Indian". So the chef picks a
// region and then, optionally, narrows it.
//
// **Both levels are legal `cuisine` values.** A region is not a grouping header
// here; sending "South India" asks for South Indian food measured against the
// region's 1,080-recipe yardstick, which for a thin label is the better
// evidence. The narrower entry is an option, not a requirement.
export function cuisineTree(options) {
  const offered = (options?.cuisines || []).filter((c) => c.offered);
  const byRegion = new Map();
  for (const cuisine of offered) {
    if (!byRegion.has(cuisine.region)) byRegion.set(cuisine.region, []);
    byRegion.get(cuisine.region).push(cuisine);
  }
  // Regions in the order the backend served them — most recipes first — and the
  // cuisines inside each one likewise.
  return (options?.regions || [])
    .filter((region) => byRegion.has(region.region))
    .map((region) => ({
      ...region,
      cuisines: byRegion.get(region.region),
    }));
}

// A registry list as `Dropdown` wants it, with a blank entry that says what
// leaving it blank means. "Any" and not "None": an unset course does not narrow
// the search, it declines to.
export function withBlank(values, blankLabel, label = (v) => v) {
  return [
    { value: "", label: blankLabel },
    ...(values || []).map((v) => ({ value: v, label: label(v) })),
  ];
}

export function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// A context signal's own levels, from the registry rather than from a list
// here. `season` is the one the weather control needs.
export function signalDomain(options, signal) {
  const spec = (options?.signals || []).find((s) => s.signal === signal);
  return spec ? spec.domain.split("|").filter(Boolean) : [];
}

// The staple exemption, as a lookup. The dial does not count these against a
// chef, and the control has to be able to say why without sending anyone to a
// report — so the reason is served per staple and shown where the question is
// asked.
export function useStaples(options) {
  return useMemo(() => {
    const map = new Map();
    for (const staple of options?.staples || []) map.set(staple.canonical_id, staple);
    return map;
  }, [options]);
}
