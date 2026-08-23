"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./phase2.module.css";

// A styled autocomplete for the ingredient field. Replaces the native
// <datalist>, whose popup the browser draws and CSS cannot touch. It filters the
// canonical ingredient list by name/id and stores the canonical id on pick
// (matching the old datalist's value=id behaviour, so the backend round-trip is
// unchanged). The menu is position:fixed and PORTALED to <body> — same as
// Dropdown/DatePicker. The portal is essential, not cosmetic: ancestors of this
// input use backdrop-filter (.section) and a translateY animation (.sectionBody),
// and either one makes a fixed child resolve against THAT ancestor instead of the
// viewport — which threw the menu to a random spot on the page.
export default function IngredientCombo({ value, onChange, onPick, ingredients, placeholder, invalid }) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const activeRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);

  const q = (value || "").trim().toLowerCase();
  const matches = (
    q
      ? ingredients.filter(
          (g) =>
            g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q)
        )
      : ingredients
  ).slice(0, 60);

  function place() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ left: r.left, top: r.bottom + 4, width: r.width });
  }

  function openMenu() {
    place();
    setActive(0);
    setOpen(true);
  }

  // While open: close on outside click, and keep the fixed menu glued to the
  // input as the window resizes.
  useEffect(() => {
    if (!open) return;
    function onDocDown(e) {
      // The menu is portaled out of wrapRef, so check it separately — otherwise
      // a click on an option would count as "outside" and close before it lands.
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    // A scroll/wheel OUTSIDE the menu closes it, so the page scrolls freely
    // rather than dragging a detached menu around. Scrolling INSIDE the menu's
    // own option list is left alone.
    function onScrollOutside(e) {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    }
    function reposition() {
      place();
    }
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", onScrollOutside, true);
    window.addEventListener("wheel", onScrollOutside, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScrollOutside, true);
      window.removeEventListener("wheel", onScrollOutside, { capture: true });
    };
  }, [open]);

  // Keep the highlighted option in view during keyboard navigation.
  useEffect(() => {
    if (open) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(g) {
    onChange(g.id);
    onPick?.(g); // full ingredient object — lets the caller prefill its price
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (matches[active]) {
        e.preventDefault();
        pick(matches[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={`${styles.combo} ${invalid ? styles.wiggle : ""}`} ref={wrapRef}>
      <input
        ref={inputRef}
        className={`${styles.input} ${invalid ? styles.invalidField : ""}`}
        value={value || ""}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) openMenu();
          else {
            setActive(0);
            place();
          }
        }}
        onFocus={openMenu}
        onKeyDown={onKeyDown}
      />
      {open && rect && matches.length > 0 && createPortal(
        <ul
          ref={menuRef}
          className={styles.comboMenu}
          style={{ position: "fixed", left: rect.left, top: rect.top, width: rect.width }}
          role="listbox"
        >
          {matches.map((g, i) => (
            <li key={g.id}>
              <button
                ref={i === active ? activeRef : null}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`${styles.comboOption} ${i === active ? styles.comboOptionActive : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // beat the input's blur
                  pick(g);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.comboName}>{g.name}</span>
                {g.category && <span className={styles.comboCat}>{g.category}</span>}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
