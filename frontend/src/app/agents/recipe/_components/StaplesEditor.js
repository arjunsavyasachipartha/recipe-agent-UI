"use client";

import { useMemo, useState } from "react";
import IngredientCombo from "./IngredientCombo";
import { useIngredients } from "./useIngredients";
import { useStaples } from "./useStaples";
import base from "./phase2.module.css";
import styles from "./staples.module.css";

// The staple exemption, editable — the dial's other half.
//
// ## Why it sits under the pantry
//
// It was first put under the match dial, because the exemption is the dial's
// other half: a staple comes out of **both** sides of the match fraction, so
// salt is never held against a chef and sugar — not on the shipped list —
// always is. That is true of the arithmetic and wrong about the chef. What a
// chef meets here is a **second list of ingredients**, and the question it
// answers — *what am I assumed to already have?* — is the pantry's question.
// So it sits where the first list ends.
//
// A nav item of its own was refused: it would be the first screen in the
// workspace that is neither the request, the search nor the collection, and the
// phase brief is explicit that everything else was removed.
//
// ## Why it is collapsed
//
// Thirty-nine chips would dominate a request screen whose whole design argument
// is that there is one of it. Collapsed it costs one line; opened it is the
// thing the chef came for. The summary line carries the only two facts worth
// having without opening it — how many, and whether they are still the standard
// ones.
//
// ## Why the caution is a note and not an error
//
// A chef may exempt anything the corpus knows, including an ingredient that is
// the body of the dish. `onion` is the largest ingredient in 13% of the dishes
// that use it, and exempting it means the dial stops asking whether they have
// any — which is a real loss and, for a kitchen that buys onions by the sack,
// also the truth. So the write succeeds and the backend answers with the
// measurement, which is rendered here as a note under the list. Refusing would
// make the editor useless for exactly the kitchens that need it.
export default function StaplesEditor() {
  const ingredients = useIngredients();
  const {
    staples, basis, defaultTotal, removed, added,
    loading, busy, error, caution,
    add, remove, reset, dismissCaution,
  } = useStaples();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState(null);

  const custom = basis === "custom";

  const summary = useMemo(() => {
    if (loading) return "loading…";
    if (!custom) return `${staples.length} standard`;
    const parts = [];
    if (added.length) parts.push(`+${added.length}`);
    if (removed.length) parts.push(`−${removed.length}`);
    return `${staples.length} · yours (${parts.join(" ")})`;
  }, [loading, custom, staples.length, added.length, removed.length]);

  // Same resolve-then-refuse as `PantryField`: the backend 422s an unknown id
  // and the control can say so faster, leaving the text in the box to be fixed
  // rather than swallowing it.
  function submit(value) {
    const raw =
      value && typeof value === "object" ? String(value.id || "") : String(value || "");
    const clean = raw.trim();
    if (!clean) return;
    const match =
      ingredients.find((g) => g.id === clean) ||
      ingredients.find((g) => g.name.toLowerCase() === clean.toLowerCase());
    if (!match) {
      setUnknown(clean);
      return;
    }
    setUnknown(null);
    setText("");
    add(match);
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.headLabel}>
          Staple items
          {custom && <span className={styles.badge}>edited</span>}
        </span>
        <span className={styles.headMeta}>
          {summary}
          <span className={styles.caret} aria-hidden="true">{open ? "▾" : "▸"}</span>
        </span>
      </button>

      {open && (
        <div className={styles.body}>
          <p className={styles.blurb}>
            The things your kitchen simply has &mdash; salt, oil, the spice box. You
            are never asked to go and buy these, so they are left out of the match.
            The standard {defaultTotal} are mostly savoury.
          </p>

          <div className={styles.ingRow}>
            <IngredientCombo
              value={text}
              onChange={(v) => {
                setText(v);
                if (unknown) setUnknown(null);
              }}
              onPick={submit}
              ingredients={ingredients}
              placeholder="Add a staple, e.g. sugar"
            />
            <button
              type="button"
              className={base.btnGhost}
              onClick={() => submit(text)}
              disabled={!text.trim() || busy}
            >
              Add
            </button>
            {custom && (
              <button
                type="button"
                className={styles.reset}
                onClick={reset}
                disabled={busy}
                title="Put the list back to the standard one"
              >
                Reset
              </button>
            )}
          </div>

          {unknown && (
            <p className={styles.warn}>
              We don&rsquo;t know &ldquo;{unknown}&rdquo;. Pick from the list &mdash; a
              word the agent cannot match would sit here exempting nothing.
            </p>
          )}
          {error && <p className={styles.warn}>{error}</p>}

          {caution && (
            <p className={styles.caution}>
              {caution.message}{" "}
              <button
                type="button"
                className={styles.cautionX}
                onClick={dismissCaution}
                aria-label="Dismiss"
              >
                ×
              </button>
            </p>
          )}

          <div className={styles.chipWrap}>
            {staples.map((row) => (
              <span
                key={row.canonical_id}
                className={`${styles.chip} ${row.on_default_list ? "" : styles.chipOwn}`}
                // The measurements the shipped list was defended on, for the one
                // chef in a hundred who wants to know why salt is on it and onion
                // is not. A title rather than a panel: it is an answer to a
                // question almost nobody asks, and a panel would make it look
                // like something everybody should read.
                title={
                  row.gates
                    ? `in ${(row.gates.share_of_recipes * 100).toFixed(1)}% of recipes · ` +
                      `up to ${(row.gates.p90_mass_share * 100).toFixed(0)}% of a dish by weight · ` +
                      `the main ingredient ${(row.gates.body_rate * 100).toFixed(0)}% of the time` +
                      (row.gates.fails.length ? ` · not a standard staple` : "")
                    : "no measurement in the recipe collection"
                }
              >
                <span className={styles.chipName}>{row.name}</span>
                <button
                  type="button"
                  className={styles.chipX}
                  aria-label={`Stop treating ${row.name} as a staple`}
                  title="Count this against me again"
                  onClick={() => remove(row.canonical_id)}
                  disabled={busy}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {!loading && staples.length === 0 && (
            <p className={styles.blurb}>
              Nothing is exempt, so <i>everything</i> in a dish counts against your
              match &mdash; including salt. That is a legitimate setting and an
              unusual one; <b>Reset</b> brings the standard {defaultTotal} back.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
