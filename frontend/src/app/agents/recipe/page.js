"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser } from "@/lib/auth";
import { useNavLoading } from "@/components/NavLoadingProvider";
import BrandMark from "@/components/BrandMark";
import RequestScreen from "./_components/RequestScreen";
import SearchView from "./_components/SearchView";
import KeptView from "./_components/KeptView";
import { KeptProvider } from "./_components/useKept";
import { useHealth } from "./_components/useHealth";
import {
  KitchenIcon,
  InventIcon,
  SearchIcon,
  KeepIcon,
  BackIcon,
  MenuIcon,
  CloseIcon,
} from "./_components/icons";
import styles from "./recipe.module.css";

// The Recipe Agent workspace. One thing happens here: a chef describes a
// situation and gets back complete recipes for dishes that are on no menu.
//
// This used to be a two-level shell — an icon rail switching between a Core
// (chef) mode with six sections and a PIN-gated Manager mode with five analytics
// panels. All eleven belonged to the ranking API and went with it. What is left
// does not need a mode switch or a section list, so it does not have one: a
// sidebar listing a single item is a sidebar arguing for its own existence.
//
// The header still carries the kitchen's identity and the backend status,
// because those answer questions a chef actually has — whose kitchen is this,
// and is the agent reachable.
//
// **V4 P-V Day 10 put a second item back in that list, and only one.** The
// search view is a sibling of the generator, not a tab across the top of it:
// the phase's own risk list says *the search becomes the product — it is the
// easiest thing on the screen to use and the least valuable thing we built. It
// belongs beside the generator, not in front of it.* So `Invent` is the landing
// view, `Find` is below it, and there is no third thing. A sidebar listing one
// item was arguing for its own existence; a sidebar listing two is a choice
// between the two things this product does.

//: The workspace's views. Three, all under the one Kitchen group — the ordering
//: is the argument: a chef opening the agent lands on the thing the agent is
//: for.
//:
//: **The collection is third and last, and that is the same argument the search
//: view got.** It is a place a chef *returns* to rather than one they arrive at,
//: and a landing view showing yesterday's saved dishes would make the product
//: look like a recipe box that occasionally invents something. The two things
//: this agent does come first; what it has already done for you comes after
//: them.
const VIEWS = [
  { id: "invent", label: "Invent", icon: InventIcon, title: "Invent a dish" },
  { id: "find", label: "Find", icon: SearchIcon, title: "Find a published recipe" },
  { id: "kept", label: "Kept", icon: KeepIcon, title: "What you have kept" },
];

