"use client";

import { useState } from "react";
import Dropdown from "./Dropdown";
import { useOptions, withBlank } from "./useOptions";
import { FILTERS, useSearch } from "./useSearch";
import RecipePanel, { dishName } from "./RecipePanel";
import { KeepIcon } from "./icons";
import { useKept } from "./useKept";
import base from "./phase2.module.css";
import kept from "./kept.module.css";
import styles from "./search.module.css";

// V4 Phase 5 Day 10 — the search view.
//
// The brief: *a second view: a search box, filters, a result list, and a detail
// panel showing the full published recipe with its source link. Visually
// distinct from a generated card — P-IV's rule that a found dish must not look
// like an invented one is enforced here.*
//
// ## The rule, and what enforcing it actually took
//
// *A found dish must not look like an invented one* is easy to nod at and easy
// to fail, because the two responses describe the same food and the natural
// thing to do with a recipe is draw the card you already have. Four things keep
// them apart, and only the first is decoration:
//
// 1. **The whole view is marked, not the individual row.** A badge on a card can
//    be missed; a view whose header says *published recipes, exactly as
//    published — this agent composed none of them* cannot be entered by
//    accident. The generated card's own *from our collection* badge exists for
//    the harder case, where a found dish sits **among** invented ones.
// 2. **The source link is on the face of it**, in the list and again at the top
//    of the panel. The honest answer to *where did this come from* is a link,
//    and a link is the one thing a generated card can never carry for itself.
// 3. **The panel refuses the generated card's furniture.** No lane badge, no
//    `why` sentence, no parents, no funnel, no pantry marks. The response
//    carries none of those fields and the panel asks for none — a component
//    that fell back to `card.why || ""` would be one field away from lying.
// 4. **Nothing here is rescaled.** `base_servings` is the batch the publisher
//    wrote, `qty_grams` is Phase 1's reading of the publisher's own quantity,
//    and where Phase 1 *supplied* a quantity the line says so. The panel prints
//    the source's number beside the grams for exactly that reason.
//
// ## The risk this view is under, from the phase's own list
//
// *The search becomes the product.* It is the easiest thing on the screen to use
// and the least valuable thing we built. So it is a second item in the nav
// rather than a tab across the top of the generator, the generator is the
// landing view, and this view opens **empty** — a box and a sentence, no
// suggested queries, no "popular dishes" grid. A browse surface that fills
// itself with content is a browse surface competing for the chef's attention
// with the thing they came for.
//
// ## Where the filter values come from
//
// `GET /v4/options`'s `search_filters`, added on this day and read off the
// frozen index. Three of the four filters have no registry behind them, and the
// one that looks like it does is the trap: `options.diets` is `any|veg|egg_ok`,
// the *request* vocabulary, while the corpus labels a row `Vegetarian` or
// `No Onion No Garlic (Sattvic)`. A diet dropdown fed from `diets` returns an
// empty page for every value a chef picks. See `_search_filter_domains()` in
// `app/v4/routes.py`.

//: The filter row's labels. The **names** are the route's parameters and the
//: **values** are served; only these five words are written here, and
//: `tests/test_v4_screen_labels.py` checks the names against
//: `ml.search.index.FILTERS` so a fifth filter cannot appear on the route
//: without appearing here.
const FILTER_LABEL = {
  cuisine: "Cuisine",
  course: "Course",
  diet: "Diet",
  family: "Kind of dish",
};

//: `guidance.outcome`, in the chef's words. Three words and not two: *thin* is
//: not *empty*, and the difference is whether the advice below it is *change
//: something* or *there is more here than this*.
const OUTCOME = {
  ok: null, // a full page says nothing about itself
  thin: "Not much matches this.",
  empty: "Nothing matches this.",
};

