import { create } from 'zustand';
import {
  AvlBackendEvent,
  AvlEventStage,
  ConnectionStatus,
  IntervalSummary,
  InvalidEventRecord,
  NormalizedTreeSnapshot,
  PlaybackFrame,
  VisualStepState,
  WarehouseAnalyticsSnapshot,
} from '../types/avlBackend';
import {
  createEmptyAnalytics,
  createEmptyTreeSnapshot,
  validateBackendEvent,
} from '../services/eventValidator';

export type ViewMode = '3d' | '2d';
export type AppSection = 'visualizer' | 'explorer' | 'analytics' | 'learn';

const STAGE_TO_STEP_NUMBER: Record<AvlEventStage, number> = {
  SNAPSHOT_SYNC: 0,
  PACKAGE_ARRIVED: 1,
  SEARCH_START: 2,
  SEARCH_VISIT: 3,
  PREDECESSOR_FOUND: 4,
  SUCCESSOR_FOUND: 5,
  BRIDGE_DETECTED: 6,
  INTERVAL_MERGING: 7,
  INTERVAL_INSERTED: 8,
  INTERVAL_EXTENDED: 8,
  DUPLICATE_PACKAGE: 8,
  BALANCE_UPDATED: 8,
  ROTATION_DETECTED: 8,
  ROTATION_APPLIED: 8,
  TREE_UPDATED: 8,
  INTERVAL_LIST_UPDATED: 9,
  INSERTION_COMPLETED: 10,
};

function deriveVisualState(event: AvlBackendEvent, prevVisual: VisualStepState | null): VisualStepState {
  const isNewOperation =
    !prevVisual ||
    event.stage === 'PACKAGE_ARRIVED' ||
    event.stage === 'SNAPSHOT_SYNC';

  const baseVisited = isNewOperation ? [] : [...prevVisual.visitedNodeIds];
  const visitedFromHighlight = event.highlight?.visitedIds ?? [];
  const activeNodeId =
    event.highlight?.activeNodeId !== undefined
      ? event.highlight.activeNodeId
      : event.stage === 'SEARCH_START'
        ? event.highlight?.rootId ?? null
        : null;

  for (const id of visitedFromHighlight) {
    if (!baseVisited.includes(id)) baseVisited.push(id);
  }
  if (activeNodeId && event.stage === 'SEARCH_VISIT' && !baseVisited.includes(activeNodeId)) {
    baseVisited.push(activeNodeId);
  }

  return {
    stage: event.stage,
    stepNumber: event.stepNumber ?? STAGE_TO_STEP_NUMBER[event.stage],
    activeNodeId,
    visitedNodeIds: baseVisited,
    predecessorId:
      event.highlight?.predecessorId !== undefined
        ? event.highlight.predecessorId
        : isNewOperation
          ? null
          : prevVisual.predecessorId,
    successorId:
      event.highlight?.successorId !== undefined
        ? event.highlight.successorId
        : isNewOperation
          ? null
          : prevVisual.successorId,
    unbalancedNodeId:
      event.rotation?.unbalancedNodeId ??
      event.highlight?.unbalancedNodeId ??
      null,
    pivotNodeId:
      event.rotation?.pivotNodeId ??
      event.highlight?.pivotNodeId ??
      null,
    mergedNodeId:
      event.highlight?.mergedNodeId ??
      (event.stage === 'INTERVAL_MERGING' || event.stage === 'TREE_UPDATED'
        ? prevVisual?.mergedNodeId ?? null
        : null),
    activeRotation:
      event.stage === 'ROTATION_DETECTED' || event.stage === 'ROTATION_APPLIED'
        ? event.rotation ?? null
        : null,
    activeMerge:
      event.stage === 'BRIDGE_DETECTED' || event.stage === 'INTERVAL_MERGING'
        ? event.mergeInfo ?? prevVisual?.activeMerge ?? null
        : null,
    affectedEdgePairs: event.highlight?.affectedEdgePairs ?? [],
    packageId: event.packageId ?? (isNewOperation ? null : prevVisual.packageId),
    comparison: event.comparison ?? null,
    actionText: event.actionText ?? event.message,
    intervalResult:
      event.intervalResult ?? (isNewOperation ? null : prevVisual.intervalResult),
    treeStatus:
      event.treeStatus ??
      (event.stage === 'ROTATION_DETECTED'
        ? `Unbalanced (${event.rotation?.type ?? 'Rotation pending'})`
        : event.stage === 'ROTATION_APPLIED'
          ? `Rebalanced (${event.rotation?.type} rotation applied)`
          : prevVisual?.treeStatus ?? 'Balanced'),
  };
}

export interface AvlVisualizerState {
  // Connection & Source Mode
  connectionStatus: ConnectionStatus;
  connectionDetail: string;
  activeSourceLabel: string;
  isTraceMode: boolean;
  isAwaitingBackendResponse: boolean;
  lastSubmissionError: string | null;