function Workspace({ user }) {
  const router = useRouter();
  const { show } = useNavLoading();

  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const [view, setView] = useState("invent");

  // Smoke-test the proxy: `/health` proves the key is injected server-side and
  // the backend answers.
  //
  // `warm` matters here in a way `recipes_loaded` never did. Synthesis is fast
  // warm and slow cold — the frozen datasets and the plausibility calibration
  // are loaded in a background thread at startup — and a chef whose first
  // request is slow is looking at a cold cache, not a hung page.
  //
  // **V4 P-V Day 9 moved the fetch into `useHealth` and made it poll.** Checked
  // once on mount, the pill said *warming up* and then said it forever: the one
  // moment the distinction matters was exactly the moment the pill went stale.
  // The hook is shared with the request screen, so the pill and the button's
  // slow-request note are one answer to one question rather than two fetches
  // that can disagree on screen.
  const { health } = useHealth();

  const statusEl = (
    <span className={styles.status} role="status" aria-live="polite">
      <span
        className={`${styles.dot} ${
          health == null ? "" : health.ok ? styles.dotOk : styles.dotErr
        }`}
      />
      {health == null
        ? "Connecting…"
        : !health.ok
        ? "Backend unreachable"
        : health.warm
        ? "Connected"
        : "Connected · warming up"}
    </span>
  );

  const backToAgents = () => {
    show("Loading…");
    router.push("/agents");
  };

  return (
    <div className={styles.shell}>
      {/* ── Mobile bar (narrow screens; opens the nav drawer) ── */}
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>
        <BrandMark size={26} />
        <span
          className={`${styles.mDot} ${
            health == null ? "" : health.ok ? styles.dotOk : styles.dotErr
          }`}
          title={health?.ok ? "Connected" : health == null ? "Connecting" : "Unreachable"}
        />
      </header>

      {/* Drawer scrim (mobile) */}
      <div
        className={`${styles.scrim} ${navOpen ? styles.scrimOpen : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      {/* ── Left navigation: identity, one section, status ── */}
      <nav className={`${styles.nav} ${navOpen ? styles.navOpen : ""}`} aria-label="Workspace">
        <div className={styles.rail}>
          <div className={styles.railGroup}>
            <RailButton icon={<KitchenIcon />} label="Kitchen" active onClick={() => {}} />
          </div>
          <div className={styles.railSpacer} />
          <RailButton icon={<BackIcon />} label="Agents" onClick={backToAgents} />
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sideHead}>
            <button type="button" className={styles.crumb} onClick={backToAgents}>
              <BackIcon size={13} /> All agents
            </button>
            <div className={styles.sideIdentity}>
              <BrandMark size={38} showWord={false} />
              <div className={styles.sideIdentityText}>
                <h1 className={styles.sideTitle}>Recipe Agent</h1>
                <p className={styles.sideResto}>{user.restaurant_name}</p>
              </div>
            </div>
            <button
              type="button"
              className={styles.sideClose}
              onClick={() => setNavOpen(false)}
              aria-label="Close navigation"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className={styles.sideList}>
            <span className={styles.sideGroupLabel}>
              <KitchenIcon size={13} /> Kitchen
            </span>
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`${styles.navItem} ${view === id ? styles.navItemActive : ""}`}
                aria-current={view === id ? "page" : undefined}
                onClick={() => {
                  setView(id);
                  setNavOpen(false); // the mobile drawer is a navigation
                }}
              >
                <span className={styles.navIcon}>
                  <Icon size={18} />
                </span>
                <span className={styles.navLabel}>{label}</span>
              </button>
            ))}
          </div>

          <div className={styles.sideFoot}>{statusEl}</div>
        </div>
      </nav>

      {/* ── Content pane ── */}
      <main className={styles.main}>
        <div className={styles.contentInner}>
          <div className={styles.section}>
            <div className={styles.sectionBody}>
              <header className={styles.sectionHead}>
                <span className={styles.sectionKicker}>
                  {view === "find" ? (
                    <SearchIcon size={15} />
                  ) : view === "kept" ? (
                    <KeepIcon size={15} />
                  ) : (
                    <InventIcon size={15} />
                  )}{" "}
                  Kitchen
                </span>
                <h2 className={styles.sectionTitle}>
                  {VIEWS.find((v) => v.id === view).title}
                </h2>
                {/* Two sentences, one per view, and they are deliberately not
                    parallel. The generator's says what a chef *describes* and
                    what comes back; the search's says the opposite thing about
                    authorship, because the one mistake this pair can make is a
                    chef believing the agent invented a dish it merely found.

                    No price point in either any more, and no kitchen. V4 took
                    the money out of the request, the funnel and the card
                    (P-III), and moved the cuisine out of the account and into
                    the request (P-I Day 8) — so what a chef describes here is a
                    pantry and a situation, and the cuisine is something they
                    choose per dish rather than something their account is. */}
                <p className={styles.sectionDesc}>
                  {view === "find"
                    ? "Look through the published recipes this agent was built from. Nothing here is invented — every one links to whoever published it."
                    : view === "kept"
                    ? "The dishes you said you would cook, and the published recipes you saved — kept apart, because one half this agent invented and the other half it did not."
                    : "Say what you have and what kind of food you want, and get complete recipes for dishes that are on no menu — with the published dishes each one was built from."}
                </p>
              </header>
              {/* Both views are mounted for the life of the visit and one is
                  hidden, rather than unmounted and rebuilt on every switch. A
                  chef who searches for a fish curry, goes to invent something,
                  and comes back should find their results still there — and the
                  generator's answer is a request that took seconds to compute
                  and would be silently thrown away by a remount. */}
              <div hidden={view !== "invent"}>
                <RequestScreen />
              </div>
              <div hidden={view !== "find"}>
                <SearchView />
              </div>
              {/* `active` rather than a remount: the collection refetches its
                  accepted dishes when it is opened, because the one thing that
                  changes that list is a verdict the chef logged on a card in
                  `Invent` a moment ago. Mounted like the other two so a chef
                  who wanders between views does not lose their place. */}
              <div hidden={view !== "kept"}>
                <KeptView active={view === "kept"} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// A single icon button in the rail. Shows a tooltip label and, on active, an
// accent-filled pill.
function RailButton({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`${styles.railBtn} ${active ? styles.railBtnActive : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? "true" : undefined}
    >
      <span className={styles.railIcon}>{icon}</span>
      <span className={styles.railLabel}>{label}</span>
    </button>
  );
}

export default function RecipeAgentPage() {
  const router = useRouter();
  const { show, hide } = useNavLoading();
  const [user, setUser] = useState(undefined); // undefined = loading

  // Guard: must be signed in AND have registered the agent. The app-wide loader
  // (already visible) stays up until we are ready or have redirected away.
  //
  // There is no price-status gate here any more. Registration used to kick off
  // a one-time LLM estimate of every ingredient's local price to prefill the
  // inventory editor, and this page held a "preparing your kitchen prices"
  // screen while it ran. There is no inventory editor now, and synthesis costs
  // a dish from the corpus's own price table — so a newly registered kitchen
  // goes straight to work.
  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((current) => {
      if (!active) return;
      if (!current) {
        show("Loading…");
        router.replace("/");
      } else if (!current.agent_registered) {
        show("Loading…");
        router.replace("/agents");
      } else {
        setUser(current);
        hide();
      }
    });
    return () => {
      active = false;
    };
  }, [router, show, hide]);

  if (user === undefined) return null;

  // The saved-recipes list is held above the views because two of them touch
  // it: the keep control lives in `Find` and the list it writes to lives in
  // `Kept`, and those two components never meet. See `useKept.js`.
  return (
    <KeptProvider>
      <Workspace user={user} />
    </KeptProvider>
  );
}
