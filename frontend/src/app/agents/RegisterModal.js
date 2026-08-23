"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Dropdown from "@/app/agents/recipe/_components/Dropdown";
import { INDIAN_STATES, registerAgent } from "@/lib/agentOptions";
import styles from "./register.module.css";

// First-time setup for the Recipe Agent. Shown once per restaurant: provisions
// an API key, then hands off to the agent page.
//
// ## V4 P-V Day 11 — four questions became one, and the modal was also broken
//
// It used to ask four things: a **kitchen** (from `GET /admin/kitchens`), a
// location, a **venue type** and up to 31 **specialty tags**. Three of the four
// are gone, and only the third is a taste decision:
//
// **The kitchen picker could not work.** P-I Day 8 deleted both
// `GET /admin/kitchens` and the binding it fed, because a V4 account is bound to
// no kitchen — the cuisine arrives with the request. The list 404'd, the field
// was required, and so **no new account could provision a key at all** from the
// moment V4 landed until this day. It is the phase's one live break rather than
// a tidy-up, and it is why Days 3-9 were verified against a key inserted into
// the database by hand.
//
// **The specialty tags went nowhere.** They fed the ranking API's catalogue
// scoring, which was deleted with it; the backend now drops the field and names
// it in `warnings`. Thirty-one chips across three groups, for a value nothing
// reads, on the one screen a chef sees before they are allowed to start.
//
// **The venue kind is asked on the request screen instead, and this is the
// decision the phase plan disagrees with.** Day 11's brief says *simplify the
// registration modal to name, city and venue kind*. The venue kind is not here,
// for a reason this component is in the worst position to work around: it runs
// **before the account has an API key**, so it cannot call `GET /v4/options`,
// so its venue list has to be a hand-written copy — and the copy that existed
// offered **8 of the registry's 15**, with no Bakery, no Tea House and no Street
// Food. A bakery registering through it would have filed itself under
// *Specialty*. Meanwhile V4 moved the venue kind into the request (P-I Day 8),
// where a dropdown *can* read the registry and does, and where the answer
// actually reaches the brief instead of being dropped with a warning. So the
// question is asked once per request by a control that knows all fifteen answers
// and remembers the last one, rather than once per account by a control that
// knows eight and stores it nowhere.
//
// What is left is the location, which the backend's account record does store.
// It drives nothing — the weather comes with each request — and it is asked
// because an account with no location is one nobody can tell apart in a support
// queue.
//
// The overlay/backdrop, open+close animation, Escape and backdrop-dismiss are
// all handled by the shared <Modal>; this component only owns the form.
export default function RegisterModal({ open, restaurantName, onClose, onDone }) {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (busy) return;
    if (!state || !city.trim()) {
      setError("Please tell us where your restaurant is (state and city).");
      return;
    }
    setBusy(true);
    const result = await registerAgent({ city: city.trim(), state });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    onDone();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!busy} /* can't dismiss mid-request */
      overlayClassName={styles.overlay}
      panelClassName={styles.panel}
      labelledBy="agent-setup-title"
    >
      <h2 id="agent-setup-title" className={styles.title}>
        Set up the Recipe Agent
      </h2>
      <p className={styles.sub}>
        A one-time setup for <strong>{restaurantName}</strong>. One question, and
        then the agent is yours &mdash; what kind of food you want, and what you
        have in the kitchen, you tell it per dish rather than once and for all.
      </p>

      <div className={styles.section}>
        <label className={styles.label}>
          Where is your restaurant? <span className={styles.req}>*</span>
        </label>
        <div className={styles.locationRow}>
          <div>
            <span className={styles.fieldLabel}>State</span>
            <Dropdown
              value={state}
              onChange={(v) => {
                setState(v);
                if (error) setError("");
              }}
              options={INDIAN_STATES}
              ariaLabel="State"
              placeholder="Select state…"
              /* taller menu — the states list is long, so show more at once */
              maxHeight={360}
            />
          </div>
          <div>
            <span className={styles.fieldLabel}>City</span>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Hyderabad"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                if (error) setError("");
              }}
            />
          </div>
        </div>
        <p className={styles.hint}>
          Recorded on your account, and nothing reads it. The agent asks about the
          weather with each request instead &mdash; a chef planning Thursday knows
          more about Thursday than a forecast does.
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.ghost}
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={handleSubmit}
          disabled={busy}
        >
          {busy ? "Setting up…" : "Start using the agent"}
        </button>
      </div>
    </Modal>
  );
}
