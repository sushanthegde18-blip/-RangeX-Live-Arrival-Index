import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { PositionedEdge, PositionedNode, TreeLayoutResult } from '../../utils/treeLayout';
import { VisualStepState } from '../../types/avlBackend';

interface Tree2DSvgProps {
  layout: TreeLayoutResult;
  visual: VisualStepState | null;
  selectedNodeId: string | null;
  highlightedSearchPathOnly: boolean;
  playbackSpeed: number;
  cameraResetNonce: number;
  onSelectNode: (nodeId: string | null) => void;
}

interface NodeRoleStyle {
  stroke: string;
  glow: string;
  badgeText: string | null;
  badgeColor: string;
}

function getNodeRoleStyle(
  nodeId: string,
  rootId: string | null,
  visual: VisualStepState | null,
  selectedNodeId: string | null,
): NodeRoleStyle {
  if (visual?.unbalancedNodeId === nodeId) {
    return {
      stroke: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.45)',
      badgeText: 'UNBALANCED',
      badgeColor: '#ef4444',
    };
  }
  if (visual?.pivotNodeId === nodeId) {
    return {
      stroke: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.45)',
      badgeText: 'PIVOT',
      badgeColor: '#f59e0b',
    };
  }
  if (visual?.activeNodeId === nodeId) {
    return {
      stroke: '#22d3ee',
      glow: 'rgba(34, 211, 238, 0.55)',
      badgeText: 'ACTIVE',
      badgeColor: '#06b6d4',
    };
  }
  if (visual?.predecessorId === nodeId) {
    return {
      stroke: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.45)',
      badgeText: 'PREDECESSOR',
      badgeColor: '#9333ea',
    };
  }
  if (visual?.successorId === nodeId) {
    return {
      stroke: '#10b981',
      glow: 'rgba(16, 185, 129, 0.45)',
      badgeText: 'SUCCESSOR',
      badgeColor: '#059669',
    };
  }
  if (visual?.mergedNodeId === nodeId) {
    return {
      stroke: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.5)',
      badgeText: 'MERGED',
      badgeColor: '#0284c7',
    };
  }
  if (visual?.visitedNodeIds.includes(nodeId)) {
    return {
      stroke: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.4)',
      badgeText: 'VISITED',
      badgeColor: '#2563eb',
    };
  }
  if (selectedNodeId === nodeId) {
    return {
      stroke: '#67e8f9',
      glow: 'rgba(103, 232, 249, 0.45)',
      badgeText: 'SELECTED',
      badgeColor: '#0891b2',
    };
  }
  if (rootId === nodeId && visual?.stage === 'SEARCH_START') {
    return {
      stroke: '#22d3ee',
      glow: 'rgba(34, 211, 238, 0.45)',
      badgeText: 'ROOT',
      badgeColor: '#0284c7',
    };
  }
  return {
    stroke: '#334155',
    glow: 'rgba(59, 130, 246, 0.12)',
    badgeText: null,
    badgeColor: '#334155',
  };
}

