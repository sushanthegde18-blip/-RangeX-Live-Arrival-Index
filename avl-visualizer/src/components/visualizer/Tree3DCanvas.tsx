import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PositionedEdge, PositionedNode, TreeLayoutResult } from '../../utils/treeLayout';
import { VisualStepState } from '../../types/avlBackend';
import { createMetallicNodeTexture, NodeVisualPalette } from '../../utils/nodeTexture';

interface Tree3DCanvasProps {
  layout: TreeLayoutResult;
  visual: VisualStepState | null;
  selectedNodeId: string | null;
  highlightedSearchPathOnly: boolean;
  playbackSpeed: number;
  cameraResetNonce: number;
  onSelectNode: (nodeId: string | null) => void;
}

function resolveNodePalette(
  nodeId: string,
  rootId: string | null,
  visual: VisualStepState | null,
  selectedNodeId: string | null,
): NodeVisualPalette {
  if (visual?.unbalancedNodeId === nodeId) {
    return {
      border: '#ef4444',
      glow: 'rgba(239, 68, 68, 0.75)',
      badgeBg: '#dc2626',
      badgeText: '#ffffff',
      tag: 'UNBALANCED',
    };
  }
  if (visual?.pivotNodeId === nodeId) {
    return {
      border: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.75)',
      badgeBg: '#d97706',
      badgeText: '#ffffff',
      tag: 'PIVOT NODE',
    };
  }
  if (visual?.activeNodeId === nodeId) {
    return {
      border: '#22d3ee',
      glow: 'rgba(34, 211, 238, 0.8)',
      badgeBg: '#0891b2',
      badgeText: '#ffffff',
      tag: 'ACTIVE NODE',
    };
  }
  if (visual?.predecessorId === nodeId) {
    return {
      border: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.7)',
      badgeBg: '#7e22ce',
      badgeText: '#ffffff',
      tag: 'PREDECESSOR',
    };
  }
  if (visual?.successorId === nodeId) {
    return {
      border: '#10b981',
      glow: 'rgba(16, 185, 129, 0.7)',
      badgeBg: '#047857',
      badgeText: '#ffffff',
      tag: 'SUCCESSOR',
    };
  }
  if (visual?.mergedNodeId === nodeId) {
    return {
      border: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.8)',
      badgeBg: '#0284c7',
      badgeText: '#ffffff',
      tag: 'MERGED',
    };
  }
  if (visual?.visitedNodeIds.includes(nodeId)) {
    return {
      border: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.65)',
      badgeBg: '#1d4ed8',
      badgeText: '#ffffff',
      tag: 'VISITED',
    };
  }
  if (selectedNodeId === nodeId) {
    return {
      border: '#67e8f9',
      glow: 'rgba(103, 232, 249, 0.75)',
      badgeBg: '#0e7490',
      badgeText: '#ffffff',
      tag: 'SELECTED',
    };
  }
  if (rootId === nodeId && visual?.stage === 'SEARCH_START') {
    return {
      border: '#22d3ee',
      glow: 'rgba(34, 211, 238, 0.7)',
      badgeBg: '#0369a1',
      badgeText: '#ffffff',
      tag: 'TREE ROOT',
    };
  }
  return {
    border: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.28)',
    badgeBg: '#1e293b',
    badgeText: '#94a3b8',
    tag: null,
  };
}

const Node3DMesh: React.FC<{
  pNode: PositionedNode;
  palette: NodeVisualPalette;
  isHighlighted: boolean;
  dimmed: boolean;
  isLargeTree: boolean;
  animDuration: number;
  onSelect: () => void;
}> = React.memo(({ pNode, palette, isHighlighted, dimmed, isLargeTree, animDuration, onSelect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);
  const { node, x3d, y3d, z3d } = pNode;

  const texture = useMemo(() => {
    return createMetallicNodeTexture({
      intervalStart: node.intervalStart,
      intervalEnd: node.intervalEnd,
      height: node.height,
      balanceFactor: node.balanceFactor,
      palette,
    });
  }, [
    node.intervalStart,
    node.intervalEnd,
    node.height,
    node.balanceFactor,
    palette.border,
    palette.tag,
  ]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useEffect(() => {
    if (!groupRef.current) return;
    if (isLargeTree) {
      groupRef.current.position.set(x3d, y3d, z3d);
      return;
    }
    gsap.to(groupRef.current.position, {
      x: x3d,
      y: y3d,
      z: z3d,
      duration: animDuration,
      ease: 'power3.out',
    });
  }, [x3d, y3d, z3d, animDuration, isLargeTree]);

  useFrame(({ clock }) => {
    if (!pulseRingRef.current || isLargeTree) return;
    if (isHighlighted) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 4) * 0.04;
      pulseRingRef.current.scale.set(s, s, 1);
    }
  });

  const opacity = dimmed ? 0.24 : 1;

  return (
    <group
      ref={groupRef}
      position={[x3d, y3d, z3d]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Brushed Metallic Chassis */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.52, 1.28, 0.24]} />
        <meshStandardMaterial
          color="#161f2e"
          metalness={0.82}
          roughness={0.28}
          transparent={dimmed}
          opacity={opacity}
        />
      </mesh>

      {/* Front Node Display Plate */}
      <mesh position={[0, 0, 0.13]}>
        <planeGeometry args={[2.44, 1.22]} />
        <meshBasicMaterial map={texture} transparent opacity={opacity} />
      </mesh>

      {/* Back Node Display Plate (for orbit inspection) */}
      <mesh position={[0, 0, -0.13]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.44, 1.22]} />
        <meshBasicMaterial map={texture} transparent opacity={opacity} />
      </mesh>

      {/* Highlight Electric Aura Frame */}
      {isHighlighted && (
        <mesh ref={pulseRingRef} position={[0, 0, 0.01]}>
          <boxGeometry args={[2.68, 1.44, 0.14]} />
          <meshBasicMaterial
            color={palette.border}
            wireframe
            transparent
            opacity={0.75}
          />
        </mesh>
      )}
    </group>
  );
});

