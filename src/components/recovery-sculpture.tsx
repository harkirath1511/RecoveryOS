/** A lightweight, decorative inflated loop, drawn locally without remote assets. */
export function RecoverySculpture() {
  return <div className="recovery-sculpture" aria-hidden="true">
    <svg viewBox="0 0 560 390" fill="none">
      <defs>
        <linearGradient id="loop-blue" x1="140" y1="40" x2="380" y2="350" gradientUnits="userSpaceOnUse"><stop stopColor="#b6e8ff"/><stop offset=".23" stopColor="#4da2ff"/><stop offset=".55" stopColor="#087bfa"/><stop offset=".8" stopColor="#0052c6"/><stop offset="1" stopColor="#8bd3ff"/></linearGradient>
        <filter id="loop-depth" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="2" dy="16" stdDeviation="9" floodColor="#165791" floodOpacity=".22"/></filter>
        <linearGradient id="loop-highlight"><stop stopColor="#fff" stopOpacity=".7"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
      </defs>
      <g transform="rotate(-23 280 195)" filter="url(#loop-depth)">
        <rect x="99" y="83" width="362" height="219" rx="109" stroke="url(#loop-blue)" strokeWidth="68"/>
        <path d="M205 64C64 66 61 281 207 285h140" stroke="url(#loop-highlight)" strokeWidth="4" strokeLinecap="round"/>
      </g>
    </svg>
    <span className="sculpture-sticker sticker-star">✳</span>
    <span className="sculpture-sticker sticker-check">✓</span>
    <span className="sculpture-sticker sticker-label">GOOD TO GO ↗</span>
  </div>;
}
