"use client";

import { createContext, useCallback, useContext, useState } from "react";
import PageLoader from "./PageLoader";

const NavLoadingContext = createContext(null);

// Owns the ONE full-page loader for the whole app. Because it lives above the
// routed pages (in the root layout), the loader element persists across
// client-side navigations — so a redirect shows a single continuous loading
// screen instead of one loader unmounting on the old page and another mounting
// on the new one (which looked like the loader "appearing twice").
//
// Usage from a page:
//   const { show, hide } = useNavLoading();
//   show("Opening…")  → keep/turn the loader on (optionally with a message)
//   hide()            → the page is ready; reveal its content
export function NavLoadingProvider({ children }) {
  // Start visible: on a fresh load every page immediately checks the session,
  // then calls hide() once ready (or show() again to keep it up while
  // navigating). Starting true means no blank frame before the first paint.
  const [state, setState] = useState({ loading: true, message: null });

  const show = useCallback(
    (message = null) => setState({ loading: true, message }),
    []
  );
  const hide = useCallback(
    () => setState({ loading: false, message: null }),
    []
  );

  return (
    <NavLoadingContext.Provider value={{ show, hide }}>
      {children}
      {state.loading && <PageLoader message={state.message} />}
    </NavLoadingContext.Provider>
  );
}

export function useNavLoading() {
  const ctx = useContext(NavLoadingContext);
  if (!ctx) {
    throw new Error("useNavLoading must be used within NavLoadingProvider");
  }
  return ctx;
}
