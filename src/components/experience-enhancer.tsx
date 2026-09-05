"use client";

import { useEffect } from "react";

/** Shared pointer spotlight for the operational surfaces rendered on every route. */
export function ExperienceEnhancer() {
  useEffect(() => {
    const selector = ".panel, .metric-card, .ledger-surface, .evidence-group, .workflow-card, .journey-sidebar, .lab-banner, .operator-answer";
    const move = (event: PointerEvent) => {
      const surface = (event.target as Element | null)?.closest(selector) as HTMLElement | null;
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      surface.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      surface.classList.add("surface-lit");
    };
    const leave = (event: PointerEvent) => (event.target as Element | null)?.closest(selector)?.classList.remove("surface-lit");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", leave, { passive: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerout", leave); };
  }, []);
  return <div className="app-ambient" aria-hidden="true"><i /><i /><i /></div>;
}
