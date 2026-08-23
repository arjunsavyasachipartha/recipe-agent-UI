"use client";

import styles from "./skeleton.module.css";

// Shared loading skeletons (Phase VI). Import <Skeleton variant=… /> in any panel
// to show a calm shimmer while an agent call is in flight, instead of a bare
// "Loading…" line. `Bar` is the primitive; the variants compose canned layouts
// that echo the real content each panel will render.

export function Bar({ w = "100%", h = 12, r, style }) {
  return (
    <span
      className={styles.shimmer}
      style={{ width: w, height: typeof h === "number" ? `${h}px` : h, borderRadius: r, ...style }}
      aria-hidden="true"
    />
  );
}

// A single result/draft card outline: title + a couple of text lines + chips.
function CardSkel() {
  return (
    <div className={styles.card}>
      <Bar w="55%" h={18} />
      <Bar w="30%" h={11} />
      <Bar w="100%" h={11} />
      <Bar w="88%" h={11} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
        <Bar w="6rem" h={26} r="999px" />
        <Bar w="6rem" h={26} r="999px" />
      </div>
    </div>
  );
}

// A horizontal row: a label/meta stack on the left, a bar on the right.
function RowSkel() {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <Bar w="40%" h={13} />
        <Bar w="22%" h={10} />
      </div>
      <Bar w="30%" h={9} r="999px" />
    </div>
  );
}

// The dashboard summary: a grid of stat cards over a short table.
function StatsSkel() {
  return (
    <>
      <div className={styles.statGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.statCard}>
            <Bar w="50%" h={26} />
            <Bar w="80%" h={10} />
          </div>
        ))}
      </div>
      <TableSkel count={3} />
    </>
  );
}

// A table stand-in: a header row of narrower bars, then data rows.
function TableSkel({ count = 4 }) {
  return (
    <div className={styles.table}>
      <div className={styles.tableRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} w="60%" h={10} />
        ))}
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.tableRow}>
          {Array.from({ length: 4 }).map((__, j) => (
            <Bar key={j} h={13} />
          ))}
        </div>
      ))}
    </div>
  );
}

// variant: "cards" | "list" | "table" | "stats"
export default function Skeleton({ variant = "list", count = 3, label = "Loading…" }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>{label}</span>
      {variant === "stats" && <StatsSkel />}
      {variant === "table" && <TableSkel count={count} />}
      {variant === "cards" &&
        Array.from({ length: count }).map((_, i) => <CardSkel key={i} />)}
      {variant === "list" &&
        Array.from({ length: count }).map((_, i) => <RowSkel key={i} />)}
    </div>
  );
}
