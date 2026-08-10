"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll-entry wrapper.
 *
 * Progressive enhancement, deliberately. The server renders no data-visible
 * attribute at all, so the content is fully visible before any script runs. Only
 * once this has mounted, and can therefore guarantee it will later reveal the
 * element, does it opt into the hidden state.
 *
 * The previous version had it the other way round: hidden in CSS, revealed by an
 * IntersectionObserver. That made the whole impact section invisible in a
 * full-page screenshot and would have hidden it permanently for anyone whose
 * JavaScript failed to run.
 *
 * Uses IntersectionObserver rather than a scroll listener so it costs nothing on
 * the main thread, and animates only transform and opacity so it never triggers
 * layout.
 */
export function Reveal({
  children,
  index = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Anything already on screen at mount should never flash: reveal it without
    // passing through the hidden state at all.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      setState("shown");
      return;
    }

    setState("hidden");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      // Absent entirely until mounted, which is what keeps the no-JS render visible.
      data-visible={state === "static" ? undefined : state === "shown"}
      style={{ "--index": index } as React.CSSProperties}
      className={`reveal ${className}`}
    >
      {children}
    </Tag>
  );
}
