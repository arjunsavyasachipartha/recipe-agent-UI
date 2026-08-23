"use client";

import { useState } from "react";
import { agentPost } from "@/lib/agent/client";
import Dropdown from "./Dropdown";
import { useOptions } from "./useOptions";
import styles from "./request.module.css";

// V4 Phase 5 Day 11 — the chef's verdict, on the card.
//
// ## Why this exists on a cleanup day
//
// It was the phase's one recorded live gap. `POST /v4/feedback` is built,
// served and allowlisted; **no day in the plan owned putting it on the screen**,
// so Days 7 and 8 listed what a card and the honest section carry, the verdict
// was on neither list, and it was left out rather than smuggled in — recorded in
// the notes as *the one screen currently cannot reach an endpoint the product
// serves*, for Day 11 or Day 12 to either build or strike.
//
// It is built rather than struck, on the phase's own new criteria: *the one that
// matters most and is still the only one a machine cannot check is the chef
// review.* V3 built the blind pack and never got it rated. A product whose only
// route to a chef's opinion is a separate rating exercise will collect opinions
// exactly as often as somebody runs the exercise.
//
// V3's argument for putting it *here* rather than behind a navigation is the one
// worth keeping: **a chef reading a recipe has an opinion about it there**, and
// asking them to remember it through a navigation is how a feedback log stays
// empty.
//
// ## What the endpoint enforces, and what that means for the control
//
// `SynthesisFeedbackRequest` validates both directions:
//
//   * a **reject** without a reason is a 422, and
//   * an **accept** *with* one is a 422 too.
//
// The second is the one a UI gets wrong. So the reason picker appears only after
// *No*, and accepting sends `{verdict: "accept"}` with no reason key at all
// rather than `reason: null` — which the model would accept, but which is a
// shape that invites somebody to start sending the last picked reason along with
// an acceptance.
//
// The reject **cannot be sent until a reason is chosen**, for the same reason
// the endpoint refuses it: the note calls a reasonless rejection *the case the
// acceptance study needs and would otherwise quietly lose*. A control that let a
// chef press *No* and walk away would produce exactly the row that cannot be
// counted.
//
// ## The vocabulary is served, not written here
//
// `reject_reasons` on `GET /v4/options` is the **vetted subset** — the machine's
// defect words a chef can actually mean, plus the chef-only ones — each with the
// label the taxonomy gives it. This is the one list on the screen that *can* be
// served, and the funnel's cannot: see the note on `STAGE` in `Results.js` for
// why those two are different problems.

export default function Verdict({ generationId, cardId }) {
  const { options } = useOptions();
  const [state, setState] = useState("idle"); // idle | rejecting | sending | done
  const [verdict, setVerdict] = useState(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  const reasons = options?.reject_reasons || [];

  async function send(body) {
    setState("sending");
    setError(null);
    const res = await agentPost("/v4/feedback", {
      generation_id: generationId,
      card_id: cardId,
      ...body,
    });
    if (res.ok) {
      setVerdict(body.verdict);
      setState("done");
    } else {
      setState(body.verdict === "reject" ? "rejecting" : "idle");
      setError(typeof res.error === "string" ? res.error : "Couldn't log that.");
    }
  }

  // Logged and not undoable from here. A verdict is a measurement, and a screen
  // that lets one be taken back turns the feedback log into the chef's current
  // opinion rather than a record of what they thought when they read the card.
  // Sending a second verdict for the same card is the endpoint's business, not
  // this control's.
  if (state === "done") {
    return (
      <p className={styles.verdictDone}>
        {verdict === "accept"
          ? "Noted — you'd cook this."
          : "Noted — thanks, that's the part that makes the next answer better."}
      </p>
    );
  }

  return (
    <div className={styles.verdict}>
      {state !== "rejecting" ? (
        <>
          <span className={styles.verdictAsk}>Would you cook this?</span>
          <button
            type="button"
            className={styles.verdictBtn}
            disabled={state === "sending"}
            onClick={() => send({ verdict: "accept" })}
          >
            Yes
          </button>
          <button
            type="button"
            className={styles.verdictBtn}
            disabled={state === "sending"}
            onClick={() => {
              setState("rejecting");
              setError(null);
            }}
          >
            No
          </button>
        </>
      ) : (
        <>
          <span className={styles.verdictAsk}>What&rsquo;s wrong with it?</span>
          <div className={styles.verdictReason}>
            <Dropdown
              value={reason}
              onChange={setReason}
              options={[
                { value: "", label: "Pick the closest…" },
                ...reasons.map((r) => ({ value: r.reason, label: r.label })),
              ]}
              ariaLabel="Why not"
              maxHeight={320}
            />
          </div>
          <input
            className={styles.verdictNote}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="In your own words (optional)"
            aria-label="Note"
          />
          <button
            type="button"
            className={styles.verdictBtn}
            /* The endpoint refuses a reasonless rejection and so does this. */
            disabled={!reason || state === "sending"}
            onClick={() =>
              send({ verdict: "reject", reason, ...(note.trim() ? { note: note.trim() } : {}) })
            }
          >
            Send
          </button>
          <button
            type="button"
            className={styles.verdictCancel}
            onClick={() => {
              setState("idle");
              setReason("");
              setError(null);
            }}
          >
            Cancel
          </button>
        </>
      )}
      {error && <span className={styles.verdictErr}>{error}</span>}
    </div>
  );
}
