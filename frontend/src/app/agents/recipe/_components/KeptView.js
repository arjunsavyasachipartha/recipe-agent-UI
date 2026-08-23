"use client";

import { useEffect, useState } from "react";
import ResultCard from "./ResultCard";
import RecipePanel, { dishName } from "./RecipePanel";
import { KeepIcon } from "./icons";
import { useCreations, useKept } from "./useKept";
import search from "./search.module.css";
import styles from "./kept.module.css";

// The collection — what a chef kept, in two lists that are deliberately not one.
//
// ## Why two lists and not one
//
// A published recipe a chef saved and an invented dish a chef accepted are both
// *food I want to keep*, and they are the two halves this product spends its
// whole surface keeping apart: the search view carries a header saying **this
// agent composed none of these**, `RecipePanel` refuses to draw a `why` or a
// parent list, and the request screen and the search view are siblings rather
// than tabs. A chef's own collection is the one place the two would blur —
// because in a collection both are just *dishes I liked* — so the boundary is
// drawn here too, in two tabs with two row shapes and two sentences, and the
// backend serves them as two endpoints with `source: "corpus"` and `source:
// "synthesis"` on them so a client cannot merge them by accident.
//
// Tabs here rather than a third and fourth nav item, and that is the one place
// this file argues *for* putting two things together. The nav answers *what am I
// doing* — inventing, finding, reading what I kept — and a chef who has opened
// the collection has already answered it. Splitting the nav again would put the
// two halves of one answer two clicks apart.
//
// ## The dishes tab has no save button and no delete
//
// Keeping an invented dish is answering **yes** to *would you cook this?* on the
// card — `POST /v4/feedback`, which is the acceptance signal this whole build is
// measured against. A second control would make two records of one opinion, free
// to disagree; a delete would let a chef quietly withdraw a measurement. A dish
// leaves this list when the verdict changes, which is a fact rather than a
// tidy-up, and the card here says so rather than offering a button that pretends
// otherwise.

const TABS = [
  { id: "dishes", label: "Dishes you'd cook" },
  { id: "recipes", label: "Recipes you saved" },
];

export default function KeptView({ active }) {
  const [tab, setTab] = useState("dishes");
  const { saved, loading: savedLoading, error: savedError, drop } = useKept();
  const { creations, loading: creationsLoading, error: creationsError, reload } =
    useCreations();

  // Refetched when the view is opened, not polled. The only thing that changes
  // the accepted list is a verdict the chef logged on a card in the other view a
  // moment ago, and this is the moment they come to look at it.
  useEffect(() => {
    if (active) reload();
  }, [active, reload]);

  return (
    <div className={styles.view}>
      <div className={styles.tabs} role="tablist" aria-label="What you kept">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
            <span className={styles.tabCount}>
              {id === "dishes" ? creations.length : saved.length}
            </span>
          </button>
        ))}
      </div>

      {tab === "dishes" ? (
        <Creations list={creations} loading={creationsLoading} error={creationsError} />
      ) : (
        <Saved list={saved} loading={savedLoading} error={savedError} onDrop={drop} />
      )}
    </div>
  );
}

// ── The dishes a chef said yes to ───────────────────────────────────────────
//
// `ResultCard` draws them, unchanged, from the stored card the backend hands
// back — which is the card **as it was served**, not a re-composition. That is
// the whole reason the response carries the card rather than the ingredients: a
// dish rebuilt from its inputs would be today's answer to an old request, and on
// a corpus that has moved since it might not even be the same dish.
//
// The verdict control is off (`verdict={false}`): this is a page of dishes whose
// verdict is already in, and asking *would you cook this?* under a dish a chef
// has already said yes to is a question with a recorded answer.

