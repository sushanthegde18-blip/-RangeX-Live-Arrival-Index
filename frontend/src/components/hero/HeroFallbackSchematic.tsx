export function HeroFallbackSchematic({ reason }: { reason: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#05070B]">
      <div className="studio-grid-bg absolute inset-0 opacity-60" />
      <div className="absolute h-[420px] w-[420px] rounded-full bg-[#2E7BFF]/15 blur-[110px]" />
      <div className="absolute h-[260px] w-[260px] translate-x-24 -translate-y-12 rounded-full bg-[#38E8FF]/12 blur-[90px]" />

      <svg
        viewBox="0 0 600 420"
        className="relative h-[78%] w-[88%] max-w-3xl opacity-85"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="monolithFrame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#C8D3E3" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#2E7BFF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#38E8FF" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <circle cx="300" cy="210" r="155" fill="none" stroke="rgba(200,211,227,0.14)" strokeDasharray="6 8" />
        <circle cx="300" cy="210" r="118" fill="none" stroke="rgba(56,232,255,0.25)" />
        <rect
          x="220"
          y="90"
          width="160"
          height="240"
          rx="8"
          fill="rgba(12,16,24,0.85)"
          stroke="url(#monolithFrame)"
          strokeWidth="2"
        />
        <line x1="190" y1="210" x2="410" y2="210" stroke="#38E8FF" strokeWidth="1.5" strokeOpacity="0.8" />
        <rect x="242" y="122" width="116" height="24" rx="3" fill="rgba(46,123,255,0.18)" stroke="rgba(46,123,255,0.5)" />
        <rect x="242" y="164" width="116" height="24" rx="3" fill="rgba(200,211,227,0.08)" stroke="rgba(200,211,227,0.25)" />
        <rect x="242" y="232" width="116" height="24" rx="3" fill="rgba(56,232,255,0.14)" stroke="rgba(56,232,255,0.45)" />
        <rect x="242" y="274" width="116" height="24" rx="3" fill="rgba(200,211,227,0.08)" stroke="rgba(200,211,227,0.25)" />
      </svg>

      <div className="font-mono-tech absolute bottom-20 right-6 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#7F8EA6]">
        {reason}
      </div>
    </div>
  )
}
