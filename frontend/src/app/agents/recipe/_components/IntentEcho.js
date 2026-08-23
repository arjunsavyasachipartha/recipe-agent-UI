"use client";

import { useMemo } from "react";
import styles from "./request.module.css";

// V4 Phase 5 Day 6 — the sentence box, read back.
//
// The brief: *free text, with the parsed-and-used slots echoed back after a run,
// and — more importantly — what could **not** be used.* The backend has carried
// both halves since P-II Day 7 and nothing rendered them; this is that echo.
//
// ## Why the emphasis is on the second half
//
// **A text box that silently drops half its input is worse than no text box.**
// A chef who types *something light to start with, no onion, quick* and gets
// five dishes has no way to know whether *quick* did anything — and the natural
// conclusion, that the box reads everything, is the expensive one: they keep
// typing into it and keep being disappointed by answers that ignored the part
// they cared most about. So the unused half is not a footnote here. It is the
// first list, it says why in the chef's terms, and where a phrase was
// *ambiguous* it names the readings, because *we have no word for this* and
// *this word means two things* are different news and only one of them is fixed
// by rephrasing.
//
// ## The sentence is marked up in place
//
// Two lists of phrases beside a sentence make the chef do the matching. Marking
// the sentence itself is the version they can read at a glance — green under
// what landed, dotted under what did not, plain for the filler. The offsets are
// the parser's own (`used[].start/.end` and `unused[].start/.end`), never a
// string search: *chilli, and not too much chilli* has two of the same word and
// only one of them was read.
//
// ## What this does not do
//
// It does not re-parse, guess, or explain a phrase the backend did not explain.
// Every word in the echo below comes from the response — `does` is written in
// `ml/generation/intent.py`'s `DESTINATIONS`, beside the code that performs it.

//: What each unused reason means, in a chef's terms rather than the taxonomy's.
//: This is a rendering of a closed vocabulary the backend owns — the four words
//: are `ungrounded`, `ambiguous`, `only_as_an_exclusion` and `cannot_be_refused`
//: — and an unknown one falls through to the word itself rather than being
//: dropped, because a reason nobody rendered is still a reason the chef is owed.
const WHY_NOT = {
  ungrounded: "we have no word for this",
  ambiguous: "this could mean two things",
  only_as_an_exclusion: "this only means something as a “no”",
  cannot_be_refused: "the agent can prefer this but cannot refuse it",
};

//: How a used phrase is grouped in the summary. The order is the order a chef
//: cares about: the hard rule first, then what was preferred.
const KIND_LABEL = {
  exclusion: "Refused outright",
  ingredient: "Preferred",
  attribute: "Asked for",
  course: "Asked for",
  family: "Steered towards",
  technique: "Steered towards",
};

