import React from 'react';
import { BarChart3, GitMerge, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAvlStore } from '../../store/useAvlStore';
import { createEmptyAnalytics } from '../../services/eventValidator';

export const WarehouseAnalytics: React.FC = () => {
  const frames = useAvlStore((s) => s.frames);
  const cursor = useAvlStore((s) => s.cursor);

  const currentFrame = cursor >= 0 && cursor < frames.length ? frames[cursor] : null;
  const analytics = currentFrame?.analytics ?? createEmptyAnalytics();

  const totalReceived = analytics.totalPackagesReceived;
  const uniqueRatio =
    totalReceived > 0 ? Math.round((analytics.totalUniquePackages / totalReceived) * 100) : 0;
  const dupRatio = totalReceived > 0 ? 100 - uniqueRatio : 0;

  // Theoretical AVL upper-bound height ~ 1.44 * log2(N + 2)
  const nNodes = Math.max(1, analytics.totalIntervals);
  const maxTheoreticalAvlHeight = Math.max(1, Math.ceil(1.44 * Math.log2(nNodes + 2)));
  const heightLoadPct = Math.min(
    100,
    Math.round((analytics.currentTreeHeight / maxTheoreticalAvlHeight) * 100),
  );

  // SVG Radial Gauge math
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const gaugeOffset = circumference - (heightLoadPct / 100) * circumference;

  const largestSize = analytics.largestInterval?.size ?? 0;
  const smallestSize = analytics.smallestInterval?.size ?? 0;
  const smallestBarPct = largestSize > 0 ? Math.max(10, Math.round((smallestSize / largestSize) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="rangex-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2 text-cyanpulse-300">
            <BarChart3 className="h-4 w-4" />
            <h2 className="text-sm font-bold tracking-wide text-slate-100">
              Warehouse Telemetry &amp; AVL Efficiency Analytics
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Live metrics computed exclusively by Member 1&apos;s C++ AVL engine and reported via backend snapshots.
          </p>
        </div>
        <span className="rounded-lg border border-slate-700 bg-charcoal-950 px-3 py-1 font-mono text-xs text-slate-300">
          Frame #{cursor >= 0 ? cursor + 1 : 0} Telemetry
        </span>
      </div>

      {/* Main Sophisticated Telemetry Panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. AVL Balance & Height Radial Gauge */}
        <div className="rangex-metallic-card flex flex-col justify-between rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              AVL Structural Envelope
            </span>
            <ShieldCheck className="h-4 w-4 text-cyanpulse-400" />
          </div>

          <div className="my-4 flex items-center justify-center gap-6">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg className="h-36 w-36 -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="rgba(30, 41, 59, 0.9)"
                  strokeWidth="12"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={gaugeOffset}
                  style={{ transition: 'stroke-dashoffset 450ms ease' }}
                />
                <defs>
                  <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute text-center">
                <div className="font-mono text-2xl font-bold text-white">
                  {analytics.currentTreeHeight}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  Tree Height
                </div>
              </div>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div>
                <div className="text-[10px] text-slate-400">AVL ROTATIONS</div>
                <div className="flex items-center gap-1.5 text-lg font-bold text-amber-300">
                  <RefreshCw className="h-4 w-4" />
                  {analytics.totalAvlRotations}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">ACTIVE INTERVALS</div>
                <div className="text-lg font-bold text-electric-400">
                  {analytics.totalIntervals}
                </div>
              </div>
              <div className="text-[10px] text-slate-500">
                Max AVL bound: {maxTheoreticalAvlHeight}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Package Ingestion Composition Spectrum */}
        <div className="rangex-metallic-card flex flex-col justify-between rounded-2xl p-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Arrival Ingestion Composition
            </span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-white">
                {analytics.totalPackagesReceived}
              </span>
              <span className="text-xs text-slate-400">total arrival events</span>
            </div>
          </div>

          {/* Segmented Spectrum Bar */}
          <div className="my-5 space-y-2">
            <div className="flex h-5 w-full overflow-hidden rounded-full border border-slate-700/80 bg-charcoal-950 p-0.5">
              <div
                style={{ width: `${uniqueRatio}%` }}
                className="h-full rounded-l-full bg-gradient-to-r from-electric-600 to-cyanpulse-400 transition-all duration-500"
                title={`Unique Packages: ${analytics.totalUniquePackages}`}
              />
              <div
                style={{ width: `${dupRatio}%` }}
                className="h-full rounded-r-full bg-purple-500/80 transition-all duration-500"
                title={`Duplicate Arrivals: ${analytics.duplicateArrivals}`}
              />
            </div>
            <div className="flex justify-between font-mono text-[11px]">
              <span className="text-cyanpulse-300">
                Unique: {analytics.totalUniquePackages} ({uniqueRatio}%)
              </span>
              <span className="text-purple-300">
                Duplicates: {analytics.duplicateArrivals} ({dupRatio}%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-slate-800 pt-3 font-mono text-xs">
            <div className="rounded-xl bg-charcoal-950/80 px-3 py-2">
              <div className="text-[10px] text-slate-400">UNIQUE PACKAGES</div>
              <div className="mt-0.5 text-base font-bold text-cyanpulse-300">
                {analytics.totalUniquePackages}
              </div>
            </div>
            <div className="rounded-xl bg-charcoal-950/80 px-3 py-2">
              <div className="text-[10px] text-slate-400">DUPLICATE HITS</div>
              <div className="mt-0.5 text-base font-bold text-purple-300">
                {analytics.duplicateArrivals}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Interval Consolidation & Span Comparator */}
        <div className="rangex-metallic-card flex flex-col justify-between rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Interval Consolidation &amp; Spans
            </span>
            <GitMerge className="h-4 w-4 text-electric-400" />
          </div>

          <div className="my-4 space-y-3.5">
            <div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Largest Interval</span>
                <span className="font-bold text-cyanpulse-300">
                  {analytics.largestInterval
                    ? `[${analytics.largestInterval.start}, ${analytics.largestInterval.end}] (${analytics.largestInterval.size})`
                    : '—'}
                </span>
              </div>
              <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-charcoal-950">
                <div
                  style={{ width: analytics.largestInterval ? '100%' : '0%' }}
                  className="h-full rounded-full bg-gradient-to-r from-electric-600 to-cyanpulse-400 transition-all duration-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-400">Smallest Interval</span>
                <span className="font-bold text-emerald-300">
                  {analytics.smallestInterval
                    ? `[${analytics.smallestInterval.start}, ${analytics.smallestInterval.end}] (${analytics.smallestInterval.size})`
                    : '—'}
                </span>
              </div>
              <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-charcoal-950">
                <div
                  style={{ width: `${smallestBarPct}%` }}
                  className="h-full rounded-full bg-emerald-400/80 transition-all duration-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-cyanpulse-500/25 bg-cyanpulse-500/10 px-3.5 py-2.5 font-mono text-xs">
            <span className="text-slate-300">TOTAL INTERVAL MERGES</span>
            <span className="text-lg font-bold text-cyanpulse-300">
              {analytics.totalIntervalMerges}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
