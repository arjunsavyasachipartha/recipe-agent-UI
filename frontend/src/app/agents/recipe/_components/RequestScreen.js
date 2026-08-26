"use client";

import { useEffect, useMemo, useState } from "react";
import { agentPost } from "@/lib/agent/client";
import PantryField from "./PantryField";
import Dropdown from "./Dropdown";
import MatchDial from "./MatchDial";
import StaplesEditor from "./StaplesEditor";
import IntentEcho from "./IntentEcho";
import Results from "./Results";
import { useReach } from "./useReach";
import { useHealth, COLD_START_HINT } from "./useHealth";
import {
  cuisineTree,
  signalDomain,
  titleCase,
  useOptions,
  withBlank,
} from "./useOptions";
import base from "./phase2.module.css";
import styles from "./request.module.css";

// V4 Phase 5 Days 3-4 — the request screen.
//
// Sign in, open the agent, land here. Pantry, dropdowns, a sentence, a count, a
// dial, a button. Results below. Nothing else.
//
// This is a **new file rather than an edit of `SynthesisPanel`**, for the reason
// `app/models/generate.py` gives about itself: `/v3` is superseded and still
// served, its request shape changes incompatibly under V4, and editing the
// screen in place would leave one component trying to speak both contracts. The
// V3 panel stays until Day 11 takes it out with the rest of the V3 workspace.
//
// ## What each day put here
//
// **Day 3, the layout.** One column, in the order the chef thinks: the pantry
// first and given room, then a compact grid of dropdowns, then the sentence,
// then the two numbers, then the button. Everything below the pantry is
// optional, and the screen says so **once**, at the top of the grid — marking
// eight fields "optional" is how a tool turns into a tax return.
//
// **Day 4, the dropdowns.** Every one of them is fed from `GET /v4/options` and
// nothing in this file declares a vocabulary. The cuisine picker is two levels,
// which is P-I Day 2's decision arriving: 76 fine cuisines is too many for one
// list and 7 regions is too coarse, so the chef picks a region and may then
// narrow it — and **both levels are legal `cuisine` values**, so the second
// dropdown is genuinely optional rather than a step.
//
// **Day 5, the dial and the count.** The percentage slider is gone. `MatchDial`
// reads the five named stops off `GET /v4/options` and prints, under each one,
// how many dishes of this cuisine this pantry actually reaches — live, from
// `POST /v4/reach`, before the button is pressed. The `n` control says what `n`
// is: a request and not a guarantee.
//
// **Day 11, the one thing the registration modal stopped asking.** The venue
// dropdown remembers its last answer in the browser — see `VENUE_MEMORY`. The
// modal used to ask for a venue kind, send it to a backend that drops it, and
// offer 8 of the registry's 15 values while doing so.
//
// **Day 6, the sentence box.** `IntentEcho` renders `brief.intent` after a run:
// the sentence marked up in place from the parser's own offsets, what could not
// be used and why, what each phrase became, and how wide a *no* was read.
//
// **Days 7-9, the answer.** `Results` draws it: the cards, the funnel and the
// not-shown list collapsed beneath them, and — when nothing came back — the
// stage that emptied the page with the one control most likely to fix it, as a
// button that sets it and asks again. `useHealth` is what keeps a slow first
// request from reading as a hung one.
//
// ## The one thing on this screen with no day behind it
//
// **There is no accept/reject on a card.** `POST /v4/feedback` is built, served
// and allowlisted, and V3 put the verdict on the card for a good reason — a chef
// reading a recipe has an opinion about it *there*. No day in this phase's plan
// owns it, so it is not built here rather than smuggled in; it is recorded in
// the phase notes as an endpoint the one screen currently cannot reach.

//: The one number this file states, because no registry states it: how much of
//: the sentence box a chef may type. Mirrored from `MAX_INTENT_CHARS` in
//: `app/models/generate.py`, where over the ceiling is a 422 rather than a
//: silent truncation.
const MAX_INTENT = 500;

