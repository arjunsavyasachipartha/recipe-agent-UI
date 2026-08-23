"use client";

import { useEffect, useState } from "react";

// A full-page branded loading screen. Rendered by pages while they're checking
// the session or redirecting, so navigating between pages fades through this
// instead of flashing a blank screen.
//
// Pass a fixed `message` to pin the text; otherwise it gently cycles through a
// few "working on it" phrases so even a short wait feels alive.
const CYCLE = [
  "Loading…",
  "Preparing your workspace…",
  "Almost there…",
];

export default function PageLoader({ message }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (message) return; // fixed message → no cycling
    const t = setInterval(() => setI((n) => (n + 1) % CYCLE.length), 1100);
    return () => clearInterval(t);
  }, [message]);

  return (
    <div className="bb-loader" role="status" aria-live="polite">
      <div className="bb-loader-inner">
        <div className="bb-loader-ring" aria-hidden="true" />
        <div className="bb-loader-brand">BornBhukkad</div>
        <div className="bb-loader-msg">{message || CYCLE[i]}</div>
      </div>
    </div>
  );
}
