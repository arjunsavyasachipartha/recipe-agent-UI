"use client";

import { useEffect, useState } from "react";
import { agentGet } from "@/lib/agent/client";

// V4 Phase 5 Day 9 — is the agent awake, and is it warm.
//
// The brief: *first request after a cold boot → the existing warm-up status
// pill, which is already wired to `/health`. Neither state should read as a
// broken page.*
//
// The pill existed and was **checked once, on mount**, which is the half that
// made it useless for the state it was built for. A chef opening the workspace
// thirty seconds after a deploy saw *Connected · warming up* and then saw it
// forever, because nothing asked again — so the one moment the distinction
// matters (the first request is slow because the corpus is loading, not because
// the page has hung) was exactly the moment the pill went stale.
//
// So it polls, and only while it has a reason to:
//
// * **cold** → ask again every `COLD_MS`, because the answer is about to change;
// * **warm** → stop. A backend that has loaded its artefacts does not unload
//   them, and a poll that runs forever is a poll that costs something forever.
// * **unreachable** → keep asking, more slowly. This is the state a chef most
//   wants to see recover on its own.
//
// One reader, used by both the page's status pill and the request screen's
// "this will take a while" note. Two independent `/health` fetchers would be two
// answers to one question, and on a slow backend they would disagree on screen.

const COLD_MS = 4000;
const DOWN_MS = 10000;

//: What the screen says while the backend is still loading.
//:
//: **It quotes no duration, and that is the finding rather than a hedge.** The
//: first draft said *about half a minute*; measured against a local restart,
//: `/health` answered 1.6 s after launch and reported `warm` at 10.2 s — so the
//: sentence would have been wrong by a factor of three on the machine it was
//: written on, and there is no reason to think the deployed Space matches
//: either, since the cost is reading the frozen corpus off whatever disk it is
//: on. A number a chef can time and catch out is worse than no number: the pill
//: already carries the *state*, which is the part that is true everywhere.
export const COLD_START_HINT =
  "the agent is still loading its recipe collection, so this first one waits for it";

export function useHealth() {
  // `null` while the first answer is outstanding — distinct from `{ok: false}`,
  // which is a backend that answered by not answering. A screen that collapsed
  // the two would say *unreachable* for the second it takes to find out.
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let active = true;
    let timer = null;

    const check = async () => {
      const res = await agentGet("/health");
      if (!active) return;
      const next = res.ok
        ? { ok: true, warm: Boolean(res.data?.synthesis?.warm) }
        : { ok: false, warm: false };
      setHealth(next);
      // Warm is terminal. Everything else is a state worth asking about again.
      if (next.ok && next.warm) return;
      timer = setTimeout(check, next.ok ? COLD_MS : DOWN_MS);
    };

    check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return {
    health,
    checking: health == null,
    reachable: health?.ok ?? null,
    //: True only when we *know* it is cold. `null` health is not cold, it is
    //: unknown, and a screen warning about a slow first request before it has
    //: any reason to is a screen that cries wolf on every visit.
    cold: Boolean(health?.ok && !health.warm),
  };
}
