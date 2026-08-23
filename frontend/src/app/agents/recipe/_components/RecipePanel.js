"use client";

import { useRecipe } from "./useSearch";
import styles from "./search.module.css";

// The published-recipe panel, and the three helpers that read a publisher's own
// words back to a chef.
//
// **Lifted out of `SearchView` unchanged** when the kept-recipes view needed the
// same panel. A second copy would have been the more obvious move and the wrong
// one: this component is where P-IV's rule — *a found dish must not look like an
// invented one* — is enforced in markup, by the furniture it refuses to draw.
// No lane badge, no `why` sentence, no parents, no funnel, no pantry marks; the
// `RecipeDetail` response carries none of those fields and this asks for none of
// them, so a component that fell back to `recipe.why || ""` would be one field
// away from lying. Two copies of that rule would be two places for it to rot,
// and the copy that rots is always the one nobody is looking at.
//
// The one thing this gained in the move is `action`: a slot in the head for a
// control that belongs to the *view* rather than to the recipe — the keep
// button in search, the un-keep button in the collection. It is a node and not a
// flag, so this component knows nothing about what a chef has kept.

// ── The detail panel ────────────────────────────────────────────────────────
//
// Point 3 of the rule at the top of `SearchView.js`: this deliberately does
// **not** look like `ResultCard`. No lane badge, no why sentence, no parents, no funnel,
// no pantry marks — and the fields for all of those are absent from
// `RecipeDetail`, so this is a shape the component could not draw even if it
// tried. What it has that a generated card cannot have is the source link, and
// that sits at the top.

export default function RecipePanel({ recipeId, onClose, action = null }) {
  const { recipe, loading, error } = useRecipe(recipeId);

  if (loading) return <div className={styles.panel}>Opening…</div>;
  if (error) {
    return (
      <div className={styles.panel}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }
  if (!recipe) return null;

  const facts = [
    ["Cuisine", recipe.cuisine],
    ["Course", recipe.course],
    ["Diet", recipe.diet],
    ["Serves", recipe.base_servings],
    ["Prep", recipe.prep_time_min != null ? `${recipe.prep_time_min} min` : null],
    ["Cook", recipe.cook_time_min != null ? `${recipe.cook_time_min} min` : null],
  ].filter(([, v]) => v != null && v !== "");

  return (
    <article className={styles.panel}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelName}>{dishName(recipe.name) || recipe.recipe_id}</h3>
        {action}
        <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {/* The link first, and not folded into a collapsed section. This is the
          one field the contract makes *required* rather than optional, for the
          reason the whole view exists: a found recipe that cannot say where it
          came from reads as an invented one. */}
      <p className={styles.sourceLine}>
        Published by{" "}
        <a href={recipe.source_url} target="_blank" rel="noreferrer noopener">
          {hostOf(recipe.source_url)}
        </a>
        . Nothing below was composed, substituted or rescaled by this agent.
      </p>

      <div className={styles.panelFacts}>
        {facts.map(([label, value]) => (
          <div key={label} className={styles.panelFact}>
            <span className={styles.panelFactLabel}>{label}</span>
            <span className={styles.panelFactValue}>{value}</span>
          </div>
        ))}
      </div>

      {recipe.used_by_generation === false && (
        <p className={styles.panelNote}>
          This one sits outside the pool the agent invents from — the filtered view
          is Indian and fusion only, so that an Indian kitchen is never offered a
          lasagne as a parent. It is a scope line, not a judgement: the recipe is
          published, complete and correct.
        </p>
      )}

      <section>
        <h4 className={styles.panelSection}>
          Ingredients
          <span className={styles.panelSectionSub}>
            {recipe.ingredient_count} lines, as the source wrote them
          </span>
        </h4>
        <table className={styles.ingTable}>
          <tbody>
            {recipe.ingredients.map((ing, i) => (
              <tr key={`${ing.canonical_id || ing.name}-${i}`}>
                <td>
                  {ing.name}
                  {/* Phase 1 supplied this number; the source did not give one.
                      Shown rather than hidden — a chef scaling a batch should
                      know which numbers were read and which were inferred. */}
                  {ing.qty_imputed && (
                    <span className={styles.imputed} title={ing.qty_assumption || ""}>
                      {" "}
                      estimated
                    </span>
                  )}
                </td>
                <td className={styles.num}>
                  {ing.qty != null && ing.unit ? `${trim(ing.qty)} ${ing.unit}` : ""}
                </td>
                <td className={styles.num}>
                  {ing.qty_grams != null ? `${Math.round(ing.qty_grams)} g` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Named rather than silently dropped: an ingredient list that is quietly
            one line short is one a chef cooks from and gets wrong. */}
        {recipe.ingredients_withheld?.length > 0 && (
          <p className={styles.withheld}>
            {recipe.ingredients_withheld.length} line
            {recipe.ingredients_withheld.length === 1 ? " was" : "s were"} refused
            during Phase 1 and are not shown:{" "}
            {recipe.ingredients_withheld
              .map((w) => `${w.name}${w.reason ? ` (${w.reason})` : ""}`)
              .join("; ")}
            .
          </p>
        )}
        {recipe.gram_coverage != null && recipe.gram_coverage < 1 && (
          <p className={styles.withheld}>
            {Math.round(recipe.gram_coverage * 100)}% of the lines could be weighed, so
            the gram figures are a floor rather than a total.
          </p>
        )}
      </section>

      <section>
        <h4 className={styles.panelSection}>
          Method
          <span className={styles.panelSectionSub}>as published</span>
        </h4>
        {recipe.steps?.length > 0 ? (
          <ol className={styles.steps}>
            {recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        ) : (
          <p className={styles.prose}>{recipe.instructions}</p>
        )}
      </section>

      {recipe.review_flag && (
        <p className={styles.panelNote}>
          Phase 1 flagged something on this row for a human to look at
          {recipe.review_reason ? `: ${recipe.review_reason}` : "."}
        </p>
      )}
    </article>
  );
}

//: The publisher's page-title artefact, off the front of the list. *Tandoori
//: Potatoes Recipe* is the title of a web page and not the name of a dish, and a
//: list of twenty rows each ending in the same word is twenty rows of noise.
//:
//: This is the **only** edit this view makes to anything the publisher wrote,
//: and it is the same one the direct lane already makes for the same reason —
//: `ml/generation/direct.py` strips it from a card's name and the rationale
//: sentence strips it wherever it names a parent. Doing it here and not there,
//: or there and not here, would mean the same recipe appearing under two names
//: on two screens of one product.
export function dishName(name) {
  // `direct.published_name` in full: every occurrence and not just a trailing
  // one, because the publisher writes *"Gobi Ke Kofte Recipe (Cauliflower
  // Fritters In Spicy Gravy)"* with the artefact in the middle — and the title
  // stands if stripping it would leave nothing, since a row with no name is
  // worse than a row with a clumsy one.
  const stripped = (name || "").split(" Recipe").join("").replace(/^[\s-]+|[\s-]+$/g, "");
  return stripped || name || "";
}

//: The publisher, from the URL. Shown instead of the raw link because a 90-
//: character URL in the middle of a sentence is unreadable, and the thing a chef
//: wants to know is *who says so*.
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the source";
  }
}

//: A published quantity is `1.5` or `2`, never `1.5000000000000002`. Trailing
//: zeros come off; nothing is rounded away.
function trim(value) {
  return String(Number(value.toFixed(2)));
}
