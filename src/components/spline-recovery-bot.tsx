"use client";

import { useEffect, useRef } from "react";
import { RecoverySculpture } from "./recovery-sculpture";

/**
 * Public CC BY 4.0 Spline scene: R4X Bot by Vlad Kolokolnikov.
 *
 * Uses the my.spline.design embed URL which renders only the 3D canvas — no
 * Spline app chrome (no reload/fullscreen buttons). The iframe's light-grey
 * background is dissolved with mix-blend-mode:multiply so the robot appears
 * as a native part of the page with no visible bounding box.
 */
const EMBED_URL = "https://my.spline.design/r4xbot-YRmW5Xw1iA57VXx3tF1zClf7/";

export function SplineRecoveryBot() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      wrapperRef.current?.classList.add("scene-ready");
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="spline-recovery-bot" ref={wrapperRef}>
      <div className="spline-canvas" aria-hidden="true">
        <iframe
          src={EMBED_URL}
          title="Animated R4X Bot"
          loading="eager"
          allow="keyboard-map"
          frameBorder="0"
        />
      </div>
      <div className="spline-fallback"><RecoverySculpture /></div>
      <span className="hero-sticker hero-coin">₹</span>
      <span className="hero-sticker hero-verified">VERIFIED</span>
      <span className="hero-sticker hero-lightning">ϟ</span>
      <span className="hero-sticker hero-check">✓</span>
    </div>
  );
}