export default function SearchView() {
  const { options } = useOptions();
  // The keep control. Held above both views in `KeptProvider`, so the bookmark
  // a chef presses here is already lit when they walk over to the collection —
  // two calls to a plain hook would be two states over one table.
  const { isSaved, toggle } = useKept();
  const {
    filters,
    answer,
    loading,
    more,
    error,
    search,
    setFilter,
    clearFilters,
    showMore,
  } = useSearch();

  const [text, setText] = useState("");
  const [openId, setOpenId] = useState(null);

  const domains = options?.search_filters || {};
  const guidance = answer?.guidance;
  const shown = answer?.results?.length || 0;

  function submit(e) {
    e.preventDefault();
    setOpenId(null);
    search(text);
  }

  // A spelling suggestion is only useful if taking it re-runs the search. Swaps
  // the word in place rather than replacing the whole box: a chef who typed
  // four words and misspelled one should not lose the other three.
  function applySuggestion(word, suggestion) {
    const next = text.replace(new RegExp(`\\b${word}\\b`, "i"), suggestion);
    setText(next);
    setOpenId(null);
    search(next);
  }

  return (
    <div className={styles.view}>
      {/* ── The whole-view mark. Point 1 above: this is the boundary, and it is
          drawn once at the top where it cannot be missed rather than repeated
          on every row where it becomes wallpaper. ── */}
      <p className={styles.published}>
        Published recipes, exactly as published &mdash; <b>this agent composed none
        of them</b>. Every one carries a link to whoever published it. To have a
        dish invented for you, go back to <i>Invent</i>.
      </p>

      <form className={styles.searchRow} onSubmit={submit}>
        <input
          className={base.input}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="paneer, kadai, a Bengali fish curry…"
          aria-label="Search published recipes"
        />
        <button type="submit" className={base.btnPrimary} disabled={!text.trim() || loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <div className={styles.filterRow}>
        {FILTERS.map((name) => (
          <div key={name} className={styles.filter}>
            <label className={styles.filterLabel}>{FILTER_LABEL[name]}</label>
            <Dropdown
              value={filters[name] || ""}
              onChange={(v) => setFilter(name, v)}
              options={withBlank(domains[name], `Any ${FILTER_LABEL[name].toLowerCase()}`)}
              ariaLabel={FILTER_LABEL[name]}
              maxHeight={320}
            />
          </div>
        ))}
        {Object.keys(filters).length > 0 && (
          <button type="button" className={styles.clear} onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <b>Couldn&rsquo;t search.</b> {error}
        </div>
      )}

      {/* No count in the sentence below, and no suggested queries under it. The
          corpus size is a number nothing on this screen is served, and a figure
          typed into JSX is one that goes stale silently; the suggested queries
          are the phase's own risk — *the search becomes the product* — arriving
          as a content grid. */}
      {!answer && !loading && !error && (
        <p className={styles.idle}>
          Search the published recipes behind this agent &mdash; by ingredient, by
          dish name, by cuisine. The same collection the invented dishes are built
          from.
        </p>
      )}

      {answer && (
        <>
          <Guidance
            guidance={guidance}
            answer={answer}
            onSuggestion={applySuggestion}
            onRelax={(drop) => (drop === "all" ? clearFilters() : setFilter(drop, ""))}
          />

          {shown > 0 && (
            <div className={styles.split}>
              <ol className={styles.list}>
                {answer.results.map((row) => (
                  <ResultRow
                    key={row.recipe_id}
                    row={row}
                    open={openId === row.recipe_id}
                    onOpen={() =>
                      setOpenId((id) => (id === row.recipe_id ? null : row.recipe_id))
                    }
                  />
                ))}
                {shown < answer.total && (
                  <li className={styles.moreRow}>
                    <button
                      type="button"
                      className={styles.moreBtn}
                      onClick={showMore}
                      disabled={more}
                    >
                      {more
                        ? "Loading…"
                        : `Show more — ${(answer.total - shown).toLocaleString()} left`}
                    </button>
                  </li>
                )}
              </ol>

              <div className={styles.panelSlot}>
                {openId ? (
                  /* The keep control sits in the **panel** and not on the row.
                     A row here is itself a `<button>` — a button inside a
                     button is markup no browser agrees about — and opening a
                     recipe before keeping it is the order a chef would want
                     anyway: what is being filed is a recipe they have read.
                     The collection view's rows are built differently and carry
                     their own remove control, because there the row is a thing
                     you act on rather than a result you are reading. */
                  <RecipePanel
                    recipeId={openId}
                    onClose={() => setOpenId(null)}
                    action={
                      <KeepButton
                        row={answer.results.find((r) => r.recipe_id === openId) || {
                          recipe_id: openId,
                        }}
                        saved={isSaved(openId)}
                        onToggle={toggle}
                      />
                    }
                  />
                ) : (
                  <p className={styles.panelIdle}>
                    Pick a recipe to read the whole of it &mdash; every ingredient in
                    grams, the method as published, and the link to its source.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── The guidance block ──────────────────────────────────────────────────────
//
// P-IV Day 7 puts this on **every** response, good pages included, and the
// reason is the same one `count` has on the generator: a field that appears only
// on failures is one a client learns to read as an error. So this renders on a
// full page too — where it is a single quiet line of counts — and the shape of
// the component does not change between a good answer and an empty one.
//
// Every escape route it offers is one the backend followed and counted before
// offering: `would_return` is measured by re-running the search without that
// filter, and an entry whose count is zero never appears. So each is a button,
// with its count on it.

function Guidance({ guidance, answer, onSuggestion, onRelax }) {
  if (!guidance) return null;
  const headline = OUTCOME[guidance.outcome];
  const hasAdvice =
    headline ||
    guidance.message ||
    guidance.unknown_words?.length ||
    guidance.unknown_filters?.length ||
    guidance.relax?.length;

  return (
    <div className={styles.guidance}>
      <div className={styles.countLine}>
        <span className={styles.total}>
          {answer.total.toLocaleString()} recipe{answer.total === 1 ? "" : "s"}
          {Object.keys(answer.filters || {}).length > 0 && " with these filters"}
        </span>
        {/* Two different statements about a word, and the chef is owed the
            difference: the index has no entry for it, or every entry has it.
            P-IV Day 8 kept them as separate fields for exactly this. */}
        {answer.unmatched_terms?.length > 0 && (
          <span className={styles.terms}>
            no entry for <i>{answer.unmatched_terms.join(", ")}</i>
          </span>
        )}
        {answer.ignored_terms?.length > 0 && (
          <span className={styles.terms}>
            <i>{answer.ignored_terms.join(", ")}</i> is in nearly every recipe, so it
            was skipped
          </span>
        )}
      </div>

      {hasAdvice && (
        <div className={styles.advice}>
          {headline && <b>{headline}</b>}{" "}
          {guidance.message && <span>{guidance.message}</span>}

          {guidance.unknown_words?.length > 0 && (
            <ul className={styles.adviceList}>
              {guidance.unknown_words.map((w) => (
                <li key={w.word}>
                  <i>{w.word}</i> isn&rsquo;t a word in the collection
                  {w.did_you_mean?.length > 0 ? (
                    <>
                      {" — did you mean "}
                      {w.did_you_mean.map((s, i) => (
                        <span key={s}>
                          {i > 0 && " or "}
                          <button
                            type="button"
                            className={styles.link}
                            onClick={() => onSuggestion(w.word, s)}
                          >
                            {s}
                          </button>
                        </span>
                      ))}
                      ?
                    </>
                  ) : (
                    "."
                  )}
                </li>
              ))}
            </ul>
          )}

          {guidance.unknown_filters?.length > 0 && (
            <ul className={styles.adviceList}>
              {guidance.unknown_filters.map((f) => (
                <li key={`${f.filter}:${f.value}`}>
                  Nothing is labelled <i>{f.value}</i>. The collection uses{" "}
                  {f.known_values} other {FILTER_LABEL[f.filter]?.toLowerCase() || f.filter}{" "}
                  values{f.examples?.length ? ` — ${f.examples.join(", ")}` : ""}.
                </li>
              ))}
            </ul>
          )}

          {guidance.relax?.length > 0 && (
            <div className={styles.relaxRow}>
              {guidance.relax.map((r) => (
                <button
                  key={`${r.drop}:${r.value}`}
                  type="button"
                  className={styles.relaxBtn}
                  onClick={() => onRelax(r.drop)}
                >
                  {r.drop === "all"
                    ? `Drop every filter — ${r.would_return.toLocaleString()} recipes`
                    : `Drop ${FILTER_LABEL[r.drop]?.toLowerCase() || r.drop} “${r.value}” — ${r.would_return.toLocaleString()} recipes`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── The keep control ────────────────────────────────────────────────────────
//
// One button with two states and one glyph, filled when the recipe is kept.
// Quiet in both states, deliberately: filing a recipe is a small act, and a
// primary button here would compete with the one thing this product is for,
// which is asking for a dish to be invented — the phase's own risk list already
// warns that *the search becomes the product*.
//
// It says **Keep** and not *Save*, because *save* on a screen with a pantry on
// it reads as *save my changes*, and nothing here is being edited.

function KeepButton({ row, saved, onToggle }) {
  return (
    <button
      type="button"
      className={`${kept.keepBtn} ${saved ? kept.keptBtn : ""}`}
      onClick={() => onToggle(row)}
      aria-pressed={saved}
      title={saved ? "Remove from your collection" : "Keep in your collection"}
    >
      <KeepIcon size={14} /> {saved ? "Kept" : "Keep"}
    </button>
  );
}

// ── One row in the list ─────────────────────────────────────────────────────

function ResultRow({ row, open, onOpen }) {
  const facts = [row.cuisine, row.course, row.diet].filter(Boolean);
  return (
    <li className={`${styles.row} ${open ? styles.rowOpen : ""}`}>
      <button type="button" className={styles.rowBtn} onClick={onOpen} aria-expanded={open}>
        <span className={styles.rowName}>{dishName(row.name) || row.recipe_id}</span>
        <span className={styles.rowFacts}>
          {facts.join(" · ")}
          {row.total_time_min != null && ` · ${row.total_time_min} min`}
          {row.ingredient_count > 0 && ` · ${row.ingredient_count} ingredients`}
        </span>
        {/* Why this row is here. A result that cannot say why it matched is a
            result a chef stops trusting on the third bad hit — the response
            carries the terms and the fields each one hit, so the row says so
            rather than showing a relevance score nobody can read. */}
        {row.match?.length > 0 && (
          <span className={styles.rowMatch}>
            matched{" "}
            {row.match.map((m, i) => (
              <span key={m.term}>
                {i > 0 && ", "}
                <b>{m.term}</b>
                <span className={styles.rowMatchWhere}> in {m.fields.join(", ")}</span>
              </span>
            ))}
          </span>
        )}
        {/* A **scope** flag, not a quality one, and the wording has to carry
            that. These 1,755 recipes are correct, published and searchable; they
            are outside the *Indian and fusion* view generation draws parents
            from, which was a decision about parent selection and not about the
            food. "Excluded" or a warning colour would libel a perfectly good
            lasagne. */}
        {row.used_by_generation === false && (
          <span className={styles.scope}>outside the pool the agent invents from</span>
        )}
      </button>
    </li>
  );
}
