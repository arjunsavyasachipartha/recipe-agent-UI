"use client";

import { useMemo } from "react";
import styles from "./request.module.css";

// V4 Phase 5 Day 5 — the ingredient-match dial.
//
// The phase named two ways this control ships wrong, and this file is the
// answer to both.
//
// **"Ingredient match: 80%" means nothing to a chef.** So the control does not
// read as a percentage. It reads as the five things it can be told to do, in
// words — *anything you like*, *happy to shop*, *meet me halfway*, *one or two
// extras*, *only what I listed* — with one sentence under it saying what that
// does. The words come from `GET /v4/options`, not from this file: the
// arithmetic lives in `ml/generation/dial.py` and so does the label, because a
// second copy of *"only what I listed, plus everyday staples"* written here is
// how the promise on the control comes to differ from the gate under it. The
// percentage is still shown, small and last, because it is what the request
// carries and a chef comparing two answers should be able to see it.
//
// **A dial whose effect is invisible until you press the button gets set once
// and never moved again.** So every stop carries the count of dishes it keeps in
// play for *this* pantry in *this* cuisine, live, from `POST /v4/reach`. The
// whole curve arrives in one call, so moving the control changes the number
// under the chef's thumb immediately with no request in between.
//
// ## Five stops and not a hundred, and it is not a simplification
//
// The dial's real resolution is `100/n` over a dish's non-staple ingredients,
// and the median parent has five of them — so 90, 95 and 100 are one setting and
// 45 and 50 are one setting. A continuous slider would offer a precision the
// arithmetic does not have and would let a chef spend a minute finding a
// position that behaves exactly like the one they started from. The stops are
// the backend's `dial_stops`, which are the grid the reachability table was
// measured on.
//
// ## What the count is careful not to claim
//
// It says **dishes to build from**, never *dishes you will get*. The composers
// are not steered by the pantry — the dial filters what was composed rather than
// shaping it — so a live run returns far fewer than the pool. A number presented
// as a forecast would be a lie on the first thin answer; presented as how much
// of the cuisine this setting keeps in play, it is what it measures.

export default function MatchDial({ stops, value, onChange, reach, loading, pantrySize }) {
  // The reach endpoint answers in the same stops the options endpoint offers,
  // so the two are joined on `pct` rather than by position — a list that grew an
  // entry on one side and not the other would otherwise silently mislabel every
  // count after it.
  const dishes = useMemo(() => {
    const out = {};
    for (const stop of reach?.stops || []) out[stop.pct] = stop.dishes;
    return out;
  }, [reach]);

  if (!stops?.length) return null;

  // `value` is a percentage and the control is an index, because a range input
  // stepping in 25s would put a stop at every quarter whatever the backend says
  // its stops are. Nearest rather than exact: a stored request from before a
  // stop list changed still lands somewhere sensible.
  const index = stops.reduce(
    (best, stop, i) =>
      Math.abs(stop.pct - value) < Math.abs(stops[best].pct - value) ? i : best,
    0
  );
  const current = stops[index];
  const applies = Boolean(reach?.applies);
  const count = dishes[current.pct];

  return (
    <div className={styles.cell}>
      <div className={styles.dialHead}>
        <label className={styles.cellLabel} htmlFor="v4-match">
          How much must come from your pantry
        </label>
        <span className={styles.dialValue}>{current.pct}%</span>
      </div>

      <span className={styles.dialLabel}>{current.label}</span>

      <input
        id="v4-match"
        type="range"
        className={styles.range}
        min={0}
        max={stops.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(stops[Number(e.target.value)].pct)}
        aria-valuetext={current.label}
      />

      {/* The stops named along the track. Clicking one is the same instruction
          as dragging to it, and is the faster way to make a decision the chef
          has already made. */}
      <div className={styles.stopRow}>
        {stops.map((stop, i) => (
          <button
            key={stop.pct}
            type="button"
            className={`${styles.stop} ${i === index ? styles.stopOn : ""}`}
            onClick={() => onChange(stop.pct)}
            aria-pressed={i === index}
            title={stop.does}
          >
            <span className={styles.stopName}>{stop.label}</span>
            {/* The live count. `—` while the first curve is on its way rather
                than a number that is about to change: a figure that flickers
                from the previous pantry's answer to this one teaches a chef not
                to read it. */}
            <span className={styles.stopCount}>
              {!applies
                ? ""
                : dishes[stop.pct] === undefined
                ? "—"
                : dishes[stop.pct].toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      <p className={styles.dialSays}>{current.does}</p>

      {/* The one sentence that makes the control legible, and it changes with
          the state rather than being a constant that is true two thirds of the
          time. */}
      <p className={`${styles.dialReach} ${loading ? styles.dialStale : ""}`}>
        {pantrySize === 0 ? (
          <>
            This does nothing until you list something. With an empty pantry
            every dish would score zero, so the dial is not applied at all and
            the agent picks what suits.
          </>
        ) : !reach ? (
          <>Counting what your pantry reaches&hellip;</>
        ) : count === undefined ? (
          <>Pick a cuisine and this will say how much of it stays in play.</>
        ) : (
          <>
            <b>
              {count.toLocaleString()} of {reach.pool.toLocaleString()}
            </b>{" "}
            published {reach.region} dishes are within reach at this setting
            &mdash; the pool the agent builds from, not the number you will be
            shown.
            {reach.staples_exempt > 0 && (
              <>
                {" "}
                {reach.staples_exempt} of your{" "}
                {reach.resolved.length.toLocaleString()} ingredients are everyday
                staples and never count against you.
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
