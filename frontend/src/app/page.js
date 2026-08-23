"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAccount, signIn, fetchCurrentUser } from "@/lib/auth";
import { useNavLoading } from "@/components/NavLoadingProvider";
import BrandMark from "@/components/BrandMark";
import styles from "./auth.module.css";

export default function AuthPage() {
  const router = useRouter();
  const { show, hide } = useNavLoading();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [form, setForm] = useState({ restaurantName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isSignin = mode === "signin";

  // Already signed in? Don't show the sign-in page — send them to their agents.
  // The app-wide loader starts on, so the form stays hidden until we've either
  // redirected (still loading) or confirmed there's no session (hide → form).
  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((user) => {
      if (!active) return;
      if (user) {
        show("Preparing your workspace…");
        router.replace("/agents");
      } else {
        hide();
      }
    });
    return () => {
      active = false;
    };
  }, [router, show, hide]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError("");
  }

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    if (!form.email.trim() || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!isSignin && !form.restaurantName.trim()) {
      setError("Please enter your restaurant name.");
      return;
    }
    if (!isSignin && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    const result = isSignin ? await signIn(form) : await createAccount(form);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    show("Preparing your workspace…"); // loader stays up through the navigation
    router.push("/agents");
  }

  return (
    <main className={styles.wrap}>
      {/* Brand hero — visible on wide screens, sets the tone beside the form. */}
      <Hero />

      <div className={styles.card}>
        <div className={styles.cardBrand}>
          <BrandMark size={28} />
        </div>
        <h1 className={styles.title}>
          {isSignin ? "Welcome back" : "Create your account"}
        </h1>
        <p className={styles.sub}>
          {isSignin
            ? "Sign in to your restaurant console."
            : "Start building smarter recipes today."}
        </p>

        <div className={styles.tabs}>
          <button
            className={isSignin ? styles.tabActive : styles.tab}
            onClick={() => switchMode("signin")}
            type="button"
          >
            Sign in
          </button>
          <button
            className={!isSignin ? styles.tabActive : styles.tab}
            onClick={() => switchMode("signup")}
            type="button"
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div
            className={`${styles.collapse} ${!isSignin ? styles.collapseOpen : ""}`}
            aria-hidden={isSignin}
          >
            <div className={styles.field}>
              <label htmlFor="restaurantName">Restaurant name</label>
              <input
                id="restaurantName"
                type="text"
                placeholder="e.g. The Curry House"
                value={form.restaurantName}
                onChange={(e) => update("restaurantName", e.target.value)}
                tabIndex={isSignin ? -1 : 0}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@restaurant.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder={isSignin ? "••••••••" : "At least 8 characters"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy
              ? isSignin
                ? "Signing in…"
                : "Creating account…"
              : isSignin
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className={styles.foot}>
          {isSignin ? "New to BornBhukkad? " : "Already have an account? "}
          <button
            className={styles.link}
            type="button"
            onClick={() => switchMode(isSignin ? "signup" : "signin")}
          >
            {isSignin ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}

// The sign-in hero: two stacked "slides" switched by the two dots below.
//   • Slide 0 (default) — the Recipe agent, the one that's actually built.
//   • Slide 1 (hidden until you click the second dot) — the four not-yet-built
//     agents shown together as one dimmed, disabled "coming soon" block.
// The inactive slide is fully hidden (display:none) so only one shows at a time;
// keying the active slide replays its entry animation on switch.
function Hero() {
  const [slide, setSlide] = useState(0);

  return (
    <aside className={styles.hero}>
      <BrandMark size={40} />

      <div className={styles.heroSlides}>
        {/* Slide 0 — Recipe agent */}
        <div className={styles.heroSlide} hidden={slide !== 0} key={slide === 0 ? "recipe" : "recipe-off"}>
          {/* V4 P-V Day 11. All three bullets described the V1/V2 ranking
              product — margin, expiring stock, a manager view — which was
              deleted with the API behind it. A landing page promising three
              features the product no longer has is the first thing a new chef
              reads and the first thing they find missing. */}
          <h2 className={styles.heroTitle}>Dishes that are on no menu.</h2>
          <p className={styles.heroText}>
            Say what you have and what kind of food you want, and get complete
            recipes invented for it — from one calm workspace.
          </p>
          <ul className={styles.heroList}>
            <li>Complete recipes: grams, method, times — not a suggestion</li>
            <li>Every dish shows the published recipes it was built from</li>
            <li>Search the published collection beside it</li>
          </ul>
        </div>

        {/* Slide 1 — the not-yet-built agents, as one block */}
        <div className={styles.heroSlide} hidden={slide !== 1} key={slide === 1 ? "soon" : "soon-off"}>
          <h2 className={styles.heroTitle}>More agents</h2>
          <p className={styles.heroText}>
            Built for your kitchen.
          </p>
          <ul className={styles.soonList}>
            {SOON_AGENTS.map((agent) => (
              <li key={agent.id} className={styles.soonItem} aria-disabled="true">
                <span className={styles.soonIcon}>
                  <agent.Icon />
                </span>
                <span className={styles.soonBody}>
                  <span className={styles.soonName}>{agent.name}</span>
                  <span className={styles.soonTag}>{agent.tagline}</span>
                </span>
                <LockGlyph />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Two dots — switch which slide shows. */}
      <div className={styles.dots} role="tablist" aria-label="Hero pages">
        {["Recipe agent", "More agents (coming soon)"].map((label, i) => (
          <button
            key={label}
            type="button"
            role="tab"
            className={`${styles.dot} ${slide === i ? styles.dotActive : ""}`}
            aria-selected={slide === i}
            aria-label={label}
            title={label}
            onClick={() => setSlide(i)}
          />
        ))}
      </div>
    </aside>
  );
}

// The four not-yet-built BornBhukkad agents, shown as disabled rows in the
// hero's second slide. Names/taglines mirror the agent list on /agents/page.js —
// keep them in sync.
const SOON_AGENTS = [
  {
    id: "forecast",
    name: "Demand Forecasting Agent",
    tagline: "See what sells before it does.",
    Icon: ForecastGlyph,
  },
  {
    id: "review",
    name: "Review Intelligence Agent",
    tagline: "Turn guest reviews into what to fix.",
    Icon: ReviewGlyph,
  },
  {
    id: "budget",
    name: "Budget & Margin Agent",
    tagline: "Watch food cost and margin in real time.",
    Icon: BudgetGlyph,
  },
  {
    id: "chat",
    name: "Chatbot",
    tagline: "Ask your kitchen data anything.",
    Icon: ChatGlyph,
  },
];

// Agent glyphs — 22x22, inherit currentColor. Kept in sync with /agents/page.js.
function Glyph({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
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
function ForecastGlyph() {
  return (
    <Glyph>
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
      <path d="M20 7h-3M20 7v3" />
    </Glyph>
  );
}
function ReviewGlyph() {
  return (
    <Glyph>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M12 8l1.1 2.2 2.4.3-1.7 1.7.4 2.4-2.2-1.2-2.2 1.2.4-2.4-1.7-1.7 2.4-.3L12 8z" />
    </Glyph>
  );
}
function BudgetGlyph() {
  return (
    <Glyph>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </Glyph>
  );
}
function ChatGlyph() {
  return (
    <Glyph>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
    </Glyph>
  );
}
// A small padlock marking each row as locked / not yet available.
function LockGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={styles.soonLock}
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
