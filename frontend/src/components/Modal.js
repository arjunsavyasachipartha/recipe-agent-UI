"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// How long the exit animation runs before we unmount. Must be >= the CSS exit
// duration (the .overlay[data-closing] / panelOut animations, ~0.2s).
const EXIT_MS = 220;

// A reusable modal shell that animates smoothly on BOTH open and close.
//
// Closing smoothly is the tricky part: if we unmount the instant `open` flips to
// false, the exit animation never plays. So we keep the node mounted, set
// data-closing="true" (the CSS runs the exit keyframes off that attribute), and
// unmount on a short TIMER. We use a timer rather than the `animationend` event
// on purpose — animationend is unreliable when the animation-name is swapped on
// an element that already finished its enter animation, and under the
// reduced-motion override, which is exactly what left the old version stuck open.
//
// The overlay is PORTALLED to <body> rather than rendered in place. This is
// required, not cosmetic: an ancestor with backdrop-filter / filter / transform
// becomes the containing block for its position:fixed descendants, so an overlay
// left inside the tree would resolve `inset: 0` against that ancestor instead of
// the viewport and center itself in the middle of the (very tall) page. The
// recipe workspace has exactly such an ancestor — .section carries
// backdrop-filter — so any modal rendered inline lands offscreen.
//
// Styling stays with each caller — pass `overlayClassName` / `panelClassName`
// (typically the caller's CSS-module classes). The exit animations live in those
// same modules, keyed off [data-closing="true"].
//
// Props:
//   open            — whether the modal should be shown
//   onClose         — called when the user dismisses (backdrop click / Escape)
//   dismissible     — set false while a request is in flight to block dismissal
//   overlayClassName, panelClassName — styling hooks
//   labelledBy      — id of the title element, for aria-labelledby
export default function Modal({
  open,
  onClose,
  dismissible = true,
  overlayClassName = "",
  panelClassName = "",
  labelledBy,
  children,
}) {
  const [render, setRender] = useState(open); // is the DOM node present?
  const [closing, setClosing] = useState(false); // playing the exit animation?
  // document.body only exists once we're on the client, so the portal target is
  // unavailable during SSR and the first hydration pass.
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      // Opening (or re-opening): mount and clear any exit state.
      setRender(true);
      setClosing(false);
      return;
    }
    // Closing: play the exit animation, then unmount after it finishes.
    if (!render) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setRender(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [open, render]);

  // Close on Escape while visible (unless a request is in flight).
  useEffect(() => {
    if (!render) return;
    function onKey(e) {
      if (e.key === "Escape" && dismissible) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [render, dismissible, onClose]);

  if (!render || !mounted) return null;

  return createPortal(
    <div
      // bb-modal-overlay carries the global enter/exit animation; overlayClassName
      // carries this modal's own look (backdrop, layout) from its CSS module.
      className={`bb-modal-overlay ${overlayClassName}`.trim()}
      data-closing={closing ? "true" : "false"}
      onMouseDown={(e) => {
        // Backdrop click (only when the click starts AND lands on the overlay).
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        className={`bb-modal-panel ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