function Creations({ list, loading, error }) {
  if (loading) return <p className={styles.idle}>Reading what you kept…</p>;
  if (error) {
    return (
      <div className={search.error}>
        <b>Couldn&rsquo;t load your dishes.</b> {error}
      </div>
    );
  }
  if (!list.length) {
    return (
      <p className={styles.idle}>
        Nothing here yet. When a dish comes back from <i>Invent</i> that you would
        actually cook, answer <b>Yes</b> to <i>would you cook this?</i> at the foot
        of the card &mdash; it is kept here, exactly as it was served, with the
        published dishes it was built from.
      </p>
    );
  }

  return (
    <>
      <p className={styles.lead}>
        Dishes this agent invented and you said you would cook, newest first. Each
        one is the card <b>as it was served</b> &mdash; not rebuilt, so the grams and
        the method are the ones you read when you said yes.
      </p>
      <div className={styles.cards}>
        {list.map((row) => (
          <div key={row.card_id} className={styles.creation}>
            <p className={styles.keptWhen}>
              Kept {when(row.accepted_at)}
              {row.cuisine ? ` · ${row.cuisine}` : ""}
              {row.cooked ? " · you cooked it" : ""}
              {row.note ? ` · “${row.note}”` : ""}
            </p>
            <ResultCard
              card={row.card}
              generationId={row.generation_id}
              verdict={false}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// ── The published recipes a chef saved ──────────────────────────────────────
//
// The search view's shape, one list and one panel, and the same `RecipePanel` —
// not a copy of it. Point 3 of the rule this product keeps: a found dish must
// not look like an invented one, and the component that enforces it in markup is
// the one that must be shared rather than reimplemented.

function Saved({ list, loading, error, onDrop }) {
  const [openId, setOpenId] = useState(null);

  if (loading) return <p className={styles.idle}>Reading your collection…</p>;
  if (error) {
    return (
      <div className={search.error}>
        <b>Couldn&rsquo;t load your collection.</b> {error}
      </div>
    );
  }
  if (!list.length) {
    return (
      <p className={styles.idle}>
        Nothing saved yet. Open a recipe under <i>Find</i> and press <b>Keep</b> at
        the top of it &mdash; it is added here, and the recipe you read tomorrow is
        the recipe as published rather than a copy taken today.
      </p>
    );
  }

  const missing = list.filter((row) => !row.available).length;

  return (
    <>
      <p className={styles.lead}>
        Published recipes you kept, newest first. <b>This agent composed none of
        them</b> &mdash; each one links to whoever published it.
      </p>
      {missing > 0 && (
        <p className={styles.missing}>
          {missing} of these {missing === 1 ? "does" : "do"} not resolve in this
          deployment &mdash; the collection has moved since {missing === 1 ? "it was" : "they were"}{" "}
          kept, or the recipe was withdrawn. {missing === 1 ? "It is" : "They are"} still
          listed rather than dropped, and can still be removed.
        </p>
      )}

      <div className={search.split}>
        <ol className={styles.list}>
          {list.map((row) => (
            <SavedRow
              key={row.recipe_id}
              row={row}
              open={openId === row.recipe_id}
              onOpen={() =>
                setOpenId((id) => (id === row.recipe_id ? null : row.recipe_id))
              }
              onDrop={() => {
                if (openId === row.recipe_id) setOpenId(null);
                onDrop(row.recipe_id);
              }}
            />
          ))}
        </ol>

        <div className={search.panelSlot}>
          {openId ? (
            <RecipePanel
              recipeId={openId}
              onClose={() => setOpenId(null)}
              action={
                <button
                  type="button"
                  className={styles.keepBtn}
                  onClick={() => {
                    setOpenId(null);
                    onDrop(openId);
                  }}
                >
                  <KeepIcon size={14} /> Remove
                </button>
              }
            />
          ) : (
            <p className={search.panelIdle}>
              Pick one to read the whole of it &mdash; every ingredient in grams, the
              method as published, and the link to its source.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// One saved row. **Not** the search view's `ResultRow`: that one draws the terms
// that matched, which is a fact about a query and there is no query here. The
// two rows carry the remove control, which is why this one is a `<div>` with two
// buttons in it rather than a row that is itself a button — a button inside a
// button is markup no browser agrees about.

function SavedRow({ row, open, onOpen, onDrop }) {
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
        {row.note && <span className={styles.rowNote}>&ldquo;{row.note}&rdquo;</span>}
        {!row.available && (
          <span className={styles.rowGone}>
            this one no longer resolves — kept in your list, and removable
          </span>
        )}
        {/* The same scope line the search view draws, and it means the same
            thing: these recipes are correct and published, they are outside the
            *Indian and fusion* view generation draws parents from. A warning
            colour would libel a perfectly good lasagne. */}
        {row.used_by_generation === false && (
          <span className={search.scope}>outside the pool the agent invents from</span>
        )}
      </button>
      <button
        type="button"
        className={styles.rowDrop}
        onClick={onDrop}
        aria-label={`Remove ${dishName(row.name) || row.recipe_id} from your collection`}
        title="Remove from your collection"
      >
        ×
      </button>
    </li>
  );
}

//: A date a chef reads, not an ISO string. Nothing here counts days — *2 days
//: ago* on a row that says *Kept* is a sentence the reader has to do arithmetic
//: on to place, and the actual date is shorter and exact.
function when(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "recently";
  }
}
