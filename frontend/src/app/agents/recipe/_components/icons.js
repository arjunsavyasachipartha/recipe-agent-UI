// Line-style icons for the workspace shell — the rail, the two nav items and
// the chrome. All share one <Icon> wrapper so stroke width, size, and
// currentColor stay consistent. Keep them simple (24x24, 1.8 stroke) to match the
// enriched-but-restrained brand.
//
// **V4 P-V Day 11 cut this from 21 icons to six.** Fifteen of them drew sections
// that no longer exist — the mode rail's Chef/Shield/Lock, the five manager
// panels, Recommend, Inventory, Variations, Create, Wishlist, Plan. They went
// with the ranking API two phases ago and stayed here because an icon file is
// the last place anybody looks for dead code. Every remaining export is imported
// by `page.js`, which is the only consumer this module has — with the exception
// of `KeepIcon`, added with the collection, which the search view and the
// collection view both draw.

function Icon({ children, size = 20, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const KitchenIcon = (p) => (
  <Icon {...p}>
    <path d="M9 3.4c.5.6.5 1.2 0 1.8M12 3c.5.6.5 1.2 0 1.8M15 3.4c.5.6.5 1.2 0 1.8" opacity="0.6" />
    <path d="M3 9h18" />
    <path d="M5 9v4a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5V9" />
    <path d="M5 11H3M21 11h-2" />
  </Icon>
);
export const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icon>
);
export const InventIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
    <path d="M18 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
  </Icon>
);

//: The collection — the two lists of what a chef kept. A bookmark, because that
//: is what the control on a recipe is, and the same glyph is used filled for a
//: kept row and outlined for one that is not: a chef reading the list should be
//: able to tell at a glance which button does what.
export const KeepIcon = (p) => (
  <Icon {...p}>
    <path d="M6.5 3.75h11a1 1 0 0 1 1 1v15.5l-6.5-4-6.5 4V4.75a1 1 0 0 1 1-1z" />
  </Icon>
);

/* ── Chrome ────────────────────────────────────── */
export const BackIcon = (p) => (
  <Icon {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);
export const MenuIcon = (p) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);
export const CloseIcon = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
