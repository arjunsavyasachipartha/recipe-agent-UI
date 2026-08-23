"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser, signOut } from "@/lib/auth";
import Modal from "@/components/Modal";
import { useNavLoading } from "@/components/NavLoadingProvider";
import BrandMark from "@/components/BrandMark";
import RegisterModal from "./RegisterModal";
import styles from "./agents.module.css";

// `route` is where an enabled agent opens once it's set up. `tagline` + `Icon`
// give each card real presence on the picker.
const AGENTS = [
  {
    id: 1,
    name: "Recipe Creation Agent",
    tagline: "Cook the right dishes today — ranked for margin, stock, and weather.",
    Icon: RecipeGlyph,
    enabled: true,
    route: "/agents/recipe",
  },
  {
    id: 2,
    name: "Demand Forecasting Agent",
    tagline: "See what sells before it does, and prep with confidence.",
    Icon: ForecastGlyph,
    enabled: false,
  },
  {
    id: 3,
    name: "Review Intelligence Agent",
    tagline: "Turn guest reviews into what to fix and what to keep.",
    Icon: ReviewGlyph,
    enabled: false,
  },
  {
    id: 4,
    name: "Budget & Margin Agent",
    tagline: "Watch food cost and margin move in real time.",
    Icon: BudgetGlyph,
    enabled: false,
  },
  {
    id: 5,
    name: "Chatbot",
    tagline: "Ask your kitchen data anything, in plain language.",
    Icon: ChatGlyph,
    enabled: false,
  },
];

export default function AgentsPage() {
  const router = useRouter();
  const { show, hide } = useNavLoading();
  const [user, setUser] = useState(undefined); // undefined = loading

  const trackRef = useRef(null);
  const [overflow, setOverflow] = useState(false); // are agents hidden off-screen?
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const [confirming, setConfirming] = useState(false); // sign-out confirmation open?
  const [signingOut, setSigningOut] = useState(false);

  const [setupOpen, setSetupOpen] = useState(false); // recipe-agent first-time setup?

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((current) => {
      if (!active) return;
      if (!current) {
        show("Loading…");
        router.replace("/");
        return;
      }
      setUser(current);
      hide(); // content ready — reveal it
    });
    return () => {
      active = false;
    };
  }, [router, show, hide]);

  // Track how far the row is scrolled so we can show/disable the arrows.
  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflow(max > 4);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [user, updateArrows]);

  async function confirmSignOut() {
    setSigningOut(true);
    await signOut();
    show("Signing out…");
    router.replace("/");
  }

  // Opening an agent card. For the Recipe agent: if this restaurant has already
  // registered (provisioned an API key), go straight in; otherwise show the
  // one-time setup modal. Disabled cards do nothing.
  function openAgent(agent) {
    if (!agent.enabled || !agent.route) return;
    if (agent.id === 1 && !user.agent_registered) {
      setSetupOpen(true);
      return;
    }
    show("Opening Recipe Agent…");
    router.push(agent.route);
  }

  // Smoothly reveal the agents just off the left/right edge.
  function scroll(direction) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(el.clientWidth * 0.8, 200),
      behavior: "smooth",
    });
  }

  // The app-wide loader covers the initial session check; render nothing under
  // it until we have the user (content needs user.restaurant_name).
  if (!user) return null;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <BrandMark size={30} />
        <div className={styles.account}>
          <span className={styles.greeting}>
            <span className={styles.greetName}>{user.restaurant_name}</span>
          </span>
          <button
            className={styles.signout}
            onClick={() => setConfirming(true)}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className={styles.content}>
        <span className={styles.kicker}>Your workspace</span>
        <h1 className={styles.heading}>Agents</h1>
        <p className={styles.lede}>
          Purpose-built AI assistants for your kitchen. Open one to get started.
        </p>

        <div className={styles.carousel}>
          {overflow && (
            <button
              className={styles.arrow}
              onClick={() => scroll(-1)}
              disabled={atStart}
              type="button"
              aria-label="Show previous agents"
            >
              <Chevron dir="left" />
            </button>
          )}

          <div className={styles.track} ref={trackRef}>
            {AGENTS.map((agent, i) => (
              <button
                key={agent.id}
                className={styles.agentCard}
                type="button"
                disabled={!agent.enabled}
                onClick={() => openAgent(agent)}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className={styles.agentIcon}>
                  <agent.Icon />
                </span>
                <span className={styles.agentName}>{agent.name}</span>
                <span className={styles.agentTagline}>{agent.tagline}</span>
                <span
                  className={agent.enabled ? styles.agentOpen : styles.agentSoon}
                >
                  {agent.enabled ? "Open" : ""}
                  {agent.enabled && <Arrow />}
                </span>
              </button>
            ))}
          </div>

          {overflow && (
            <button
              className={styles.arrow}
              onClick={() => scroll(1)}
              disabled={atEnd}
              type="button"
              aria-label="Show more agents"
            >
              <Chevron dir="right" />
            </button>
          )}
        </div>
      </section>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        dismissible={!signingOut}
        overlayClassName={styles.overlay}
        panelClassName={styles.modal}
        labelledBy="signout-title"
      >
        <h2 id="signout-title" className={styles.modalTitle}>
          Sign out?
        </h2>
        <p className={styles.modalText}>
          You&apos;ll need to sign in again to access your agents.
        </p>
        <div className={styles.modalActions}>
          <button
            className={styles.btnGhost}
            onClick={() => setConfirming(false)}
            type="button"
            disabled={signingOut}
          >
            Cancel
          </button>
          <button
            className={styles.btnConfirm}
            onClick={confirmSignOut}
            type="button"
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </Modal>

      <RegisterModal
        open={setupOpen}
        restaurantName={user.restaurant_name}
        onClose={() => setSetupOpen(false)}
        onDone={() => {
          // Registered — reflect it locally so a second click skips the modal,
          // then open the agent.
          setUser((u) => ({ ...u, agent_registered: true }));
          setSetupOpen(false);
          show("Opening Recipe Agent…");
          router.push("/agents/recipe");
        }}
      />
    </main>
  );
}

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Agent card glyphs — 28x28, 1.7 stroke, inherit currentColor.
function G({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
function RecipeGlyph() {
  // A chef's toque: puffy crown, pleats, and a band.
  return (
    <G>
      <path d="M7 14.5a4 4 0 0 1-1-7.6A4.5 4.5 0 0 1 12.5 4a4.5 4.5 0 0 1 6.6 3A4 4 0 0 1 18 14.5H7z" />
      <path d="M7 14.5V19a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-4.5" />
      <path d="M10 14.8v3.5M12.5 14.8v3.5M15 14.8v3.5" opacity="0.55" />
    </G>
  );
}
function ForecastGlyph() {
  return (
    <G>
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
      <path d="M20 7h-3M20 7v3" />
    </G>
  );
}
function ReviewGlyph() {
  return (
    <G>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M12 8l1.1 2.2 2.4.3-1.7 1.7.4 2.4-2.2-1.2-2.2 1.2.4-2.4-1.7-1.7 2.4-.3L12 8z" />
    </G>
  );
}
function BudgetGlyph() {
  return (
    <G>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </G>
  );
}
function ChatGlyph() {
  return (
    <G>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
    </G>
  );
}
