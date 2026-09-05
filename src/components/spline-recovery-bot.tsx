import { RecoverySculpture } from "./recovery-sculpture";

const previewUrl = "https://app.spline.design/file/ed3b52af-7f6b-4fe9-b3dc-d3eedbf00f82?view=preview";

/** Public CC BY 4.0 Spline scene: R4X Bot by Vlad Kolokolnikov. */
export function SplineRecoveryBot() {
  return <div className="spline-recovery-bot scene-ready">
    <div className="spline-canvas" aria-hidden="true">
      <iframe src={previewUrl} title="Animated R4X Bot" loading="eager" allow="keyboard-map" allowFullScreen />
    </div>
    <div className="spline-fallback"><RecoverySculpture /></div>
    <span className="hero-sticker hero-coin">₹</span>
    <span className="hero-sticker hero-verified">VERIFIED</span>
    <span className="hero-sticker hero-lightning">ϟ</span>
    <span className="hero-sticker hero-check">✓</span>
  </div>;
}
