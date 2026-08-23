"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./phase2.module.css";

// A fully custom, styled replacement for a native <select>. The browser draws a
// native <select>'s option list itself (CSS can't touch it), so every dropdown
// in the workspace uses this instead — a styled trigger + a themed menu that
// matches the ingredient autocomplete. The menu is position:fixed and PORTALED
// to <body>, so it's anchored to the trigger in viewport coordinates and never
// offset by an ancestor with transform/filter/backdrop-filter (which would
// otherwise become the containing block for the fixed menu) or clipped by a
// scroll container.
//
// Props:
//   value, onChange(value)  — controlled value
//   options                 — ["kg","g"] or [{ value, label }]
//   id, ariaLabel, placeholder
//   maxHeight               — optional px cap for the menu (else CSS default)
function normalize(options) {
  return (options || []).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
}

export default function Dropdown({ value, onChange, options, id, ariaLabel, placeholder = "Select…", maxHeight }) {
  const opts = normalize(options);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const activeRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);

  const selectedIndex = Math.max(0, opts.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selectedIndex);

  const current = opts.find((o) => o.value === value);

  function place() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 4, width: r.width });
  }
  function openMenu() {
    place();
    setActive(selectedIndex);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      // The menu is portaled out of wrapRef, so check it separately — otherwise
      // a click on an option would count as "outside" and close before it lands.
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    // A scroll/wheel OUTSIDE the menu closes it, so the page scrolls freely
    // instead of being trapped behind the open menu (which otherwise swallows
    // the wheel). Scrolling INSIDE the menu's own option list is left alone. We
    // never preventDefault, so the same gesture still moves the page.
    function onScrollOutside(e) {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    function reposition() {
      place();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", onScrollOutside, true);
    window.addEventListener("wheel", onScrollOutside, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScrollOutside, true);
      window.removeEventListener("wheel", onScrollOutside, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(o) {
    onChange(o.value);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onKeyDown(e) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, opts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (opts[active]) pick(opts[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.combo} ref={wrapRef}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        className={styles.ddTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className={current ? styles.ddValue : styles.ddPlaceholder}>
          {current ? current.label : placeholder}
        </span>
      </button>
      {open && rect && createPortal(
        <ul
          ref={menuRef}
          className={styles.comboMenu}
          style={{
            position: "fixed",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            ...(maxHeight ? { maxHeight } : null),
          }}
          role="listbox"
        >
          {opts.map((o, i) => (
            <li key={o.value}>
              <button
                ref={i === active ? activeRef : null}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`${styles.comboOption} ${i === active ? styles.comboOptionActive : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // beat blur
                  pick(o);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.comboName}>{o.label}</span>
                {o.value === value && <span className={styles.comboCheck}>✓</span>}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
