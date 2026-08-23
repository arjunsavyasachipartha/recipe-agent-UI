"use client";

import ResultCard from "./ResultCard";
import styles from "./request.module.css";

// V4 Phase 5 Days 7, 8 and 9 — the answer.
//
// **Day 7, the dishes.** `ResultCard` draws one; this lays them out and puts the
// count above them.
//
// **Day 8, the honest parts.** The funnel, the not-shown list and the warnings,
// in a collapsed section under the cards. V3 built these and they are the most
// convincing thing in a demo: *a system that shows what it rejected and why
// reads as a system that knows what it is doing.* Collapsed, because a chef
// wants dishes first — and present, because *five dishes and nothing else*
// cannot tell a chef whether the brief was thin or the dial was strict, and
// those have opposite fixes.
//
// **Day 9, the empty page.** No results is an answer and must not read as a
// broken screen. The response already names the stage that emptied it
// (`count.ran_out_at`) and writes the sentence (`message`), so nothing here
// diagnoses anything — what this file adds is the **one control most likely to
// fix it**, as a button that sets it and asks again. A page that says *turn the
// match dial down* and leaves the chef to find the match dial is a page that has
// described the fix rather than offered it.

//: The funnel's stages in a chef's words. Whatever the response sends is
//: rendered in the order it sent it, and an unlabelled stage falls through to
//: its own name — P-III Day 4 took the funnel from eleven rows to ten and V3's
//: equivalent map did not have to change, which is the property worth keeping.
//:
//: **This map is wider than the funnel**, and deliberately: the same words turn
//: up in `not_shown[].also` and in `count.ran_out_at`, and the selection reasons
//: (`shares_a_parent`, `the_shortlist_was_full`) never appear as a stage but do
//: appear there. `tests/test_v4_screen_labels.py` is what keeps it complete —
//: it reads this object and compares it against `taxonomy.REASON_LABEL`, which
//: is the drift V3 hit when `too_costly` left the funnel.
//:
//: It is not read from `GET /v4/options`, and that is a decision rather than an
//: oversight: `reject_reasons` serves the words a **chef** may reject on, which
//: is a vetted subset — it has no entry for `doubted_by_the_critic` or
//: `off_identity`, both of which are funnel stages. A screen that read its
//: funnel labels from that list would print two raw enums.
const STAGE = {
  composed: "Dishes composed",
  unsafe: "Broke a hard rule",
  infeasible: "Wouldn't physically work",
  refused_by_the_chef: "You ruled it out",
  outside_the_pantry: "Needed more than you listed",
  implausible: "Nobody puts these together",
  doubted_by_the_critic: "A second opinion doubted it",
  off_identity: "Not how this cuisine cooks",
  too_novel: "Further from the usual than you allowed",
  nearly_the_same_dish: "Too like a dish already shown",
  shares_a_parent: "Another version of a dish already shown",
  a_copy_of_another_dish: "The same dish is already on the list",
  the_shortlist_was_full: "Other dishes covered more ground",
  the_shortlist: "The shortlist filled up",
  shown: "Shown to you",
};

//: What to offer when a stage emptied the page. Each entry names the control in
//: the chef's words, says what pressing it does, and computes the new value from
//: what is set now — so the button is an actual change and not a restatement of
//: the advice. `null` where there is no control to offer: a dish refused as
//: *implausible* was refused by a measurement of the corpus, and inventing a
//: button for it would be inventing a fix.
//
// The one that has no entry and could have had one is `unsafe`. A hard-rule
// refusal is an allergen or a diet the chef set, and *relax your allergy* is not
// a suggestion this product makes.
const FIXES = {
  outside_the_pantry: {
    control: "the match dial",
    apply: ({ match, stops }) => {
      const below = (stops || []).filter((s) => s.pct < match);
      if (!below.length) return null;
      const next = below[below.length - 1];
      return { patch: { match: next.pct }, does: `set it to “${next.label}”` };
    },
  },
  too_novel: {
    control: "how far from the usual",
    apply: ({ novelty }) => {
      const next = Math.min(1, Math.round((novelty + 0.25) * 100) / 100);
      if (next <= novelty) return null;
      return { patch: { novelty: next }, does: `allow up to ${next}` };
    },
  },
  refused_by_the_chef: {
    control: "your sentence",
    apply: ({ intent }) =>
      intent
        ? { patch: { intent: "" }, does: "clear it and ask again" }
        : null,
  },
  off_identity: {
    control: "the cuisine",
    apply: ({ cuisine, region }) =>
      cuisine && region
        ? {
            patch: { cuisine: "" },
            does: `widen it to all of ${region}, which has more to build from`,
          }
        : null,
  },
};

