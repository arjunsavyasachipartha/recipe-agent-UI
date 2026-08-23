"use client";

import Verdict from "./Verdict";
import styles from "./request.module.css";

// V4 Phase 5 Day 7 — one dish, complete.
//
// The brief: *name, lane badge (substituted / merged / from our collection),
// ingredients in grams with the added-beyond-your-pantry ones marked, numbered
// method, times, servings, the why sentence, the parent recipes with source
// links. No money anywhere.*
//
// ## A new file rather than an edit of `SynthesisResults`
//
// Same reason `RequestScreen` is a new file. `SynthesisResults.js` renders a
// `/v3` answer whose `RecipeCard` declares `cost` and `price` as **required**,
// it imports `synthesis.module.css`, and both go out on Day 11 with the rest of
// the V3 workspace. A component reading two card shapes is how a field comes to
// mean two things — and this one would have had to read a costed shape and a
// money-free one at the same time.
//
// What is carried over deliberately is the **style**: the fact row, the two-
// column ingredients-and-method body, and the collapsed evidence section are
// V3's layout, because a chef who used the screen last week should find the same
// card with the money gone and the pantry marks added.
//
// ## What V3 had and this does not: the comparison table
//
// V3 read the answer twice — a table to choose from and cards to cook from —
// and the argument was that *comparison is the point*. Five of its nine columns
// were money and P-III took them; what is left is what each card already says
// in its own fact row. The phase brief for this screen is one column, and a
// table above three cards on a screen whose stated risk is *twelve controls in a
// column is a tax return* is a second reading nobody asked for.
//
// ## The three states of an ingredient line, and why two flags are not one
//
// `in_pantry` alone is **not** the shopping list, and rendering it as one would
// libel the pantry. A staple the chef *did* list comes back as
// `in_pantry: false, staple: true` — because `dial.match` takes staples out of
// **both** sides of the fraction, so a listed ginger lands in `exempt` rather
// than in `inside`. A card reading that as *you'll need to buy this* would tell
// a chef to go and get the ginger they told us they had.
//
// So there are three states and the card draws three:
//
//   staple: true                    → an everyday staple; counts neither way
//   in_pantry: true                 → yours
//   neither                         → the shopping list, and exactly `match.added`
//
// **And all three are `null` when the dial did not apply** — at a setting of 0,
// or with an empty pantry, the pipeline computes no match and the lines come
// back unmarked. The card says so rather than quietly drawing an unmarked list
// that looks like *nothing here is yours*.
//
// ## A `direct` card is a found dish and must not read as an invented one
//
// P-IV's rule, and it applies here as much as it does in the search view: the
// direct lane returns a **published recipe, unchanged**, because it already
// answers. So its badge says *from our collection*, its source link is on the
// face of the card rather than folded into the evidence section, and it carries
// a line saying it is published as it stands. A screen that renders a looked-up
// dish the way it renders a composed one teaches a chef that this agent invents
// things it merely found.

//: The lane badge. The three words are the brief's own — *substituted / merged /
//: from our collection* — and the hint under each says what the lane did, since
//: a badge alone is a category and a chef wants a mechanism. `portion` and
//: `assembly` are here because `RECIPE_AGENT_EXTRA_LANES` can switch them on and
//: an unlabelled lane renders as a raw enum.
const LANE = {
  substitution: {
    label: "Substituted",
    hint: "a published recipe with one ingredient swapped",
  },
  merge: {
    label: "Merged",
    hint: "structure from one published recipe, ingredients from another",
  },
  direct: {
    label: "From our collection",
    hint: "a published recipe, unchanged — it already answers",
  },
  portion: { label: "Re-sized", hint: "a published recipe at a different size" },
  assembly: { label: "Plated", hint: "components served as one item" },
};

