import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAvlStore } from '../store/useAvlStore';
import { RECORDED_BACKEND_TRACES } from '../fixtures/backendTraces';
import { IntervalExplorer } from '../components/explorer/IntervalExplorer';
import { WarehouseAnalytics } from '../components/analytics/WarehouseAnalytics';
import { LiveEventPanel } from '../components/events/LiveEventPanel';

describe('Event-sourced playback & UI modules', () => {
  beforeEach(() => {
    useAvlStore.getState().resetSession();
  });

  it('steps forward and backward using saved backend snapshots without re-running AVL logic', () => {
    const bridgeTrace = RECORDED_BACKEND_TRACES[0];
    const res = useAvlStore.getState().loadRecordedTrace(bridgeTrace.events, bridgeTrace.name);
    expect(res.loaded).toBe(11);
    expect(res.rejected).toBe(0);

    // Initially at frame 0 (2 nodes: [1,3] and [5,8])
    let state = useAvlStore.getState();
    expect(state.cursor).toBe(0);
    expect(state.frames[state.cursor].snapshot.nodeOrder).toEqual(['n_1_3', 'n_5_8']);

    // Jump to frame 8 (TREE_UPDATED -> merged [1,8])
    state.jumpToFrame(8);
    state = useAvlStore.getState();
    expect(state.frames[state.cursor].snapshot.nodeOrder).toEqual(['n_1_8']);

    // Step backward restores frame 7 snapshot ([1,3], [5,8]) cleanly
    state.stepBackward();
    state = useAvlStore.getState();
    expect(state.cursor).toBe(7);
    expect(state.frames[state.cursor].snapshot.nodeOrder).toEqual(['n_1_3', 'n_5_8']);
  });

  it('renders IntervalExplorer, WarehouseAnalytics, and LiveEventPanel from backend trace', () => {
    const rotTrace = RECORDED_BACKEND_TRACES[1];
    useAvlStore.getState().loadRecordedTrace(rotTrace.events, rotTrace.name);
    useAvlStore.getState().jumpToFrame(rotTrace.events.length - 1);

    const { unmount: u1 } = render(<IntervalExplorer />);
    expect(screen.getByText('[10, 10]')).toBeInTheDocument();
    expect(screen.getByText('Total Unique Packages')).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<WarehouseAnalytics />);
    expect(screen.getByText('AVL ROTATIONS')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
    u2();

    const { unmount: u3 } = render(<LiveEventPanel />);
    expect(screen.getAllByText(/DUPLICATE_PACKAGE/).length).toBeGreaterThanOrEqual(1);
    u3();
  });
});