export default function Results({ result, controls, stops, onFix }) {
  const cards = result.cards || [];
  const count = result.count || {};
  const warnings = result.warnings || [];

  return (
    <div className={styles.results}>
      <div className={styles.resultsHead}>
        <h3 className={styles.resultsTitle}>
          {cards.length === 0
            ? "Nothing came back"
            : `${cards.length} dish${cards.length === 1 ? "" : "es"}`}
        </h3>
        {/* `count.sentence` is written by the backend and is always present,
            including on a full answer. Rendered as it is, because the shortfall
            and its cause are one thought and re-assembling them here would be a
            second opinion about what happened. */}
        {count.sentence && <span className={styles.countSentence}>{count.sentence}</span>}
      </div>

      {/* The sentence box's leftovers and anything the request carried that V4
          has no room for. Above the cards, because a warning about the request
          is about to explain the answer. */}
      {warnings.length > 0 && (
        <div className={`${styles.note} ${styles.noteWarn}`}>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {cards.length === 0 && (
        <EmptyAnswer result={result} controls={controls} stops={stops} onFix={onFix} />
      )}

      <div className={styles.cardList}>
        {cards.map((card) => (
          <ResultCard
            key={card.card_id}
            card={card}
            generationId={result.generation_id}
          />
        ))}
      </div>

      <HonestParts result={result} />
    </div>
  );
}

// ── Day 9: nothing came back ─────────────────────────────────────────────────

// Two facts and an offer. The stage that emptied it and the sentence come off
// the response; the offer is computed here from what the controls are set to
// now, so the button changes something rather than describing a change.
function EmptyAnswer({ result, controls, stops, onFix }) {
  const stage = result.count?.ran_out_at;
  // V4 P-VI Day 1. Something the chef stated outright and did not get. It leads,
  // because the stage name buries it: *give me sweets* against a savoury pantry
  // composes ten desserts and loses nine to the dial and the last one to
  // plausibility, so `ran_out_at` reads `implausible` — true about the last
  // candidate, and not what happened to the chef's request.
  const missed = result.brief?.unmet_requirements?.[0];
  // The dial is what took it away in the common case, so offer the dial's fix
  // rather than the one belonging to whichever gate happened to be last.
  const fixStage = missed?.why === "outside_the_pantry" ? "outside_the_pantry" : stage;
  const fix = FIXES[fixStage];
  const offer = fix ? fix.apply({ ...controls, stops }) : null;

  return (
    <div className={`${styles.note} ${styles.noteEmpty}`}>
      <span className={styles.noteTitle}>
        {missed
          ? `You asked for ${(missed.requirement || "").split("=").pop()} and this could not deliver it`
          : /* `composed` is not a refusal and must not be headed like one: it
               means no dish was ever built, so there is nothing a gate could
               have thrown out. Reads with the null case for that reason. */
            stage && stage !== "composed"
            ? `Everything was refused at: ${STAGE[stage] || stage}`
            : "Nothing was composed"}
      </span>{" "}
      {/* The backend's own sentence. It already names the stage and, where there
          is one, the fix — this section exists to make the fix pressable, not to
          re-word it. */}
      {result.message}
      {offer ? (
        <div className={styles.fixRow}>
          <button
            type="button"
            className={styles.fixBtn}
            onClick={() => onFix(offer.patch)}
          >
            Change {fix.control} &mdash; {offer.does}
          </button>
          <span className={styles.fixNote}>and ask again</span>
        </div>
      ) : (
        <p className={styles.fixNote}>
          {stage && fix
            ? `${fix.control} is already as far as it goes. Naming more ingredients, or a wider cuisine, is what is left.`
            : "Nothing here is a setting you can relax — try a wider cuisine, or more ingredients."}
        </p>
      )}
      <p className={styles.fixNote}>
        The full account of what was composed and refused is below.
      </p>
    </div>
  );
}

// ── Day 8: what was rejected, and why ────────────────────────────────────────

// One collapsed section holding both halves. Two separate disclosures would put
// the funnel and the dishes it counted behind two different clicks, and they are
// read together — the funnel says *four were refused for needing more than you
// listed* and the list says *which four*.
function HonestParts({ result }) {
  const funnel = result.funnel || [];
  const notShown = result.not_shown || [];
  const why = result.brief?.why_this_was_asked_for || [];
  const unmet = result.brief?.unmet || [];
  const ms = result.timings_ms?.total;

  if (!funnel.length && !notShown.length && !why.length) return null;

  const refused = funnel.reduce((n, r) => n + (r.stage === "composed" ? 0 : r.rejected), 0);

  return (
    <details className={styles.honest}>
      <summary>
        What was composed and not shown
        <span className={styles.honestCount}>
          {refused > 0
            ? `${refused} refused${ms ? ` · ${(ms / 1000).toFixed(1)}s` : ""}`
            : ms
            ? `${(ms / 1000).toFixed(1)}s`
            : ""}
        </span>
      </summary>

      <div className={styles.honestBody}>
        {why.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>Why it asked for what it asked for</p>
            <ul className={styles.measures}>
              {why.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Not a rejection and not a warning: a thing the chef asked for that
            the corpus has no way of expressing at all. It belongs beside the
            funnel because it is the one cause of a thin answer that no setting
            on the screen can fix. */}
        {unmet.length > 0 && (
          <div className={`${styles.note} ${styles.noteWarn}`}>
            <span className={styles.noteTitle}>Nothing in the collection reaches this</span>
            <ul>
              {unmet.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        {funnel.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>Every dish that was composed, and what happened</p>
            {/* A table and not a chart. A handful of exact single-digit counts
                is precisely the case where bars lose information rather than
                adding it. */}
            <table className={styles.funnel}>
              <thead>
                <tr>
                  <th>What happened</th>
                  <th className={styles.num}>Dropped</th>
                  <th className={styles.num}>Left</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((r) => (
                  <tr key={r.stage} className={r.rejected ? styles.funnelHit : ""}>
                    <td>{STAGE[r.stage] || r.stage}</td>
                    <td className={`${styles.num} ${r.rejected ? "" : styles.funnelZero}`}>
                      {r.stage === "composed" ? "—" : r.rejected}
                    </td>
                    <td className={styles.num}>{r.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {notShown.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>
              {notShown.length} {notShown.length === 1 ? "dish" : "dishes"} refused, by name
            </p>
            <table className={styles.notShown}>
              <tbody>
                {notShown.map((r, i) => (
                  <tr key={`${r.recipe_id}-${i}`}>
                    <td>{r.name}</td>
                    <td className={styles.notShownWhy}>{r.label}</td>
                    <td className={styles.notShownDetail}>
                      {r.detail}
                      {/* A dish can fail more than one gate and the funnel
                          counts it once, at the first. Saying so is the
                          difference between a chef relaxing one setting and
                          getting the dish, and relaxing it and getting nothing. */}
                      {(r.also || []).length > 0 && (
                        <span className={styles.alsoFailed}>
                          {" "}
                          — and would also have failed:{" "}
                          {r.also.map((a) => STAGE[a] || a).join(", ").toLowerCase()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