const AnimatedSvgNode: React.FC<{
  pNode: PositionedNode;
  style: NodeRoleStyle;
  dimmed: boolean;
  isLargeTree: boolean;
  duration: number;
  onSelect: () => void;
}> = React.memo(({ pNode, style, dimmed, isLargeTree, duration, onSelect }) => {
  const groupRef = useRef<SVGGElement>(null);
  const { node, x2d, y2d } = pNode;

  useEffect(() => {
    if (!groupRef.current) return;
    if (isLargeTree) {
      groupRef.current.setAttribute('transform', `translate(${x2d}, ${y2d})`);
      return;
    }
    gsap.to(groupRef.current, {
      attr: { transform: `translate(${x2d}, ${y2d})` },
      duration,
      ease: 'power3.out',
    });
  }, [x2d, y2d, duration, isLargeTree]);

  const bf = node.balanceFactor;
  const bfText = bf > 0 ? `+${bf}` : `${bf}`;
  const isUnbalanced = Math.abs(bf) > 1;

  return (
    <g
      ref={groupRef}
      transform={`translate(${x2d}, ${y2d})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="cursor-pointer select-none"
      style={{ opacity: dimmed ? 0.28 : 1, transition: 'opacity 200ms ease' }}
    >
      {/* Outer Glow */}
      <rect
        x={-66}
        y={-38}
        width={132}
        height={76}
        rx={12}
        fill="none"
        stroke={style.glow}
        strokeWidth={6}
      />

      {/* Metallic Node Card */}
      <rect
        x={-64}
        y={-36}
        width={128}
        height={72}
        rx={10}
        fill="url(#rangexMetalGrad)"
        stroke={style.stroke}
        strokeWidth={2}
      />

      {/* Role Tag */}
      {style.badgeText && (
        <g transform="translate(0, -45)">
          <rect x={-46} y={-9} width={92} height={17} rx={6} fill={style.badgeColor} />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            className="font-mono text-[9px] font-bold fill-white tracking-wider"
          >
            {style.badgeText}
          </text>
        </g>
      )}

      {/* Interval [start, end] */}
      <text
        x={0}
        y={-6}
        textAnchor="middle"
        className="font-mono text-[14px] font-bold fill-slate-100"
      >
        [{node.intervalStart}, {node.intervalEnd}]
      </text>

      {/* Divider */}
      <line x1={-52} y1={6} x2={52} y2={6} stroke="rgba(148,163,184,0.2)" strokeWidth={1} />

      {/* Height & Balance Factor */}
      <text
        x={-28}
        y={23}
        textAnchor="middle"
        className="font-mono text-[11px] font-semibold fill-blue-300"
      >
        H:{node.height}
      </text>
      <rect
        x={4}
        y={11}
        width={48}
        height={18}
        rx={5}
        fill={isUnbalanced ? 'rgba(239,68,68,0.24)' : 'rgba(34,211,238,0.14)'}
        stroke={isUnbalanced ? '#f87171' : 'rgba(34,211,238,0.45)'}
        strokeWidth={1}
      />
      <text
        x={28}
        y={23}
        textAnchor="middle"
        className={`font-mono text-[11px] font-bold ${isUnbalanced ? 'fill-red-300' : 'fill-cyan-300'}`}
      >
        BF:{bfText}
      </text>
    </g>
  );
});

const AnimatedSvgEdge: React.FC<{
  edge: PositionedEdge;
  highlighted: boolean;
  rotationAffected: boolean;
  dimmed: boolean;
}> = React.memo(({ edge, highlighted, rotationAffected, dimmed }) => {
  const stroke = rotationAffected
    ? '#f59e0b'
    : highlighted
      ? '#22d3ee'
      : 'rgba(100, 116, 139, 0.55)';

  return (
    <g style={{ opacity: dimmed ? 0.2 : 1, transition: 'opacity 200ms ease' }}>
      <line
        x1={edge.x1}
        y1={edge.y1 + 36}
        x2={edge.x2}
        y2={edge.y2 - 36}
        stroke={stroke}
        strokeWidth={rotationAffected || highlighted ? 2.8 : 1.7}
        strokeDasharray={rotationAffected ? '6 4' : undefined}
        style={{ transition: 'all 350ms ease' }}
      />
      {/* L / R branch micro-label */}
      <text
        x={(edge.x1 + edge.x2) / 2 + (edge.side === 'left' ? -10 : 10)}
        y={(edge.y1 + edge.y2) / 2}
        textAnchor="middle"
        className="font-mono text-[9px] fill-slate-500 select-none"
      >
        {edge.side === 'left' ? 'L' : 'R'}
      </text>
    </g>
  );
});

export const Tree2DSvg: React.FC<Tree2DSvgProps> = ({
  layout,
  visual,
  selectedNodeId,
  highlightedSearchPathOnly,
  playbackSpeed,
  cameraResetNonce,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const isLargeTree = layout.totalVisibleNodes > 40;
  const animDuration = Math.max(0.18, 0.55 / playbackSpeed);

  // Reset pan/zoom when requested or when tree was previously empty
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [cameraResetNonce]);

  const viewBox = useMemo(() => {
    const padX = 110;
    const padY = 90;
    const w = layout.bounds2d.width + padX * 2;
    const h = layout.bounds2d.height + padY * 2;
    const cx = (layout.bounds2d.minX + layout.bounds2d.maxX) / 2;
    const cy = (layout.bounds2d.minY + layout.bounds2d.maxY) / 2;

    const scaledW = w / zoom;
    const scaledH = h / zoom;
    const minX = cx - scaledW / 2 - pan.x;
    const minY = cy - scaledH / 2 - pan.y;
    return `${minX} ${minY} ${scaledW} ${scaledH}`;
  }, [layout.bounds2d, zoom, pan]);

  const rootId = layout.nodes[0]
    ? layout.nodes.find((n) => n.depth === 0)?.node.id ?? null
    : null;

  const affectedEdgeSet = useMemo(() => {
    const set = new Set<string>();
    for (const pair of visual?.affectedEdgePairs ?? []) {
      set.add(`${pair[0]}->${pair[1]}`);
      set.add(`${pair[1]}->${pair[0]}`);
    }
    return set;
  }, [visual?.affectedEdgePairs]);

  const visitedSet = useMemo(() => new Set(visual?.visitedNodeIds ?? []), [visual?.visitedNodeIds]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((z) => Math.min(4.5, Math.max(0.25, Number((z * factor).toFixed(3)))));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragOrigin.current.x) / zoom;
    const dy = (e.clientY - dragOrigin.current.y) / zoom;
    setPan({
      x: dragOrigin.current.panX + dx,
      y: dragOrigin.current.panY + dy,
    });
  };

  const handlePointerUp = () => setIsDragging(false);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={() => onSelectNode(null)}
      className={`relative h-full w-full overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <svg className="h-full w-full" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="rangexMetalGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e2738" />
            <stop offset="50%" stopColor="#0f141f" />
            <stop offset="100%" stopColor="#182030" />
          </linearGradient>
        </defs>

        {/* Edges */}
        {layout.edges.map((edge) => {
          const isVisitedEdge =
            visitedSet.has(edge.parentId) &&
            (visitedSet.has(edge.childId) || visual?.activeNodeId === edge.childId);
          const isRotationEdge =
            affectedEdgeSet.has(edge.id) ||
            (visual?.activeRotation?.affectedNodeIds.includes(edge.parentId) &&
              visual?.activeRotation?.affectedNodeIds.includes(edge.childId));

          const dimmed =
            highlightedSearchPathOnly &&
            visitedSet.size > 0 &&
            !isVisitedEdge &&
            !isRotationEdge;

          return (
            <AnimatedSvgEdge
              key={edge.id}
              edge={edge}
              highlighted={Boolean(isVisitedEdge)}
              rotationAffected={Boolean(isRotationEdge)}
              dimmed={Boolean(dimmed)}
            />
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((pNode) => {
          const id = pNode.node.id;
          const style = getNodeRoleStyle(id, rootId, visual, selectedNodeId);
          const isInPath =
            visitedSet.has(id) ||
            visual?.activeNodeId === id ||
            visual?.predecessorId === id ||
            visual?.successorId === id ||
            visual?.unbalancedNodeId === id ||
            visual?.pivotNodeId === id;

          const dimmed = highlightedSearchPathOnly && visitedSet.size > 0 && !isInPath;

          return (
            <AnimatedSvgNode
              key={id}
              pNode={pNode}
              style={style}
              dimmed={dimmed}
              isLargeTree={isLargeTree}
              duration={animDuration}
              onSelect={() => onSelectNode(id)}
            />
          );
        })}
      </svg>

      {/* 2D Zoom Controls Overlay */}
      <div
        className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-charcoal-950/90 px-2 py-1 text-xs backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4.5, Number((z * 1.2).toFixed(2))))}
          className="rounded px-2 py-0.5 font-mono text-slate-200 hover:bg-slate-800"
          title="Zoom In"
        >
          +
        </button>
        <span className="font-mono text-[11px] text-cyanpulse-300">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.25, Number((z * 0.85).toFixed(2))))}
          className="rounded px-2 py-0.5 font-mono text-slate-200 hover:bg-slate-800"
          title="Zoom Out"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="ml-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-electric-500 hover:text-white"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