function grams(n) {
  if (typeof n !== "number" || !isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 2)} kg`;
  return `${n >= 10 ? Math.round(n) : n.toFixed(1)} g`;
}

function minutes(n) {
  if (typeof n !== "number" || !isFinite(n) || n <= 0) return "—";
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function prettyName(id) {
  return String(id || "").replace(/_/g, " ");
}

export default function ResultCard({ card, generationId, verdict = true }) {
  const lane = LANE[card.lane || card.kind] || {
    label: prettyName(card.lane || card.kind),
    hint: "",
  };
  const isFound = (card.lane || card.kind) === "direct";
  const time = card.time || {};
  const why = card.why || {};
  const parents = why.parents || [];
  const match = card.match;
  // Whether the pantry marks mean anything on this card at all. Read off the
  // line rather than off `match`, because it is the line that carries the flag
  // and a client should render what it was sent.
  const marked = (card.ingredients || []).some((l) => l.in_pantry !== null);
  //: The published recipe behind a found dish. `role: "self"` is the direct
  //: lane's own parent — it is the dish.
  const self = parents.find((p) => p.role === "self");

  return (
    <article className={`${styles.card} ${isFound ? styles.cardFound : ""}`}>
      <header className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <h4 className={styles.cardName}>{card.name}</h4>
          <span
            className={`${styles.lane} ${isFound ? styles.laneFound : ""}`}
            title={lane.hint}
          >
            {lane.label}
          </span>
        </div>
        <p className={styles.cardMeta}>
          {/* `course_group` is the vocabulary the chef chose in — Appetizer /
              Main / Side / Dessert. `course` is the publisher's own label, four
              of whose nine values are meal names, so showing it to a chef who
              picked "Main" would print "Lunch" back at them. Falls back for a
              response from a server that predates the field. */}
          {[card.course_group || card.course, prettyName(card.family)]
            .filter(Boolean)
            .join(" · ")}
          {lane.hint && <span className={styles.laneHint}> — {lane.hint}</span>}
        </p>
      </header>

      {/* A found dish says whose it is on its face. Folding the link into the
          collapsed section below would be the one place this screen could
          accidentally pass off somebody else's recipe as its own work. */}
      {isFound && self?.source_url && (
        <p className={styles.foundNote}>
          Published as it stands by{" "}
          <a href={self.source_url} target="_blank" rel="noopener noreferrer">
            {self.name}
          </a>
          . Nothing here was invented — the agent chose it because it already answers.
        </p>
      )}

      {why.sentence && <p className={styles.whySentence}>{why.sentence}</p>}

      <div className={styles.factRow}>
        <Fact label="Makes" value={card.servings ? `${card.servings} servings` : "—"} />
        <Fact label="Per serving" value={grams(card.grams_per_serving)} />
        <Fact label="Prep" value={minutes(time.prep_min)} />
        <Fact label="Cook" value={minutes(time.cook_min)} />
      </div>

      {/* The dial's reading of this dish, in the words the response wrote. The
          percentage is floored by `Match.reported`, never rounded, so it can
          never read higher than the gate measured. */}
      {match && (
        <p className={styles.matchLine}>
          <b>{match.pct}% from your pantry</b>
          {typeof match.requested_pct === "number" &&
            ` (you asked for at least ${match.requested_pct}%)`}
          {match.sentence && <> &mdash; {match.sentence}</>}
        </p>
      )}

      <div className={styles.cardBody}>
        <section>
          <p className={styles.sectionLabel}>
            Ingredients
            <span className={styles.sectionLabelSub}>
              for {card.servings || "?"} servings · {grams(card.total_grams)} total
            </span>
          </p>
          <table className={styles.ingTable}>
            <tbody>
              {(card.ingredients || []).map((line, i) => (
                <tr key={`${line.canonical_id}-${i}`}>
                  <td>{prettyName(line.name || line.canonical_id)}</td>
                  <td className={styles.num}>{grams(line.qty_grams)}</td>
                  <td className={styles.ingTag}>
                    <IngredientMark line={line} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {marked ? (
            <p className={styles.ingLegend}>
              <span className={styles.tagBuy}>to buy</span> is what this dish needs
              beyond your pantry. <span className={styles.tagStaple}>staple</span> is
              salt, oil and the rest of the store cupboard, which never count against
              your setting.
            </p>
          ) : (
            <p className={styles.ingLegend}>
              Nothing is marked against your pantry on this dish: the match dial was
              off, so no dish was measured against what you listed.
            </p>
          )}
        </section>

        <section>
          <p className={styles.sectionLabel}>Method</p>
          <ol className={styles.methodList}>
            {(card.method || []).map((step, i) => (
              // The steps arrive already numbered ("1. Peel the mango"), so the
              // list strips its own marker rather than printing a second number.
              <li key={i}>{String(step).replace(/^\s*\d+\.\s*/, "")}</li>
            ))}
          </ol>
        </section>
      </div>

      {time.basis && (
        <p className={styles.timeBasis}>
          Times are the published ones {time.basis}. Nothing here re-estimates them.
        </p>
      )}

      {/* The one place a chef is told something no layer refused on. Phase 4
          records these and cannot reject on them — two of its four physical
          rules would refuse published food — so this is the only route by which
          a curdling acid reaches the person cooking. */}
      {(why.risks || []).length > 0 && (
        <div className={`${styles.note} ${styles.noteWarn}`}>
          <span className={styles.noteTitle}>Watch for</span>
          <ul>
            {why.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <Evidence card={card} isFound={isFound} />

      {/* V4 P-V Day 11. The phase's one recorded live gap, closed: `POST
          /v4/feedback` was built, served and allowlisted, and no day owned
          putting it on the screen. It goes **under the evidence and not above
          the ingredients** because the question is *would you cook this*, and a
          chef who has not read the method has not been asked it yet.

          `verdict={false}` is the collection view, where every card on the page
          is one the chef already said yes to. Asking again under a dish whose
          answer is recorded is not a second chance to answer — it is a control
          that invites a chef to overwrite their own measurement by reflex. The
          way to change a verdict is to reopen the answer it was given on. */}
      {verdict && <Verdict generationId={generationId} cardId={card.card_id} />}
    </article>
  );
}

// The three states, drawn. A line with no flags at all renders nothing rather
// than an empty tag: the dial did not apply and the legend above says so once,
// which beats repeating it on every row.
function IngredientMark({ line }) {
  if (line.staple) return <span className={styles.tagStaple}>staple</span>;
  if (line.in_pantry) return <span className={styles.tagYours}>yours</span>;
  if (line.in_pantry === false) return <span className={styles.tagBuy}>to buy</span>;
  return null;
}

function Fact({ label, value }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

// What it was built from, and what was decided on the way. Collapsed, because a
// chef deciding whether to cook reads the recipe and a chef arguing with the
// suggestion reads this — and the second is the rarer visit.
//
// **Not collapsed away, though.** The parents with their source links are the
// product's central honesty claim: every dish here is built out of published
// recipes and says which. `open` on a found dish, where the provenance is not
// evidence for a composition but the whole of what the card is.
function Evidence({ card, isFound }) {
  const why = card.why || {};
  const parents = why.parents || [];
  const decisions = why.decisions || [];
  const novelty = why.novelty || {};

  if (!parents.length && !decisions.length && !novelty.sentence) return null;

  return (
    <details className={styles.evidence} open={isFound}>
      <summary>Where this came from</summary>
      <div className={styles.evidenceBody}>
        {parents.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>Built from</p>
            <ul className={styles.parents}>
              {parents.map((p, i) => (
                <li key={i}>
                  <span className={styles.parentRole}>{prettyName(p.role)}</span>
                  {p.source_url ? (
                    <a href={p.source_url} target="_blank" rel="noopener noreferrer">
                      {p.name}
                    </a>
                  ) : (
                    <span>{p.name}</span>
                  )}
                  {p.family && (
                    <span className={styles.parentFamily}>{prettyName(p.family)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {decisions.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>Decisions taken</p>
            <ul className={styles.decisions}>
              {decisions.map((d, i) => (
                <li key={i}>
                  <b>{d.subject}</b> &mdash; {d.choice}
                  {d.evidence && <span className={styles.decisionWhy}>{d.evidence}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(novelty.sentence || why.limits_respected === false) && (
          <div>
            <p className={styles.sectionLabel}>The numbers behind it</p>
            <ul className={styles.measures}>
              {novelty.sentence && <li>{novelty.sentence}</li>}
              {why.limits_respected === false && (
                <li>
                  One or more quantities sit outside the range this dish family is
                  usually built in.
                </li>
              )}
            </ul>
          </div>
        )}

        {(why.warnings || []).length > 0 && (
          <ul className={styles.measures}>
            {why.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