export default function IntentEcho({ intent, edited }) {
  const text = intent?.text || "";
  const used = intent?.used || [];
  const unused = intent?.unused || [];

  // The sentence cut into runs at every marked span. Spans are sorted and
  // overlaps dropped — a parser that emitted two readings of one phrase would
  // otherwise produce a garbled sentence, which is a worse failure than showing
  // the second reading only in the list below.
  const runs = useMemo(() => {
    const spans = [
      ...used.map((u) => ({ ...u, mark: "used" })),
      ...unused.map((u) => ({ ...u, mark: "unused" })),
    ]
      .filter((s) => Number.isInteger(s.start) && s.end > s.start)
      .sort((a, b) => a.start - b.start);

    const out = [];
    let at = 0;
    for (const span of spans) {
      if (span.start < at) continue;
      if (span.start > at) out.push({ mark: null, text: text.slice(at, span.start) });
      out.push({ ...span, mark: span.mark, text: text.slice(span.start, span.end) });
      at = span.end;
    }
    if (at < text.length) out.push({ mark: null, text: text.slice(at) });
    return out;
  }, [text, used, unused]);

  // Used phrases gathered under what they became, so a chef reads four groups
  // rather than nine rows. `does` is the backend's sentence and is shown once
  // per group — it is a property of the kind, not of the phrase.
  const groups = useMemo(() => {
    const by = new Map();
    for (const u of used) {
      const label = KIND_LABEL[u.kind] || u.kind;
      if (!by.has(label)) by.set(label, { label, does: u.does, items: [] });
      by.get(label).items.push(u);
    }
    const order = ["Refused outright", "Asked for", "Preferred", "Steered towards"];
    return [...by.values()].sort(
      (a, b) => order.indexOf(a.label) - order.indexOf(b.label)
    );
  }, [used]);

  if (!intent || !text.trim()) return null;

  const excluded = intent.excluded_ingredients || [];
  // V4 P-VI Day 1. Whether the sentence was read as an instruction or a leaning,
  // said out loud. This is the one thing on the echo a chef can act on
  // immediately — if it read *give me sweets* as a preference, or *preferably
  // sweet* as a fence, the fix is a word in the box — so it goes at the top
  // rather than in a tooltip.
  const required = intent.requirements?.attributes || {};
  const requiredCount =
    Object.keys(required).length +
    (intent.requirements?.families?.length || 0) +
    (intent.requirements?.techniques?.length || 0);

  return (
    <div className={styles.echo}>
      <div className={styles.echoHead}>
        What the agent made of your sentence
        {edited && (
          <span className={styles.echoStale}>
            &mdash; you&rsquo;ve changed it since; this is what was sent
          </span>
        )}
      </div>

      <p className={styles.echoSentence}>
        {runs.map((run, i) =>
          run.mark ? (
            <span
              key={i}
              className={run.mark === "used" ? styles.markUsed : styles.markUnused}
              title={
                run.mark === "used"
                  ? `${run.value} — ${run.does}`
                  : WHY_NOT[run.reason] || run.reason
              }
            >
              {run.text}
            </span>
          ) : (
            <span key={i}>{run.text}</span>
          )
        )}
      </p>

      {/* How hard it was read. Named before anything else the echo says,
          because it is the half that changes what comes back. */}
      <p className={styles.echoStrength}>
        {requiredCount > 0 ? (
          <>
            Read as an <b>instruction</b> &mdash; only dishes that are{" "}
            {Object.values(required).join(", ")} were considered. Start with
            &ldquo;preferably&rdquo; to make it a leaning instead.
          </>
        ) : (
          <>
            Read as a <b>preference</b> &mdash; it ranked dishes up, and dishes
            that missed it were still shown. Say &ldquo;only&rdquo; to make it a
            rule.
          </>
        )}
      </p>

      {/* The half the brief calls more important, and it comes first. */}
      {unused.length > 0 && (
        <div className={styles.echoBlock}>
          <span className={styles.echoBlockHead}>Couldn&rsquo;t use</span>
          <ul className={styles.echoList}>
            {unused.map((u, i) => (
              <li key={i}>
                <b>&ldquo;{u.phrase}&rdquo;</b> &mdash; {WHY_NOT[u.reason] || u.reason}
                {u.readings?.length > 0 && (
                  <>
                    {" "}
                    ({u.readings.slice(0, 3).join(", ")}). Say which and it will be
                    used.
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {groups.length > 0 && (
        <div className={styles.echoBlock}>
          <span className={styles.echoBlockHead}>Used</span>
          <ul className={styles.echoList}>
            {groups.map((group) => (
              <li key={group.label}>
                <b>{group.label}:</b>{" "}
                {group.items.map((u, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <span className={styles.echoPhrase}>&ldquo;{u.phrase}&rdquo;</span>{" "}
                    <span className={styles.echoValue}>&rarr; {u.value}</span>
                  </span>
                ))}
                <span className={styles.echoDoes}> &mdash; {group.does}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* An exclusion is read wide, and a chef has to be able to see how wide.
          "No onion" reaching `kalonji_onion_nigella_seeds` — which is not an
          onion — is the kind of thing that is defensible in a report and
          startling in a result, and the only place to say so is here. */}
      {excluded.length > 0 && (
        <p className={styles.echoWide}>
          Your &ldquo;no&rdquo; was read wide and refuses{" "}
          <b>{excluded.length} ingredient{excluded.length === 1 ? "" : "s"}</b>:{" "}
          {excluded.slice(0, 8).join(", ").replace(/_/g, " ")}
          {excluded.length > 8 && ` and ${excluded.length - 8} more`}. Nothing can
          outvote it.
        </p>
      )}

      {unused.length === 0 && groups.length === 0 && (
        <p className={styles.echoWide}>
          None of this sentence reached a word the agent knows, so it changed
          nothing about the dishes below.
        </p>
      )}
    </div>
  );
}
