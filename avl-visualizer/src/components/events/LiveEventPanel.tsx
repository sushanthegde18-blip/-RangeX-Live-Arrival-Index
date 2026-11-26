import React, { useEffect, useRef } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock, GitCompare, Terminal } from 'lucide-react';
import { useAvlStore } from '../../store/useAvlStore';

export const LiveEventPanel: React.FC = () => {
  const frames = useAvlStore((s) => s.frames);
  const cursor = useAvlStore((s) => s.cursor);
  const jumpToFrame = useAvlStore((s) => s.jumpToFrame);
  const invalidEvents = useAvlStore((s) => s.invalidEvents);
  const clearInvalidEvents = useAvlStore((s) => s.clearInvalidEvents);

  const historyEndRef = useRef<HTMLDivElement>(null);
  const currentFrame = cursor >= 0 && cursor < frames.length ? frames[cursor] : null;
  const visual = currentFrame?.visual ?? null;
  const event = currentFrame?.event ?? null;

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [cursor]);

  const activeNode =
    visual?.activeNodeId && currentFrame
      ? currentFrame.snapshot.nodesById[visual.activeNodeId]
      : null;

  return (
    <div className="rangex-panel flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-charcoal-950/90 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyanpulse-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Live Backend Event Telemetry
          </h2>
        </div>
        <span className="font-mono text-[11px] text-slate-400">
          {frames.length > 0 ? `Event ${cursor + 1} / ${frames.length}` : '0 Events'}
        </span>
      </div>

      {/* Current Operation Telemetry Block */}
      <div className="border-b border-slate-800/80 bg-charcoal-950/60 p-3.5">
        {event && visual ? (
          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between rounded-lg border border-electric-500/30 bg-electric-600/10 px-3 py-2">
              <span className="text-[11px] font-semibold text-slate-400">PACKAGE RECEIVED:</span>
              <span className="text-sm font-bold text-cyanpulse-300">
                {visual.packageId !== null ? visual.packageId : 'SNAPSHOT SYNC'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-charcoal-900/75 p-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Searching</div>
                <div className="mt-0.5 text-slate-200">
                  {activeNode
                    ? `Visited node [${activeNode.intervalStart}, ${activeNode.intervalEnd}]`
                    : event.message}
                </div>
              </div>

              {visual.comparison && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                    <GitCompare className="h-3 w-3 text-electric-400" />
                    Comparison
                  </div>
                  <div className="mt-0.5 text-electric-400">{visual.comparison}</div>
                </div>
              )}

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Action</div>
                <div className="mt-0.5 text-slate-200">{visual.actionText ?? event.message}</div>
              </div>

              {visual.intervalResult && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Interval Result
                  </div>
                  <div className="mt-0.5 font-semibold text-cyanpulse-300">
                    {visual.intervalResult}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-800/90 pt-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  Tree Status
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${
                    visual.treeStatus.toLowerCase().includes('unbalanced')
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {visual.treeStatus.toLowerCase().includes('unbalanced') ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {visual.treeStatus}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-slate-500">
            <Activity className="mb-2 h-6 w-6 text-slate-600" />
            Waiting for backend AVL operation events...
          </div>
        )}
      </div>

      {/* Invalid Backend Payloads Diagnostic Banner (if any) */}
      {invalidEvents.length > 0 && (
        <div className="border-b border-red-500/30 bg-red-950/30 px-3.5 py-2 text-xs">
          <div className="flex items-center justify-between text-red-300">
            <span className="font-mono font-semibold">
              Rejected {invalidEvents.length} invalid backend payload(s)
            </span>
            <button
              type="button"
              onClick={clearInvalidEvents}
              className="text-[11px] text-red-400 underline hover:text-red-200"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-red-300/80">
            Latest: {invalidEvents[0].reason}
          </p>
        </div>
      )}

      {/* Chronological Event History */}
      <div className="flex items-center justify-between px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Chronological Event History
        </span>
        <span className="font-mono text-[10px] text-slate-500">Click any event to inspect</span>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {frames.map((frame, idx) => {
          const isCurrent = idx === cursor;
          const isFuture = idx > cursor;
          return (
            <button
              key={`${frame.event.eventId}-${idx}`}
              type="button"
              onClick={() => jumpToFrame(idx)}
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                isCurrent
                  ? 'border-cyanpulse-400/70 bg-electric-600/15 shadow-cyanGlow'
                  : isFuture
                    ? 'border-slate-800/50 bg-charcoal-950/40 opacity-50 hover:opacity-85'
                    : 'border-slate-800/80 bg-charcoal-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                <span
                  className={`rounded px-1.5 py-0.5 font-bold ${
                    frame.event.stage.includes('ROTATION')
                      ? 'bg-amber-500/20 text-amber-300'
                      : frame.event.stage.includes('MERG') || frame.event.stage === 'BRIDGE_DETECTED'
                        ? 'bg-cyanpulse-500/20 text-cyanpulse-300'
                        : frame.event.stage === 'DUPLICATE_PACKAGE'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-slate-800 text-electric-400'
                  }`}
                >
                  #{frame.event.sequence} · {frame.event.stage}
                </span>
                {frame.event.packageId !== undefined && (
                  <span className="text-slate-400">PKG {frame.event.packageId}</span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-200">{frame.event.message}</div>
              {isCurrent && <div ref={historyEndRef} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
