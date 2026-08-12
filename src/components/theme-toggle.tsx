"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "dark";

/**
 * Light and dark stock.
 *
 * The button reports the theme you would get by pressing it, not the one you
 * are in, which is the reading most people expect from a two-state control.
 *
 * It renders nothing until mounted. The server has no way to know what the
 * visitor's machine prefers, so any label rendered on the server is a coin
 * flip that React would then have to correct, which is a hydration mismatch
 * and a visible flicker on the first paint. The theme itself is applied before
 * paint by the inline script in the layout, so nothing here is load bearing
 * for what the page looks like, only for what the button says.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const stated = root.getAttribute("data-theme");
    if (stated === "light" || stated === "dark") {
      setChoice(stated);
      return;
    }
    setChoice(
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
  }, []);

  function apply(next: Choice) {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("assay-theme", next);
    } catch {
      // Private browsing can refuse storage. The theme still applies for this
      // page view, it just will not survive a reload, which is a better
      // outcome than the toggle throwing.
    }
    setChoice(next);
  }

  const next: Choice = choice === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      aria-label={choice === null ? "Switch theme" : `Switch to ${next} theme`}
      title={choice === null ? undefined : `Switch to ${next} theme`}
      className="tabular ml-1 border-l border-[var(--color-rule)] px-3 py-1 text-[11px] tracking-[0.1em] text-[var(--color-ink-secondary)] uppercase transition-colors duration-150 hover:text-[var(--color-spot)]"
    >
      {/* A fixed-width placeholder holds the slot so the masthead does not
          reflow when the real label arrives a frame later. */}
      <span aria-hidden className={choice === null ? "opacity-0" : undefined}>
        {choice === "dark" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