//: V4 P-V Day 11. Where the *Kind of place* dropdown remembers its last answer.
//:
//: The registration modal used to ask for a venue type, and P-I Day 8 had
//: already moved the venue kind into the request — so the answer was dropped by
//: the backend with a warning and the question was theatre. Day 11 took the
//: question out of the modal rather than out of the product, because a chef does
//: answer it identically on almost every request: a dhaba is a dhaba.
//:
//: It lives in the browser and not on the account, and the reason is the one
//: that made the modal's copy wrong in the first place. This control reads the
//: **registry** — all fifteen venues, through `GET /v4/options` — and the modal
//: could not, because it runs before the account has a key. A default stored in
//: `localStorage` by the control that knows the vocabulary cannot drift from it;
//: a column written by a form that knows eight of fifteen values can, and did.
//:
//: What is lost is that the default does not follow a chef to another browser.
//: That is a real cost and it is the smaller one: a wrong default on a control
//: sitting in front of the chef, in a list they can see, is a keystroke to fix.
const VENUE_MEMORY = "bb.v4.venue_type";

export default function RequestScreen() {
  const { options, loading: loadingOptions, error: optionsError } = useOptions();

  // ── The request ────────────────────────────────────────────────────────
  const [pantry, setPantry] = useState([]);   // canonical ids, from PantryField
  const [region, setRegion] = useState("");
  const [cuisine, setCuisine] = useState(""); // "" = the region itself
  const [venue, setVenue] = useState("");
  const [mealSlot, setMealSlot] = useState("");
  const [season, setSeason] = useState("");
  const [raining, setRaining] = useState(false);
  const [course, setCourse] = useState("");
  const [diet, setDiet] = useState("");
  const [allergens, setAllergens] = useState([]);
  const [intent, setIntent] = useState("");
  const [match, setMatch] = useState(null);   // null until defaults arrive
  const [novelty, setNovelty] = useState(null);
  const [n, setN] = useState(null);

  // ── The answer ─────────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // The three starting values come from the backend — `defaults` is on the
  // options response precisely so that changing one is a backend change and not
  // a coordinated one. Applied once, and only over a control the chef has not
  // touched yet.
  useEffect(() => {
    if (!options?.defaults) return;
    setMatch((v) => (v == null ? options.defaults.ingredient_match_pct ?? 50 : v));
    setNovelty((v) => (v == null ? options.defaults.novelty ?? 0.5 : v));
    setN((v) => (v == null ? options.defaults.n ?? 5 : v));
  }, [options]);

  // Day 11. The remembered venue, applied once and only over a control the chef
  // has not touched — the same rule the three backend defaults above follow.
  // Read in an effect rather than in `useState`'s initialiser because this
  // component renders on the server first, where there is no `localStorage`, and
  // an initialiser that read it would hydrate against a different value.
  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem(VENUE_MEMORY);
      if (remembered) setVenue((v) => v || remembered);
    } catch {
      /* private mode, or storage disabled. A missing default is not an error. */
    }
  }, []);

  // Day 9. Polled while cold, so a slow first request can say *the corpus is
  // loading* rather than looking hung. One reader for the whole workspace.
  const { cold } = useHealth();

  // Day 5. What each stop of the dial reaches, for this pantry in this cuisine.
  // Keyed on the two things that can move the curve and on neither the dial's
  // own position nor anything else on the form — see `useReach`.
  const { reach, loading: loadingReach } = useReach({
    cuisine: cuisine || region,
    ingredients: pantry,
  });

  const regions = useMemo(() => cuisineTree(options), [options]);
  const chosenRegion = regions.find((r) => r.region === region);

  // Blank on the second dropdown means *the region itself*, which is a legal
  // cuisine and often the better one: a thin fine label is measured against a
  // 16-recipe yardstick where its region has 31. The label says so rather than
  // leaving "Any" to be guessed at.
  const cuisineOptions = useMemo(
    () =>
      chosenRegion
        ? [
            { value: "", label: `All of ${chosenRegion.region}` },
            ...chosenRegion.cuisines.map((c) => ({
              value: c.cuisine,
              label: c.thin ? `${c.cuisine} · few recipes` : c.cuisine,
            })),
          ]
        : [{ value: "", label: "Pick a region first" }],
    [chosenRegion]
  );

  const venueOptions = useMemo(
    () => [
      { value: "", label: "Any kind of place" },
      ...(options?.venue_types || []).map((v) => ({
        value: v.venue_type,
        label: v.label,
      })),
    ],
    [options]
  );

  // The chosen cuisine's own row, for the one honest thing a picker can say
  // before the button is pressed: how much evidence is behind this choice.
  const cuisineRow = useMemo(() => {
    if (!options) return null;
    if (cuisine) return options.cuisines.find((c) => c.cuisine === cuisine) || null;
    return regions.find((r) => r.region === region) || null;
  }, [options, regions, cuisine, region]);

  function toggleAllergen(name) {
    setAllergens((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  // Build the body. Every optional field is **omitted when blank** rather than
  // sent as an empty string: `situation` forbids unknown keys and the backend
  // distinguishes absent from zero — a temperature nobody knows is not zero
  // degrees, and a blank course does not narrow the search, it declines to.
  function buildBody() {
    const situation = {};
    if (mealSlot) situation.meal_slot = mealSlot;
    if (season) situation.season = season;
    if (raining) situation.raining = true;

    const body = {
      cuisine: cuisine || region,
      ingredients: pantry,
      ingredient_match_pct: Number(match),
      novelty: Number(novelty),
      n: Number(n),
    };
    if (Object.keys(situation).length) body.situation = situation;
    if (venue) body.venue_type = venue;
    if (course) body.course = course;
    if (diet) body.diet_required = diet;
    if (allergens.length) body.allergens = allergens;
    if (intent.trim()) body.intent = intent.trim();
    return body;
  }

  async function invent(e, override) {
    e?.preventDefault();
    if (busy || !region) return;
    setBusy(true);
    setError(null);
    setResult(null);
    // `override` is Day 9's fix button. The patch is applied to the body being
    // sent **and** to the controls, so the screen the chef comes back to agrees
    // with the request that was made — setting state and reading it in the same
    // tick would send the old value, which is the bug this shape avoids.
    const res = await agentPost("/v4/generate", { ...buildBody(), ...(override || {}) });
    setBusy(false);
    if (res.ok) setResult(res.data);
    else setError(res.error);
  }

  // Day 9. One control changed and the request repeated. `patch` is in the
  // screen's own vocabulary (`match`, `novelty`, `intent`, `cuisine`) rather
  // than the request body's, because the thing being changed is a control the
  // chef can then see sitting at its new value.
  function applyFix(patch) {
    if (patch.match !== undefined) setMatch(patch.match);
    if (patch.novelty !== undefined) setNovelty(patch.novelty);
    if (patch.intent !== undefined) setIntent(patch.intent);
    if (patch.cuisine !== undefined) setCuisine(patch.cuisine);

    const body = { ...buildBody() };
    if (patch.match !== undefined) body.ingredient_match_pct = patch.match;
    if (patch.novelty !== undefined) body.novelty = patch.novelty;
    if (patch.intent !== undefined) {
      if (patch.intent) body.intent = patch.intent;
      else delete body.intent;
    }
    if (patch.cuisine !== undefined) body.cuisine = patch.cuisine || region;
    invent(null, body);
  }

  if (optionsError) {
    return (
      <div className={`${styles.note} ${styles.noteErr}`}>
        <span className={styles.noteTitle}>Couldn&rsquo;t load the agent&rsquo;s options.</span>{" "}
        {optionsError}
      </div>
    );
  }

  const overLimit = intent.length > MAX_INTENT;
  const ready = Boolean(region) && !overLimit && !loadingOptions;

  return (
    <form className={styles.screen} onSubmit={invent}>
      {/* ── 1. The pantry — the only required field ─────────────────────── */}
      <PantryField onChange={setPantry} />

      {/* The staple list, directly under the pantry it belongs beside. It was
          first put under the match dial, on the reasoning that the exemption is
          the dial's other half — true of the *arithmetic*, and wrong about the
          chef. What a chef reads here is a second list of ingredients, and the
          question it answers — *what am I assumed to already have?* — is the
          pantry's question, not the dial's. So it sits where the first list
          ends, collapsed, costing one line until it is wanted. */}
      <StaplesEditor />

      {/* ── 2. The dish ─────────────────────────────────────────────────── */}
      <div className={styles.band}>
        <p className={styles.optionalNote}>
          Everything below is <b>optional</b> except the cuisine. Leave anything you
          don&rsquo;t know blank &mdash; blank means &ldquo;unknown&rdquo; and is handled
          properly, not read as nothing.
        </p>

        <div className={styles.grid}>
          <div className={styles.cell}>
            <label className={styles.cellLabel}>
              Cuisine <span className={styles.req}>· required</span>
            </label>
            <Dropdown
              value={region}
              onChange={(v) => {
                setRegion(v);
                setCuisine(""); // a fine label from the old region is not legal here
              }}
              options={withBlank(
                regions.map((r) => r.region),
                loadingOptions ? "Loading…" : "Choose a region"
              )}
              ariaLabel="Cuisine region"
            />
          </div>

          <div className={styles.cell}>
            <label className={styles.cellLabel}>Narrow it (optional)</label>
            <Dropdown
              value={cuisine}
              onChange={setCuisine}
              options={cuisineOptions}
              ariaLabel="Cuisine"
            />
          </div>

          <div className={styles.cell}>
            <label className={styles.cellLabel}>Kind of place</label>
            <Dropdown
              value={venue}
              onChange={(v) => {
                setVenue(v);
                try {
                  if (v) window.localStorage.setItem(VENUE_MEMORY, v);
                  else window.localStorage.removeItem(VENUE_MEMORY);
                } catch {
                  /* nothing to do — the request still carries the value */
                }
              }}
              options={venueOptions}
              ariaLabel="Venue kind"
            />
          </div>

          <div className={styles.cell}>
            <label className={styles.cellLabel}>Meal</label>
            <Dropdown
              value={mealSlot}
              onChange={setMealSlot}
              options={withBlank(options?.meal_slots, "Any meal", titleCase)}
              ariaLabel="Meal"
            />
          </div>

          <div className={styles.cell}>
            <label className={styles.cellLabel}>Weather</label>
            <Dropdown
              value={season}
              onChange={setSeason}
              options={withBlank(signalDomain(options, "season"), "Whatever it is", titleCase)}
              ariaLabel="Season"
            />
            <label className={styles.subRow}>
              <input
                type="checkbox"
                checked={raining}
                onChange={(e) => setRaining(e.target.checked)}
              />
              and it&rsquo;s raining
            </label>
          </div>

          <div className={styles.cell}>
            <label className={styles.cellLabel}>Course</label>
            <Dropdown
              value={course}
              onChange={setCourse}
              options={withBlank(options?.courses, "Any course")}
              ariaLabel="Course"
            />
          </div>

          <div className={styles.cell}>
            <label className={styles.cellLabel}>Diet</label>
            <Dropdown
              value={diet}
              onChange={setDiet}
              options={withBlank(options?.diets, "No restriction", titleCase)}
              ariaLabel="Diet"
            />
          </div>

          <div className={`${styles.cell} ${styles.cellWide}`}>
            <label className={styles.cellLabel}>Nothing containing</label>
            <div className={styles.toggleWrap}>
              {(options?.allergens || []).map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.toggle} ${
                    allergens.includes(name) ? styles.toggleOn : ""
                  }`}
                  aria-pressed={allergens.includes(name)}
                  onClick={() => toggleAllergen(name)}
                >
                  {titleCase(name)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {cuisineRow && (
          <p className={styles.optionalNote}>
            {cuisine
              ? `${cuisine}: ${cuisineRow.region_recipes.toLocaleString()} published recipes to build from`
              : `${cuisineRow.region}: ${cuisineRow.recipes.toLocaleString()} published recipes to build from`}
            {cuisineRow.thin && " — a thin one, so expect fewer and stranger answers."}
          </p>
        )}
      </div>

      {/* ── 3. The sentence ─────────────────────────────────────────────── */}
      <div className={styles.band}>
        <label className={styles.cellLabel} htmlFor="v4-intent">
          Anything else, in your own words
        </label>
        <textarea
          id="v4-intent"
          className={styles.sentence}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={2}
          placeholder="something light to start with, no onion, not too rich"
        />
        <div className={styles.sentenceFoot}>
          <span>The agent reads this and tells you which parts it could use.</span>
          <span className={overLimit ? styles.overLimit : ""}>
            {intent.length}/{MAX_INTENT}
          </span>
        </div>

        {/* Day 6. The echo sits under the box it is about, not down in the
            results: it is feedback on an input, and a chef who has to scroll
            past five dishes to find out that half their sentence was ignored
            will not find out. `edited` is why it does not simply disappear when
            the box is retyped — an echo about text that is no longer on screen
            is worse than one that says so. */}
        {result?.brief?.intent && (
          <IntentEcho
            intent={result.brief.intent}
            edited={intent.trim() !== (result.brief.intent.text || "").trim()}
          />
        )}
      </div>

      {/* ── 4. The numbers ──────────────────────────────────────────────── */}
      <div className={styles.numbers}>
        <MatchDial
          stops={options?.dial_stops}
          value={match ?? 50}
          onChange={setMatch}
          reach={reach}
          loading={loadingReach}
          pantrySize={pantry.length}
        />

        <div className={styles.cell}>
          <div className={styles.dialHead}>
            <label className={styles.cellLabel} htmlFor="v4-novelty">
              How far from the usual
            </label>
            <span className={styles.dialValue}>{novelty ?? "—"}</span>
          </div>
          <input
            id="v4-novelty"
            type="range"
            className={styles.range}
            min={0}
            max={1}
            step={0.05}
            value={novelty ?? 0.5}
            onChange={(e) => setNovelty(Number(e.target.value))}
          />
          <p className={styles.dialSays}>
            Measured against what this cuisine actually cooks, not against your menu.
          </p>
        </div>

        <div className={styles.cell}>
          <label className={styles.cellLabel} htmlFor="v4-n">
            How many dishes
          </label>
          <Dropdown
            id="v4-n"
            value={String(n ?? 5)}
            onChange={(v) => setN(Number(v))}
            options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ({
              value: String(i),
              label: String(i),
            }))}
            ariaLabel="How many dishes"
          />
          {/* The contract is explicit that `n` is a request and not a
              guarantee — a shortfall is reported rather than padded, and the
              screen should not have promised what the response then explains
              away. Day 8 renders the `count` block that says where they ran
              out. */}
          <p className={styles.dialSays}>
            At most. If the cuisine or your pantry runs out first, you get fewer and
            the agent says where it stopped.
          </p>
        </div>
      </div>

      {/* ── 5. The button ───────────────────────────────────────────────── */}
      <div className={styles.actions}>
        <button type="submit" className={base.btnPrimary} disabled={!ready || busy}>
          {busy ? "Inventing…" : "Invent dishes"}
        </button>
        <span className={styles.actionNote}>
          {/* Day 9. The cold note wins over the others while it applies, because
              it is the one that explains a wait the chef is about to have — and
              it is only shown when `/health` has actually said the backend is
              cold, never on a hunch. */}
          {busy && cold
            ? COLD_START_HINT
            : !region
            ? "Choose a cuisine to begin."
            : pantry.length === 0
            ? "Your pantry is empty — the agent will pick whatever suits."
            : `From ${pantry.length} ingredient${pantry.length === 1 ? "" : "s"}.`}
        </span>
      </div>

      {error && (
        <div className={`${styles.note} ${styles.noteErr}`}>
          <span className={styles.noteTitle}>Couldn&rsquo;t invent anything.</span> {error}
        </div>
      )}

      {/* Days 7-9. `controls` is what the fix button computes a change from —
          the screen's current settings, not the request that produced this
          answer, because the chef may have moved something since. */}
      {result && (
        <Results
          result={result}
          controls={{
            match: match ?? 50,
            novelty: novelty ?? 0.5,
            intent: intent.trim(),
            cuisine,
            region,
          }}
          stops={options?.dial_stops}
          onFix={applyFix}
        />
      )}
    </form>
  );
}
