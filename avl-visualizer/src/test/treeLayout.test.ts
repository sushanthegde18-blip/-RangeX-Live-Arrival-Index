import { describe, expect, it } from 'vitest';
import { computeTreeLayout } from '../utils/treeLayout';
import { validateAndNormalizeSnapshot } from '../services/eventValidator';

describe('computeTreeLayout', () => {
  it('assigns non-overlapping X coordinates in BST in-order sequence', () => {
    const snapRes = validateAndNormalizeSnapshot({
      rootId: 'n20',
      nodes: [
        { id: 'n20', intervalStart: 20, intervalEnd: 20, height: 2, balanceFactor: 0, leftId: 'n10', rightId: 'n30' },
        { id: 'n10', intervalStart: 10, intervalEnd: 10, height: 1, balanceFactor: 0, leftId: null, rightId: null },
        { id: 'n30', intervalStart: 30, intervalEnd: 30, height: 1, balanceFactor: 0, leftId: null, rightId: null },
      ],
    });
    expect(snapRes.ok).toBe(true);
    if (!snapRes.ok) return;

    const layout = computeTreeLayout(snapRes.value);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(2);
    expect(layout.nodesById.n10.x2d).toBeLessThan(layout.nodesById.n20.x2d);
    expect(layout.nodesById.n20.x2d).toBeLessThan(layout.nodesById.n30.x2d);
    expect(layout.nodesById.n20.depth).toBe(0);
    expect(layout.nodesById.n10.depth).toBe(1);
  });

  it('supports focusing on a selected subtree without altering node data', () => {
    const snapRes = validateAndNormalizeSnapshot({
      rootId: 'n20',
      nodes: [
        { id: 'n20', intervalStart: 20, intervalEnd: 20, height: 3, balanceFactor: -1, leftId: 'n10', rightId: 'n40' },
        { id: 'n10', intervalStart: 10, intervalEnd: 10, height: 1, balanceFactor: 0, leftId: null, rightId: null },
        { id: 'n40', intervalStart: 40, intervalEnd: 40, height: 2, balanceFactor: 0, leftId: 'n30', rightId: 'n50' },
        { id: 'n30', intervalStart: 30, intervalEnd: 30, height: 1, balanceFactor: 0, leftId: null, rightId: null },
        { id: 'n50', intervalStart: 50, intervalEnd: 50, height: 1, balanceFactor: 0, leftId: null, rightId: null },
      ],
    });
    expect(snapRes.ok).toBe(true);
    if (!snapRes.ok) return;

    const focused = computeTreeLayout(snapRes.value, 'n40');
    expect(focused.totalVisibleNodes).toBe(3);
    expect(focused.nodesById.n40.depth).toBe(0);
    expect(focused.nodesById.n20).toBeUndefined();
  });
});
