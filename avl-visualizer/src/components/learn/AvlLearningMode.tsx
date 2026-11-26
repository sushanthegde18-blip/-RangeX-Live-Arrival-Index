import React, { useState } from 'react';
import {
  BookOpen,
  Scale,
  Zap,
  GitBranch,
  RotateCw,
  Timer,
  CheckCircle2,
} from 'lucide-react';

interface Topic {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  summary: string;
  points: string[];
  diagram?: {
    label: string;
    before: string;
    after: string;
    trigger: string;
  };
}

const TOPICS: Topic[] = [
  {
    id: 'what-is-avl',
    title: '1. What is an AVL Tree?',
    subtitle: 'Self-balancing Binary Search Tree (Adelson-Velsky & Landis)',
    icon: <GitBranch className="h-4 w-4 text-cyanpulse-400" />,
    summary:
      'An AVL Tree is a Binary Search Tree (BST) that automatically keeps its height balanced after every insertion or deletion. In RangeX, each node stores a merged contiguous interval [intervalStart, intervalEnd] of arrived package IDs.',
    points: [
      'BST Property: Every interval in the left subtree has smaller IDs than the current node, and every interval in the right subtree has larger IDs.',
      'Height Property: Every node tracks its subtree height so balance can be checked immediately on the recursion unwind.',
      'Interval Storage: Storing [start, end] instead of single IDs compresses millions of sequential warehouse packages into compact nodes.',
    ],
  },
  {
    id: 'why-balance',
    title: '2. Why Balancing is Necessary',
    subtitle: 'Preventing O(n) worst-case skewed chains',
    icon: <Scale className="h-4 w-4 text-electric-400" />,
    summary:
      'If packages arrive in sorted order (e.g., 10, 20, 30, 40, 50...), a plain BST degenerates into a linked list of height n. Searching or inserting would slow down to O(n).',
    points: [
      'A skewed tree of 1,000,000 non-contiguous intervals would require up to 1,000,000 comparisons per package.',
      'An AVL Tree guarantees height <= 1.44 * log2(n + 2), so 1,000,000 intervals take at most ~29 comparisons.',
      'For high-throughput warehouse scanners, predictable O(log n) latency prevents conveyor bottlenecks.',
    ],
  },
  {
    id: 'balance-factor',
    title: '3. How Balance Factors Work',
    subtitle: 'BF = height(left) - height(right) ∈ {-1, 0, +1}',
    icon: <Zap className="h-4 w-4 text-amber-400" />,
    summary:
      'The Balance Factor (BF) of any node measures the height difference between its left and right subtrees.',
    points: [
      'BF = 0: Left and right subtrees have identical height (perfectly balanced).',
      'BF = +1 or -1: Acceptable slight tilt; still a valid AVL node.',
      'BF >= +2 (Left-Heavy) or BF <= -2 (Right-Heavy): Violation detected! The C++ AVL Tree triggers a rotation.',
    ],
  },
  {
    id: 'insertion',
    title: '4. How RangeX Interval Insertion Works',
    subtitle: 'Search → Predecessor/Successor Check → Merge → Rebalance',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    summary:
      'When a new package ID arrives at the warehouse, the C++ engine searches the AVL Tree to classify the arrival.',
    points: [
      'Inside an existing [start, end]: Reported as a Duplicate Arrival (tree structure unchanged).',
      'Adjacent to predecessor [a, b] (package == b + 1) or successor [c, d] (package == c - 1): Extends the interval.',
      'Bridges BOTH predecessor and successor (b + 1 == package == c - 1): Merges two intervals into [a, d] and removes the redundant node.',
      'Disjoint: Inserts a new leaf node [p, p], updates heights upward, and applies rotations if |BF| > 1.',
    ],
  },
  {
    id: 'rotations',
    title: '5. How the 4 AVL Rotations Restore Balance',
    subtitle: 'Constant-time O(1) pointer re-wiring',
    icon: <RotateCw className="h-4 w-4 text-cyanpulse-400" />,
    summary:
      'Whenever an insertion or merge-delete causes |BF| == 2, one of four structural rotations restores the AVL invariant while preserving sorted BST order.',
    points: [
      'Right Rotation (LL Case): Unbalanced node has BF = +2 and left child has BF >= 0. Left child pivots up.',
      'Left Rotation (RR Case): Unbalanced node has BF = -2 and right child has BF <= 0. Right child pivots up.',
      'Left-Right Rotation (LR Case): BF = +2 and left child has BF = -1. Left-rotate child, then right-rotate node.',
      'Right-Left Rotation (RL Case): BF = -2 and right child has BF = +1. Right-rotate child, then left-rotate node.',
    ],
    diagram: {
      label: 'Rotation Quick Reference',
      trigger: 'Triggered only when backend C++ reports |BF| > 1',
      before: 'LL (+2,+1) → Single Right  |  RR (-2,-1) → Single Left',
      after: 'LR (+2,-1) → Left + Right  |  RL (-2,+1) → Right + Left',
    },
  },
  {
    id: 'complexity',
    title: '6. Why Searching Takes O(log n) Time',
    subtitle: 'Halving the search space at every depth level',
    icon: <Timer className="h-4 w-4 text-electric-400" />,
    summary:
      'At each visited node [start, end], one comparison decides whether the package belongs here, strictly left (< start), or strictly right (> end).',
    points: [
      'Each step descends one level deeper in the tree, eliminating an entire half of the remaining intervals.',
      'Because AVL height h is strictly bounded by O(log n), search, predecessor/successor lookup, and insertion all run in O(log n) time.',
      'Space complexity is O(k) where k is the number of disjoint intervals (often much smaller than total packages n).',
    ],
  },
];

