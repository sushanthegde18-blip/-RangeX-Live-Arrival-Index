import React, { useEffect } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Gauge,
} from 'lucide-react';
import { useAvlStore } from '../../store/useAvlStore';

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3];

export const PlaybackControls: React.FC = () => {
  const frames = useAvlStore((s) => s.frames);
  const cursor = useAvlStore((s) => s.cursor);
  const isPlaying = useAvlStore((s) => s.isPlaying);
  const playbackSpeed = useAvlStore((s) => s.playbackSpeed);

  const togglePlay = useAvlStore((s) => s.togglePlay);
  const pause = useAvlStore((s) => s.pause);
  const stepForward = useAvlStore((s) => s.stepForward);
  const stepBackward = useAvlStore((s) => s.stepBackward);
  const jumpToFrame = useAvlStore((s) => s.jumpToFrame);
  const restartPlayback = useAvlStore((s) => s.restartPlayback);
  const setPlaybackSpeed = useAvlStore((s) => s.setPlaybackSpeed);

  // Advance through recorded backend frames when playing
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const intervalMs = Math.max(220, Math.round(950 / playbackSpeed));
    const timer = setInterval(() => {
      const state = useAvlStore.getState();
      if (state.cursor >= state.frames.length - 1) {
        pause();
      } else {
        state.stepForward();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, frames.length, pause]);

  const hasFrames = frames.length > 0;
  const canStepBack = hasFrames && cursor > 0;
  const canStepForward = hasFrames && cursor < frames.length - 1;

  return (
    <div className="rangex-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
      {/* Transport Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={restartPlayback}
          disabled={!hasFrames}
          className="rounded-lg border border-slate-700/80 bg-charcoal-900 p-2 text-slate-300 transition hover:border-electric-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Restart visualization"
          aria-label="Restart visualization"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={stepBackward}
          disabled={!canStepBack}
          className="rounded-lg border border-slate-700/80 bg-charcoal-900 p-2 text-slate-300 transition hover:border-electric-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Previous step (restores saved snapshot)"
          aria-label="Previous step"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasFrames}
          className="flex items-center gap-1.5 rounded-lg bg-electric-600 px-3.5 py-2 text-xs font-semibold text-white shadow-glow transition hover:bg-electric-500 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          type="button"
          onClick={stepForward}
          disabled={!canStepForward}
          className="rounded-lg border border-slate-700/80 bg-charcoal-900 p-2 text-slate-300 transition hover:border-electric-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          title="Next step"
          aria-label="Next step"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Scrubbable Backend Event Timeline */}
      <div className="flex min-w-[200px] flex-1 items-center gap-3 px-2">
        <span className="font-mono text-[11px] text-slate-400">
          {hasFrames ? `${cursor + 1}/${frames.length}` : '0/0'}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={Math.max(0, cursor)}
          disabled={!hasFrames}
          onChange={(e) => jumpToFrame(Number(e.target.value))}
          aria-label="Event timeline scrubber"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyanpulse-400 disabled:cursor-not-allowed"
        />
      </div>

      {/* Animation Speed Control */}
      <div className="flex items-center gap-1.5">
        <Gauge className="h-3.5 w-3.5 text-cyanpulse-400" />
        <span className="text-[11px] text-slate-400">Speed</span>
        <div className="flex items-center rounded-lg border border-slate-800 bg-charcoal-950 p-0.5">
          {SPEED_OPTIONS.map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => setPlaybackSpeed(spd)}
              className={`rounded-md px-2 py-1 font-mono text-[11px] transition ${
                playbackSpeed === spd
                  ? 'bg-cyanpulse-500/20 font-bold text-cyanpulse-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
