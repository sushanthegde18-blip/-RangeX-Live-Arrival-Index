import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, GitMerge, Layers, PackageCheck, SearchX } from 'lucide-react';
import { useAvlStore } from '../../store/useAvlStore';

interface MissingRange {
  start: number;
  end: number;
  missingCount: number;
}

function computeMissingRanges(
  intervals: Array<{ start: number; end: number }>,
  rangeStart: number,
  rangeEnd: number,
): MissingRange[] {
  if (rangeStart > rangeEnd) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const gaps: MissingRange[] = [];
  let cursor = rangeStart;

  for (const iv of sorted) {
    if (iv.end < cursor) continue;
    if (iv.start > rangeEnd) break;
    if (iv.start > cursor) {
      const gapEnd = Math.min(rangeEnd, iv.start - 1);
      gaps.push({
        start: cursor,
        end: gapEnd,
        missingCount: gapEnd - cursor + 1,
      });
    }
    cursor = Math.max(cursor, iv.end + 1);
    if (cursor > rangeEnd) break;
  }

  if (cursor <= rangeEnd) {
    gaps.push({
      start: cursor,
      end: rangeEnd,
      missingCount: rangeEnd - cursor + 1,
    });
  }

  return gaps;
}

export const IntervalExplorer: React.FC = () => {
  const frames = useAvlStore((s) => s.frames);
  const cursor = useAvlStore((s) => s.cursor);
  const explorerRangeStart = useAvlStore((s) => s.explorerRangeStart);
  const explorerRangeEnd = useAvlStore((s) => s.explorerRangeEnd);
  const setExplorerRange = useAvlStore((s) => s.setExplorerRange);

  const currentFrame = cursor >= 0 && cursor < frames.length ? frames[cursor] : null;
  const intervals = currentFrame?.intervals ?? [];
  const visual = currentFrame?.visual ?? null;

  const sortedIntervals = useMemo(
    () => [...intervals].sort((a, b) => a.start - b.start),
    [intervals],
  );

  const totalUniquePackages = useMemo(() => {
    if (currentFrame && currentFrame.analytics.totalUniquePackages > 0) {
      return currentFrame.analytics.totalUniquePackages;
    }
    return sortedIntervals.reduce((acc, iv) => acc + (iv.end - iv.start + 1), 0);
  }, [currentFrame, sortedIntervals]);

  const missingRanges = useMemo(
    () => computeMissingRanges(sortedIntervals, explorerRangeStart, explorerRangeEnd),
    [sortedIntervals, explorerRangeStart, explorerRangeEnd],
  );

  const rangeSpan = Math.max(1, explorerRangeEnd - explorerRangeStart + 1);

  return (
    <div className="space-y-4">
      {/* Top Summary & Range Selector */}
      <div className="rangex-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2 text-cyanpulse-300">
            <Layers className="h-4 w-4" />
            <h2 className="text-sm font-bold tracking-wide text-slate-100">
              Sorted Interval Explorer
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Authoritative sorted warehouse arrival intervals and gap coverage within a target range.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-charcoal-950 px-3 py-1.5">
            <span className="text-[11px] text-slate-400">Inspect Range:</span>
            <input
              type="number"
              value={explorerRangeStart}
              onChange={(e) => setExplorerRange(Number(e.target.value) || 0, explorerRangeEnd)}
              className="w-16 rounded border border-slate-700 bg-charcoal-900 px-2 py-0.5 font-mono text-xs text-slate-100 focus:border-electric-500 focus:outline-none"
              aria-label="Range start"
            />
            <span className="text-slate-500">to</span>
            <input
              type="number"
              value={explorerRangeEnd}
              onChange={(e) => setExplorerRange(explorerRangeStart, Number(e.target.value) || 0)}
              className="w-16 rounded border border-slate-700 bg-charcoal-900 px-2 py-0.5 font-mono text-xs text-slate-100 focus:border-electric-500 focus:outline-none"
              aria-label="Range end"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-cyanpulse-500/30 bg-cyanpulse-500/10 px-3.5 py-1.5">
            <PackageCheck className="h-4 w-4 text-cyanpulse-400" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Total Unique Packages
              </div>
              <div className="font-mono text-sm font-bold text-cyanpulse-300">
                {totalUniquePackages}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Merge Animation Strip */}
      <AnimatePresence>
        {visual?.activeMerge && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rangex-metallic-card overflow-hidden rounded-2xl border border-cyanpulse-400/50 p-4"
          >
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyanpulse-300">
              <GitMerge className="h-4 w-4 animate-pulse" />
              INTERVAL MERGE IN PROGRESS
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
              <motion.div
                initial={{ x: -24, opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="rounded-xl border border-purple-400/50 bg-purple-500/15 px-4 py-2 text-purple-200"
              >
                [{visual.activeMerge.leftInterval[0]}, {visual.activeMerge.leftInterval[1]}]
              </motion.div>
              <span className="rounded-full bg-cyanpulse-500/20 px-2.5 py-1 text-xs font-bold text-cyanpulse-300">
                +{visual.activeMerge.bridgePackage}
              </span>
              <motion.div
                initial={{ x: 24, opacity: 0.6 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-emerald-200"
              >
                [{visual.activeMerge.rightInterval[0]}, {visual.activeMerge.rightInterval[1]}]
              </motion.div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <motion.div
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="rounded-xl border border-cyanpulse-400 bg-electric-600/30 px-5 py-2 font-bold text-white shadow-glow"
              >
                [{visual.activeMerge.mergedInterval[0]}, {visual.activeMerge.mergedInterval[1]}]
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proportional Range Coverage Bar */}
      <div className="rangex-panel rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">
            Arrival Spectrum [{explorerRangeStart} .. {explorerRangeEnd}]
          </span>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-cyanpulse-300">
              <span className="h-2.5 w-2.5 rounded-sm bg-electric-500" /> Received
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-600 bg-charcoal-950" />{' '}
              Missing Gap
            </span>
          </div>
        </div>

        <div className="relative h-8 w-full overflow-hidden rounded-xl border border-slate-800 bg-charcoal-950">
          {sortedIntervals.map((iv) => {
            const clampedStart = Math.max(explorerRangeStart, iv.start);
            const clampedEnd = Math.min(explorerRangeEnd, iv.end);
            if (clampedStart > clampedEnd) return null;
            const leftPct = ((clampedStart - explorerRangeStart) / rangeSpan) * 100;
            const widthPct = Math.max(
              1.2,
              ((clampedEnd - clampedStart + 1) / rangeSpan) * 100,
            );
            return (
              <motion.div
                layout
                key={`${iv.start}-${iv.end}`}
                title={`[${iv.start}, ${iv.end}] (${iv.count} pkgs)`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                className="absolute bottom-1 top-1 rounded-md border border-cyanpulse-300/60 bg-gradient-to-r from-electric-600 to-cyanpulse-500/80 shadow-glow"
              />
            );
          })}
        </div>
      </div>

      {/* Two-Column Received vs Missing Lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Received Intervals */}
        <div className="rangex-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Received Intervals ({sortedIntervals.length})
            </h3>
            <span className="font-mono text-[11px] text-cyanpulse-300">Sorted Order</span>
          </div>

          {sortedIntervals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
              No intervals received yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <AnimatePresence>
                {sortedIntervals.map((iv) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    key={`${iv.start}-${iv.end}`}
                    className="rangex-metallic-card flex items-center justify-between rounded-xl px-3.5 py-2.5"
                  >
                    <span className="font-mono text-sm font-bold text-white">
                      [{iv.start}, {iv.end}]
                    </span>
                    <span className="rounded-md bg-electric-600/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyanpulse-300">
                      {iv.count} {iv.count === 1 ? 'pkg' : 'pkgs'}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Missing Intervals */}
        <div className="rangex-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Missing Intervals in [{explorerRangeStart}, {explorerRangeEnd}]
            </h3>
            <span className="font-mono text-[11px] text-amber-300">
              {missingRanges.reduce((acc, g) => acc + g.missingCount, 0)} missing IDs
            </span>
          </div>

          {missingRanges.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-xs text-emerald-300">
              100% range coverage — zero missing packages in [{explorerRangeStart}, {explorerRangeEnd}].
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {missingRanges.map((gap) => (
                <div
                  key={`${gap.start}-${gap.end}`}
                  className="flex items-center justify-between rounded-xl border border-dashed border-slate-700/80 bg-charcoal-950/70 px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-1.5 font-mono text-sm text-slate-300">
                    <SearchX className="h-3.5 w-3.5 text-amber-400" />
                    [{gap.start}, {gap.end}]
                  </span>
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] text-amber-300">
                    -{gap.missingCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
