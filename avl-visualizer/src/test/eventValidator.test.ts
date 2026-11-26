import { describe, expect, it } from 'vitest';
import {
  validateAnalytics,
  validateAndNormalizeSnapshot,
  validateBackendEvent,
} from '../services/eventValidator';

describe('eventValidator', () => {
  it('normalizes a valid nested backend snapshot', () => {
    const res = validateAndNormalizeSnapshot({
      root: {
        id: 'n10',
        intervalStart: 10,
        intervalEnd: 15,
        height: 2,
        balanceFactor: 1,
        left: {
          id: 'n3',
          intervalStart: 1,
          intervalEnd: 3,
          height: 1,
          balanceFactor: 0,
        },
        right: null,
      },
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.rootId).toBe('n10');
      expect(res.value.nodesById.n10.leftId).toBe('n3');
      expect(res.value.nodesById.n3.parentId).toBe('n10');
    }
  });

  it('rejects snapshots with cycles or invalid intervals', () => {
    const cycleRes = validateAndNormalizeSnapshot({
      rootId: 'a',
      nodes: [
        { id: 'a', intervalStart: 1, intervalEnd: 2, height: 1, balanceFactor: 0, leftId: 'b', rightId: null },
        { id: 'b', intervalStart: 3, intervalEnd: 4, height: 1, balanceFactor: 0, leftId: 'a', rightId: null },
      ],
    });
    expect(cycleRes.ok).toBe(false);

    const badInterval = validateAndNormalizeSnapshot({
      rootId: 'a',
      nodes: [
        { id: 'a', intervalStart: 10, intervalEnd: 5, height: 1, balanceFactor: 0, leftId: null, rightId: null },
      ],
    });
    expect(badInterval.ok).toBe(false);
  });

  it('rejects rotation events missing rotation payload and unknown stages', () => {
    const missingRot = validateBackendEvent({
      eventId: 'e1',
      sequence: 1,
      stage: 'ROTATION_APPLIED',
      message: 'Rotated',
    });
    expect(missingRot.ok).toBe(false);

    const badStage = validateBackendEvent({
      eventId: 'e2',
      sequence: 2,
      stage: 'FAKE_CLIENT_STAGE',
      message: 'Bad',
    });
    expect(badStage.ok).toBe(false);
  });

  it('validates backend analytics payload strictly', () => {
    const okRes = validateAnalytics({
      totalPackagesReceived: 12,
      totalIntervals: 3,
      largestInterval: { start: 1, end: 8, size: 8 },
      smallestInterval: { start: 20, end: 20, size: 1 },
      totalUniquePackages: 10,
      duplicateArrivals: 2,
      totalIntervalMerges: 4,
      totalAvlRotations: 1,
      currentTreeHeight: 2,
    });
    expect(okRes.ok).toBe(true);

    const negRes = validateAnalytics({
      totalPackagesReceived: -1,
      totalIntervals: 0,
      largestInterval: null,
      smallestInterval: null,
      totalUniquePackages: 0,
      duplicateArrivals: 0,
      totalIntervalMerges: 0,
      totalAvlRotations: 0,
      currentTreeHeight: 0,
    });
    expect(negRes.ok).toBe(false);
  });
});