  // Recorded Backend Event Timeline (immutable snapshots per frame)
  frames: PlaybackFrame[];
  cursor: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.25x .. 3x

  // Interaction & UI Controls
  viewMode: ViewMode;
  activeSection: AppSection;
  selectedNodeId: string | null;
  focusSubtreeRootId: string | null;
  highlightedSearchPathOnly: boolean;
  cameraResetNonce: number;

  // Interval Explorer Range Filter
  explorerRangeStart: number;
  explorerRangeEnd: number;

  // Invalid / Diagnostics
  invalidEvents: InvalidEventRecord[];

  // Actions
  setConnectionStatus: (status: ConnectionStatus, detail?: string) => void;
  setAwaitingBackendResponse: (awaiting: boolean, error?: string | null) => void;
  ingestBackendEvent: (event: AvlBackendEvent, sourceLabel?: string) => void;
  syncInitialSnapshot: (
    snapshot: NormalizedTreeSnapshot,
    intervals: IntervalSummary[],
    analytics: WarehouseAnalyticsSnapshot,
    sourceLabel?: string,
  ) => void;
  loadRecordedTrace: (
    rawEvents: unknown[],
    traceLabel: string,
    autoPlay?: boolean,
  ) => { loaded: number; rejected: number };
  recordInvalidEvent: (reason: string, rawPreview: string) => void;
  clearInvalidEvents: () => void;

  // Playback Actions (purely operating on recorded backend frames)
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToFrame: (index: number) => void;
  restartPlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;

  // Tree Interaction Actions
  setViewMode: (mode: ViewMode) => void;
  setActiveSection: (section: AppSection) => void;
  selectNode: (nodeId: string | null) => void;
  setFocusSubtreeRootId: (nodeId: string | null) => void;
  setHighlightedSearchPathOnly: (enabled: boolean) => void;
  triggerCameraReset: () => void;
  setExplorerRange: (start: number, end: number) => void;
  resetSession: () => void;
}