export const AvlLearningMode: React.FC = () => {
  const [activeId, setActiveId] = useState<string>(TOPICS[0].id);
  const current = TOPICS.find((t) => t.id === activeId) ?? TOPICS[0];

  return (
    <div className="space-y-4">
      <div className="rangex-panel flex items-center justify-between rounded-2xl p-4">
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-cyanpulse-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              AVL Tree Learning Mode — DSA Evaluation Guide
            </h2>
            <p className="text-xs text-slate-400">
              Interactive concepts behind RangeX&apos;s C++ self-balancing interval index.
            </p>
          </div>
        </div>
        <span className="rounded-lg border border-electric-500/30 bg-electric-600/15 px-3 py-1 font-mono text-xs text-electric-400">
          O(log n) Search &amp; Insert
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Topic Index */}
        <div className="rangex-panel space-y-1.5 rounded-2xl p-3 lg:col-span-4">
          {TOPICS.map((topic) => {
            const active = topic.id === current.id;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActiveId(topic.id)}
                className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                  active
                    ? 'border-cyanpulse-400/60 bg-electric-600/15 shadow-cyanGlow'
                    : 'border-slate-800/70 bg-charcoal-950/60 hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5">{topic.icon}</div>
                <div>
                  <div className="text-xs font-bold text-slate-100">{topic.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{topic.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Detailed Explanation */}
        <div className="rangex-metallic-card rounded-2xl p-6 lg:col-span-8">
          <div className="flex items-center gap-2.5">
            {current.icon}
            <h3 className="text-lg font-bold text-white">{current.title}</h3>
          </div>
          <p className="mt-1 text-xs font-medium text-cyanpulse-300">{current.subtitle}</p>

          <p className="mt-4 text-sm leading-relaxed text-slate-200">{current.summary}</p>

          <div className="mt-5 space-y-2.5">
            {current.points.map((pt, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-charcoal-950/80 px-4 py-3 text-xs leading-relaxed text-slate-300"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-electric-600/25 font-mono text-[10px] font-bold text-cyanpulse-300">
                  {idx + 1}
                </span>
                <span>{pt}</span>
              </div>
            ))}
          </div>

          {current.diagram && (
            <div className="mt-5 rounded-xl border border-cyanpulse-500/30 bg-charcoal-950 p-4 font-mono text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyanpulse-400">
                {current.diagram.label}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{current.diagram.trigger}</div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-charcoal-900 p-2.5 text-slate-200">
                  {current.diagram.before}
                </div>
                <div className="rounded-lg border border-slate-800 bg-charcoal-900 p-2.5 text-electric-400">
                  {current.diagram.after}
                </div>
              </div>
            </div>
          )}

          {/* Color Legend for Live Visualizer */}
          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Live Visualizer Node Color Legend
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px]">
              <span className="rounded-md border border-cyanpulse-400 bg-cyanpulse-500/15 px-2.5 py-1 text-cyanpulse-300">
                Cyan: Active / Root
              </span>
              <span className="rounded-md border border-electric-500 bg-electric-600/15 px-2.5 py-1 text-electric-400">
                Blue: Visited Path
              </span>
              <span className="rounded-md border border-purple-500 bg-purple-500/15 px-2.5 py-1 text-purple-300">
                Purple: Predecessor
              </span>
              <span className="rounded-md border border-emerald-500 bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                Emerald: Successor
              </span>
              <span className="rounded-md border border-red-500 bg-red-500/15 px-2.5 py-1 text-red-300">
                Red: Unbalanced (|BF| &gt; 1)
              </span>
              <span className="rounded-md border border-amber-500 bg-amber-500/15 px-2.5 py-1 text-amber-300">
                Amber: Rotation Pivot
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
