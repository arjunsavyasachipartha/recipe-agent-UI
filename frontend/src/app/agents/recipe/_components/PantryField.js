"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import IngredientCombo from "./IngredientCombo";
import { useIngredients } from "./useIngredients";
import { usePantry } from "./usePantry";
import base from "./phase2.module.css";
import styles from "./request.module.css";

// V4 Phase 5 Day 2 — the pantry control.
//
// The same combo box and chip row the request screen has always had, with one
// difference that changes what it is: the list is saved. It loads on mount and
// every pick and every dismiss is written straight away. What used to be a field
// the chef refilled on every visit is now the standing answer to *what have you
// got*, and the only required input on the screen.
//
// The persistence lives in `usePantry`; `IngredientCombo` is untouched. This is
// the join between them plus the chips, and it is a component rather than a
// block inside the screen because Day 10's search view wants the same pantry
// beside it and a second copy would drift.
//
// ## Two affordances on one chip, and why
//
// The contract is explicit that **the pantry is not the request**: a chef who
// has run out of paneer today should be able to drop it from one request without
// editing what they keep. So a chip does two different things:
//
// * **click it** — off for this request only. The pantry is untouched, and the
//   chip stays visible, greyed, so the chef can see what they have excluded
//   rather than wondering where it went.
// * **the ×** — gone from the pantry, saved immediately.
//
// The reversible one is the big target and the permanent one is the small
// deliberate target, which is the right way round.
//
// ## What is not saved
//
// Typed text that resolves to nothing. The backend refuses an unknown id with a
// 422 — the pantry is a *stored* list and a word the resolver cannot match would
// weaken every request built from it — so the control refuses it first and says
// so, leaving the text in the box to be fixed rather than swallowing it.
export default function PantryField({ onChange }) {
  const ingredients = useIngredients();
  const { pantry, loading, error, add, remove } = usePantry();
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState(null);
  //: Ids the chef has switched off for this request. Never persisted.
  const [offToday, setOffToday] = useState(() => new Set());

  // What the request will actually carry: the pantry minus today's exclusions.
  const active = useMemo(
    () => pantry.filter((row) => !offToday.has(row.canonical_id)),
    [pantry, offToday]
  );

  // Hand the ids up whenever they change, so the caller's request body and this
  // control can never disagree about what is in the kitchen. Keyed on the joined
  // ids rather than on the array, which is a new object on every render — and in
  // an effect rather than in the render body, because calling a parent's setter
  // while rendering is what React warns about, and the warning is right.
  const key = active.map((row) => row.canonical_id).join(",");
  const notify = useRef(onChange);
  notify.current = onChange;
  useEffect(() => {
    notify.current?.(key ? key.split(",") : []);
  }, [key]);

  // `IngredientCombo.onPick` hands back the whole record; the Add button hands
  // back the raw typed string. Resolve both against the picker's own list — by
  // id, then by name — and refuse what resolves to neither, because that is what
  // the backend will do anyway and it can say so faster.
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

  function toggleToday(id) {
    setOffToday((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const excluded = pantry.length - active.length;

  return (
    <div className={styles.pantry}>
      <div className={styles.pantryHead}>
        <label className={styles.pantryLabel}>What have you got?</label>
        <span className={styles.pantryCount}>
          {loading
            ? "loading your pantry…"
            : pantry.length === 0
            ? "nothing saved yet"
            : excluded > 0
            ? `${active.length} of ${pantry.length} · ${excluded} off for this dish`
            : `${pantry.length} saved`}
        </span>
      </div>

      <div className={styles.ingRow}>
        <IngredientCombo
          value={text}
          onChange={(v) => {
            setText(v);
            if (unknown) setUnknown(null);
          }}
          onPick={submit}
          ingredients={ingredients}
          placeholder="Start typing, e.g. paneer"
        />
        <button
          type="button"
          className={base.btnGhost}
          onClick={() => submit(text)}
          disabled={!text.trim()}
        >
          Add
        </button>
      </div>

      {pantry.length > 0 && (
        <div className={styles.chipWrap}>
          {pantry.map((row) => {
            const off = offToday.has(row.canonical_id);
            return (
              <span
                key={row.canonical_id}
                className={`${styles.chip} ${off ? styles.chipOff : ""}`}
              >
                <button
                  type="button"
                  className={styles.chipName}
                  onClick={() => toggleToday(row.canonical_id)}
                  title={
                    off
                      ? "Off for this dish. Click to put it back."
                      : "Click to leave it out of this dish only — it stays in your pantry."
                  }
                  aria-pressed={!off}
                >
                  {row.name}
                </button>
                <button
                  type="button"
                  className={styles.chipX}
                  aria-label={`Remove ${row.name} from your pantry`}
                  title="Remove from your pantry"
                  onClick={() => remove(row.canonical_id)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {!loading && pantry.length === 0 && !unknown && !error && (
        <p className={styles.pantryHint}>
          Add what is in the kitchen. It is saved, so you do this once and then keep it
          up to date &mdash; and every dish below is built out of it.
        </p>
      )}
      {pantry.length > 0 && !unknown && !error && (
        <p className={styles.pantryHint}>
          Click an ingredient to leave it out of this dish only. The <b>×</b> removes it
          from your pantry for good.
        </p>
      )}
      {unknown && (
        <p className={styles.pantryWarn}>
          We don&rsquo;t know &ldquo;{unknown}&rdquo;. Pick from the list &mdash; the pantry
          only keeps ingredients the agent can actually cook with.
        </p>
      )}
      {error && <p className={styles.pantryWarn}>{error}</p>}
    </div>
  );
}