export const useAvlStore = create<AvlVisualizerState>((set, get) => ({
  connectionStatus: 'disconnected',
  connectionDetail: 'Not connected to Member 2 backend',
  activeSourceLabel: 'Awaiting Backend Stream',
  isTraceMode: false,
  isAwaitingBackendResponse: false,
  lastSubmissionError: null,

  frames: [],
  cursor: -1,
  isPlaying: false,
  playbackSpeed: 1,

  viewMode: '3d',
  activeSection: 'visualizer',
  selectedNodeId: null,
  focusSubtreeRootId: null,
  highlightedSearchPathOnly: false,
  cameraResetNonce: 0,

  explorerRangeStart: 1,
  explorerRangeEnd: 30,

  invalidEvents: [],

  setConnectionStatus: (status, detail) =>
    set((state) => ({
      connectionStatus: status,
      connectionDetail: detail ?? state.connectionDetail,
    })),

  setAwaitingBackendResponse: (awaiting, error = null) =>
    set({
      isAwaitingBackendResponse: awaiting,
      lastSubmissionError: error,
    }),

  ingestBackendEvent: (event, sourceLabel) => {
    const state = get();
    const prevFrame = state.frames.length > 0 ? state.frames[state.frames.length - 1] : null;
    const nextSnapshot = event.snapshot ?? prevFrame?.snapshot ?? createEmptyTreeSnapshot();
    const nextIntervals = event.intervals ?? prevFrame?.intervals ?? [];
    const nextAnalytics = event.analytics ?? prevFrame?.analytics ?? createEmptyAnalytics();
    const visual = deriveVisualState(event, prevFrame?.visual ?? null);

    const frame: PlaybackFrame = {
      index: state.frames.length,
      event,
      snapshot: nextSnapshot,
      intervals: nextIntervals,
      analytics: nextAnalytics,
      visual,
    };

    const wasAtEnd = state.cursor === state.frames.length - 1 || state.frames.length === 0;
    const updatedFrames = [...state.frames, frame];

    set({
      frames: updatedFrames,
      cursor: wasAtEnd ? updatedFrames.length - 1 : state.cursor,
      isAwaitingBackendResponse: false,
      lastSubmissionError: null,
      isTraceMode: false,
      activeSourceLabel: sourceLabel ?? 'Live Backend Stream',
    });
  },

  syncInitialSnapshot: (snapshot, intervals, analytics, sourceLabel = 'Live Backend Snapshot') => {
    const syncEvent: AvlBackendEvent = {
      eventId: `sync-${Date.now()}`,
      sequence: 0,
      timestamp: new Date().toISOString(),
      operationId: 'sync-0',
      stage: 'SNAPSHOT_SYNC',
      message: `Synchronized authoritative AVL snapshot (${snapshot.nodeOrder.length} intervals).`,
      treeStatus: 'Balanced',
      snapshot,
      intervals,
      analytics,
    };
    const visual = deriveVisualState(syncEvent, null);
    const frame: PlaybackFrame = {
      index: 0,
      event: syncEvent,
      snapshot,
      intervals,
      analytics,
      visual,
    };
    set({
      frames: [frame],
      cursor: 0,
      isPlaying: false,
      isTraceMode: false,
      activeSourceLabel: sourceLabel,
      selectedNodeId: null,
      focusSubtreeRootId: null,
    });
  },

  loadRecordedTrace: (rawEvents, traceLabel, autoPlay = false) => {
    const frames: PlaybackFrame[] = [];
    const invalid: InvalidEventRecord[] = [];

    let prevFrame: PlaybackFrame | null = null;
    for (const raw of rawEvents) {
      const res = validateBackendEvent(raw);
      if (!res.ok) {
        invalid.push({
          id: `inv-${Date.now()}-${invalid.length}`,
          receivedAt: new Date().toISOString(),
          reason: res.error,
          rawPayloadPreview: JSON.stringify(raw).slice(0, 200),
        });
        continue;
      }
      const ev = res.value;
      const snapshot = ev.snapshot ?? prevFrame?.snapshot ?? createEmptyTreeSnapshot();
      const intervals = ev.intervals ?? prevFrame?.intervals ?? [];
      const analytics = ev.analytics ?? prevFrame?.analytics ?? createEmptyAnalytics();
      const visual = deriveVisualState(ev, prevFrame?.visual ?? null);

      const frame: PlaybackFrame = {
        index: frames.length,
        event: ev,
        snapshot,
        intervals,
        analytics,
        visual,
      };
      frames.push(frame);
      prevFrame = frame;
    }

    set((state) => ({
      frames,
      cursor: frames.length > 0 ? 0 : -1,
      isPlaying: autoPlay && frames.length > 1,
      isTraceMode: true,
      activeSourceLabel: `Recorded Backend Trace: ${traceLabel}`,
      selectedNodeId: null,
      focusSubtreeRootId: null,
      invalidEvents: [...invalid, ...state.invalidEvents].slice(0, 50),
    }));

    return { loaded: frames.length, rejected: invalid.length };
  },

  recordInvalidEvent: (reason, rawPreview) =>
    set((state) => ({
      invalidEvents: [
        {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          receivedAt: new Date().toISOString(),
          reason,
          rawPayloadPreview: rawPreview,
        },
        ...state.invalidEvents,
      ].slice(0, 50),
    })),

  clearInvalidEvents: () => set({ invalidEvents: [] }),

  play: () => {
    const { frames, cursor } = get();
    if (frames.length === 0) return;
    if (cursor >= frames.length - 1) {
      set({ cursor: 0, isPlaying: true });
    } else {
      set({ isPlaying: true });
    }
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => {
    const { isPlaying, play, pause } = get();
    if (isPlaying) pause();
    else play();
  },

  stepForward: () =>
    set((state) => {
      if (state.frames.length === 0) return state;
      const next = Math.min(state.frames.length - 1, state.cursor + 1);
      return {
        cursor: next,
        isPlaying: next >= state.frames.length - 1 ? false : state.isPlaying,
      };
    }),

  stepBackward: () =>
    set((state) => {
      if (state.frames.length === 0) return state;
      const prev = Math.max(0, state.cursor - 1);
      return {
        cursor: prev,
        isPlaying: false,
      };
    }),

  jumpToFrame: (index) =>
    set((state) => {
      if (state.frames.length === 0) return state;
      const clamped = Math.max(0, Math.min(state.frames.length - 1, index));
      return {
        cursor: clamped,
        isPlaying: false,
      };
    }),

  restartPlayback: () =>
    set((state) => ({
      cursor: state.frames.length > 0 ? 0 : -1,
      isPlaying: false,
    })),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveSection: (section) => set({ activeSection: section }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setFocusSubtreeRootId: (nodeId) => set({ focusSubtreeRootId: nodeId }),
  setHighlightedSearchPathOnly: (enabled) => set({ highlightedSearchPathOnly: enabled }),
  triggerCameraReset: () => set((state) => ({ cameraResetNonce: state.cameraResetNonce + 1 })),
  setExplorerRange: (start, end) =>
    set({
      explorerRangeStart: Math.min(start, end),
      explorerRangeEnd: Math.max(start, end),
    }),

  resetSession: () =>
    set({
      frames: [],
      cursor: -1,
      isPlaying: false,
      isTraceMode: false,
      selectedNodeId: null,
      focusSubtreeRootId: null,
      lastSubmissionError: null,
    }),
}));