const Edge3DConnector: React.FC<{
  edge: PositionedEdge;
  highlighted: boolean;
  rotationAffected: boolean;
  dimmed: boolean;
}> = React.memo(({ edge, highlighted, rotationAffected, dimmed }) => {
  const points = useMemo(() => {
    const start = new THREE.Vector3(edge.start3d[0], edge.start3d[1] - 0.64, edge.start3d[2]);
    const end = new THREE.Vector3(edge.end3d[0], edge.end3d[1] + 0.64, edge.end3d[2]);
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2 + 0.18,
      (start.z + end.z) / 2 + 0.22,
    );
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return curve.getPoints(16);
  }, [edge.start3d, edge.end3d]);

  const color = rotationAffected
    ? '#f59e0b'
    : highlighted
      ? '#22d3ee'
      : '#3b82f6';

  return (
    <Line
      points={points}
      color={color}
      lineWidth={rotationAffected || highlighted ? 2.8 : 1.3}
      transparent
      opacity={dimmed ? 0.14 : rotationAffected || highlighted ? 0.95 : 0.45}
      dashed={rotationAffected}
      dashSize={0.25}
      gapSize={0.14}
    />
  );
});

const CameraController: React.FC<{
  layout: TreeLayoutResult;
  resetNonce: number;
}> = ({ layout, resetNonce }) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useEffect(() => {
    const count = Math.max(1, layout.totalVisibleNodes);
    const spanX = Math.max(8, count * 2.3);
    const spanY = Math.max(6, (layout.maxDepth + 1) * 2.6);
    const distance = Math.max(11, Math.min(48, Math.max(spanX * 0.72, spanY * 1.15)));

    gsap.to(camera.position, {
      x: 0,
      y: 0.4,
      z: distance,
      duration: 0.65,
      ease: 'power3.out',
    });

    if (controlsRef.current) {
      gsap.to(controlsRef.current.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.65,
        ease: 'power3.out',
        onUpdate: () => controlsRef.current?.update(),
      });
    }
  }, [resetNonce]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={4}
      maxDistance={90}
      maxPolarAngle={Math.PI * 0.85}
    />
  );
};

export const Tree3DCanvas: React.FC<Tree3DCanvasProps> = ({
  layout,
  visual,
  selectedNodeId,
  highlightedSearchPathOnly,
  playbackSpeed,
  cameraResetNonce,
  onSelectNode,
}) => {
  const isLargeTree = layout.totalVisibleNodes > 40;
  const animDuration = Math.max(0.2, 0.6 / playbackSpeed);

  const rootId = useMemo(
    () => layout.nodes.find((n) => n.depth === 0)?.node.id ?? null,
    [layout.nodes],
  );

  const visitedSet = useMemo(() => new Set(visual?.visitedNodeIds ?? []), [visual?.visitedNodeIds]);

  const affectedEdgeSet = useMemo(() => {
    const set = new Set<string>();
    for (const pair of visual?.affectedEdgePairs ?? []) {
      set.add(`${pair[0]}->${pair[1]}`);
      set.add(`${pair[1]}->${pair[0]}`);
    }
    return set;
  }, [visual?.affectedEdgePairs]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.5, 16], fov: 46, near: 0.1, far: 250 }}
        onPointerMissed={() => onSelectNode(null)}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#06070a']} />
        <fog attach="fog" args={['#06070a', 32, 95]} />

        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 18, 16]} intensity={1.35} color="#dbeafe" />
        <pointLight position={[-12, -8, 12]} intensity={0.8} color="#22d3ee" />
        <pointLight position={[12, 4, -8]} intensity={0.6} color="#3b82f6" />

        {/* Subtle warehouse floor reference grid */}
        <gridHelper args={[60, 30, '#1e3a5f', '#0f172a']} position={[0, -((layout.maxDepth + 2) * 1.3), 0]} />

        <CameraController layout={layout} resetNonce={cameraResetNonce} />

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
            <Edge3DConnector
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
          const palette = resolveNodePalette(id, rootId, visual, selectedNodeId);
          const isHighlighted =
            palette.tag !== null &&
            (visual?.activeNodeId === id ||
              visual?.unbalancedNodeId === id ||
              visual?.pivotNodeId === id ||
              visual?.predecessorId === id ||
              visual?.successorId === id ||
              visual?.mergedNodeId === id ||
              selectedNodeId === id);

          const isInPath =
            visitedSet.has(id) ||
            visual?.activeNodeId === id ||
            visual?.predecessorId === id ||
            visual?.successorId === id ||
            visual?.unbalancedNodeId === id ||
            visual?.pivotNodeId === id;

          const dimmed = highlightedSearchPathOnly && visitedSet.size > 0 && !isInPath;

          return (
            <Node3DMesh
              key={id}
              pNode={pNode}
              palette={palette}
              isHighlighted={isHighlighted}
              dimmed={dimmed}
              isLargeTree={isLargeTree}
              animDuration={animDuration}
              onSelect={() => onSelectNode(id)}
            />
          );
        })}
      </Canvas>

      {/* 3D Controls Hint */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-slate-800/80 bg-charcoal-950/85 px-3 py-1.5 font-mono text-[11px] text-slate-400 backdrop-blur">
        Drag: Orbit · Scroll: Zoom · Right-Drag: Pan · Click Node: Inspect
      </div>
    </div>
  );
};
