import { Billboard, Environment, Lightformer, OrbitControls, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { AvlNodeSnapshot, AvlTreeSnapshot, IntervalRange } from '../contracts/api'
import type { GraphicsCapabilities } from '../hooks/useGraphicsCapabilities'

export type AvlCameraPreset = 'front' | 'isometric' | 'top'

export type AnimationStageKind =
  | 'IDLE'
  | 'SEARCH_START'
  | 'TRAVERSAL'
  | 'MUTATE'
  | 'HEIGHT_UPDATE'
  | 'BALANCE_CALC'
  | 'IMBALANCE_DETECTED'
  | 'ROTATION_HALF'
  | 'ROTATION_COMPLETE'
  | 'FINAL_BALANCED'

export interface AvlTimelineStage {
  kind: AnimationStageKind
  title: string
  description: string
  snapshot: AvlTreeSnapshot
  activeNodeIds: Array<string | number>
  searchCursorId?: string | number | null
  searchVisitedIds: Array<string | number>
  imbalancedNodeId?: string | number | null
  rotationLabel?: string
}

const CAMERA_PRESETS: Record<
  AvlCameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  front: { pos: [0, 0.4, 13.5], target: [0, 0, 0] },
  isometric: { pos: [8.5, 4.8, 11.5], target: [0, -0.2, 0] },
  top: { pos: [0, 12.5, 4.2], target: [0, 0, 0] },
}

function computeTreeLayouts(
  snapshot: AvlTreeSnapshot | null,
): Map<string, { x: number; y: number; z: number; node: AvlNodeSnapshot }> {
  const map = new Map<string, { x: number; y: number; z: number; node: AvlNodeSnapshot }>()
  if (!snapshot || snapshot.nodes.length === 0) return map

  const sorted = [...snapshot.nodes].sort((a, b) => a.interval.start - b.interval.start)
  const n = sorted.length
  const maxDepth = Math.max(1, ...sorted.map((nd) => nd.depth ?? 0))
  const xSpacing = n <= 7 ? 2.5 : n <= 15 ? 1.85 : Math.max(1.1, 24 / n)
  const ySpacing = maxDepth <= 4 ? 1.95 : Math.max(1.3, 8.5 / maxDepth)

  sorted.forEach((node, rank) => {
    const centeredRank = rank - (n - 1) / 2
    const depth = node.depth ?? 0
    const x = centeredRank * xSpacing
    const y = (maxDepth / 2 - depth) * ySpacing
    const z = -Math.abs(centeredRank) * 0.16
    map.set(String(node.id), { x, y, z, node })
  })

  return map
}

function createNodeLabelTexture(
  node: AvlNodeSnapshot,
  accentColor: string,
  badgeText: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 440
  canvas.height = 176
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'rgba(7, 11, 18, 0.94)'
  ctx.fillRect(0, 0, 440, 176)

  ctx.strokeStyle = accentColor
  ctx.lineWidth = 5
  ctx.strokeRect(5, 5, 430, 166)

  ctx.fillStyle = '#7F8EA6'
  ctx.font = 'bold 24px monospace'
  ctx.fillText(`NODE #${node.id}`, 20, 38)

  ctx.fillStyle = Math.abs(node.balanceFactor) > 1 ? '#F59E0B' : accentColor
  ctx.font = 'bold 26px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`BF: ${node.balanceFactor >= 0 ? '+' : ''}${node.balanceFactor}`, 418, 38)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#F5F8FC'
  ctx.font = 'bold 46px monospace'
  ctx.fillText(`[${node.interval.start}, ${node.interval.end}]`, 20, 100)

  ctx.fillStyle = '#9BAAC0'
  ctx.font = '24px monospace'
  ctx.fillText(`H: ${node.height}`, 20, 148)

  if (badgeText) {
    ctx.fillStyle = accentColor
    ctx.font = 'bold 22px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(badgeText, 418, 148)
    ctx.textAlign = 'left'
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function AvlNodeMesh({
  node,
  targetPos,
  role,
  speedMultiplier,
  reducedMotion,
  isSelected,
  livePositionsRef,
  onSelect,
}: {
  node: AvlNodeSnapshot
  targetPos: [number, number, number]
  role: 'imbalance' | 'cursor' | 'active' | 'visited' | 'normal'
  speedMultiplier: number
  reducedMotion: boolean
  isSelected: boolean
  livePositionsRef: React.MutableRefObject<Map<string, THREE.Vector3>>
  onSelect?: (nodeId: string | number, interval: IntervalRange) => void
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const haloRef = useRef<THREE.Mesh | null>(null)
  const idKey = String(node.id)

  const accentColor =
    role === 'imbalance'
      ? '#F59E0B'
      : role === 'cursor'
        ? '#7CF9FF'
        : role === 'active'
          ? '#38E8FF'
          : role === 'visited'
            ? '#2E7BFF'
            : isSelected
              ? '#38E8FF'
              : '#5A78A8'

  const badgeText =
    role === 'imbalance'
      ? 'IMBALANCED'
      : role === 'cursor'
        ? 'SCANNING'
        : role === 'active'
          ? 'TARGET'
          : role === 'visited'
            ? 'PATH'
            : node.interval.zone ?? ''

  const labelTexture = useMemo(
    () => createNodeLabelTexture(node, accentColor, badgeText),
    [node, accentColor, badgeText],
  )

  useEffect(() => () => labelTexture.dispose(), [labelTexture])

  useEffect(() => {
    if (!livePositionsRef.current.has(idKey)) {
      livePositionsRef.current.set(idKey, new THREE.Vector3(...targetPos))
    }
  }, [idKey, targetPos, livePositionsRef])

  useFrame((state, delta) => {
    const current = livePositionsRef.current.get(idKey) ?? new THREE.Vector3(...targetPos)
    const target = new THREE.Vector3(...targetPos)

    if (reducedMotion) {
      current.copy(target)
    } else {
      const lerpAlpha = Math.min(1, delta * (5.2 * Math.max(0.4, speedMultiplier)))
      current.lerp(target, lerpAlpha)
    }
    livePositionsRef.current.set(idKey, current)

    if (groupRef.current) {
      groupRef.current.position.copy(current)
    }

    if (haloRef.current && !reducedMotion) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 5.0) * 0.08
      haloRef.current.scale.setScalar(pulse)
    }
  })

  const isHighlighted = role !== 'normal' || isSelected

  return (
    <group
      ref={groupRef}
      position={targetPos}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(node.id, node.interval)
      }}
    >
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[0.48, 2]} />
        <meshStandardMaterial
          color={role === 'imbalance' ? '#3B2308' : isHighlighted ? '#0E2447' : '#0D1420'}
          metalness={0.86}
          roughness={0.2}
          emissive={accentColor}
          emissiveIntensity={role === 'imbalance' ? 0.95 : role === 'cursor' || role === 'active' ? 0.72 : role === 'visited' ? 0.4 : 0.14}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.025, 12, 48]} />
        <meshBasicMaterial color={accentColor} transparent opacity={isHighlighted ? 0.95 : 0.45} />
      </mesh>

      {(role === 'imbalance' || role === 'cursor' || role === 'active') && (
        <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.82, 40]} />
          <meshBasicMaterial
            color={accentColor}
            transparent
            opacity={role === 'imbalance' ? 0.85 : 0.65}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <Billboard position={[0, 0.96, 0]} follow>
        <mesh>
          <planeGeometry args={[1.65, 0.66]} />
          <meshBasicMaterial map={labelTexture} transparent toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  )
}

function DynamicEdge({
  parentId,
  childId,
  highlighted,
  isImbalancedEdge,
  livePositionsRef,
}: {
  parentId: string
  childId: string
  highlighted: boolean
  isImbalancedEdge: boolean
  livePositionsRef: React.MutableRefObject<Map<string, THREE.Vector3>>
}) {
  const meshRef = useRef<THREE.Mesh | null>(null)
  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const dirVec = useMemo(() => new THREE.Vector3(), [])
  const midVec = useMemo(() => new THREE.Vector3(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])

  useFrame(() => {
    const p = livePositionsRef.current.get(parentId)
    const c = livePositionsRef.current.get(childId)
    if (!meshRef.current || !p || !c) return

    dirVec.subVectors(c, p)
    const dist = dirVec.length()
    if (dist < 0.001) return

    midVec.addVectors(p, c).multiplyScalar(0.5)
    meshRef.current.position.copy(midVec)
    meshRef.current.scale.set(1, dist, 1)
    quat.setFromUnitVectors(upVec, dirVec.normalize())
    meshRef.current.quaternion.copy(quat)
  })

  const color = isImbalancedEdge ? '#F59E0B' : highlighted ? '#38E8FF' : '#324666'

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[highlighted || isImbalancedEdge ? 0.042 : 0.024, highlighted || isImbalancedEdge ? 0.042 : 0.024, 1, 10]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={highlighted || isImbalancedEdge ? 0.92 : 0.55}
      />
    </mesh>
  )
}

function AvlCameraRig({
  preset,
  presetTrigger,
  zoomCommand,
  interactiveZoom,
  reducedMotion,
}: {
  preset: AvlCameraPreset
  presetTrigger: number
  zoomCommand: { dir: 'in' | 'out'; seq: number }
  interactiveZoom: boolean
  reducedMotion: boolean
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { camera } = useThree()
  const animGoal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)

  useEffect(() => {
    const cfg = CAMERA_PRESETS[preset]
    const posVec = new THREE.Vector3(...cfg.pos)
    const targetVec = new THREE.Vector3(...cfg.target)
    if (reducedMotion) {
      camera.position.copy(posVec)
      controlsRef.current?.target.copy(targetVec)
      controlsRef.current?.update()
      animGoal.current = null
    } else {
      animGoal.current = { pos: posVec, target: targetVec }
    }
  }, [preset, presetTrigger, camera, reducedMotion])

  useEffect(() => {
    if (zoomCommand.seq === 0 || !controlsRef.current) return
    const target = controlsRef.current.target
    const offset = camera.position.clone().sub(target)
    const factor = zoomCommand.dir === 'in' ? 0.82 : 1.22
    offset.multiplyScalar(factor)
    const clampedLen = THREE.MathUtils.clamp(offset.length(), 4.5, 34)
    offset.setLength(clampedLen)
    const nextPos = target.clone().add(offset)
    if (reducedMotion) {
      camera.position.copy(nextPos)
      controlsRef.current.update()
    } else {
      animGoal.current = { pos: nextPos, target: target.clone() }
    }
  }, [zoomCommand, camera, reducedMotion])

  useFrame((_, delta) => {
    if (!animGoal.current || !controlsRef.current) return
    const alpha = Math.min(1, delta * 5)
    camera.position.lerp(animGoal.current.pos, alpha)
    controlsRef.current.target.lerp(animGoal.current.target, alpha)
    controlsRef.current.update()
    if (camera.position.distanceTo(animGoal.current.pos) < 0.04) {
      animGoal.current = null
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.07}
      enableZoom={interactiveZoom}
      minDistance={4.5}
      maxDistance={34}
      maxPolarAngle={Math.PI * 0.88}
      onStart={() => {
        animGoal.current = null
      }}
    />
  )
}

function AvlSceneContent({
  stage,
  speedMultiplier,
  reducedMotion,
  particleCount,
  selectedNodeId,
  cameraPreset,
  presetTrigger,
  zoomCommand,
  interactiveZoom,
  onNodeSelect,
}: {
  stage: AvlTimelineStage | null
  speedMultiplier: number
  reducedMotion: boolean
  particleCount: number
  selectedNodeId: string | number | null
  cameraPreset: AvlCameraPreset
  presetTrigger: number
  zoomCommand: { dir: 'in' | 'out'; seq: number }
  interactiveZoom: boolean
  onNodeSelect?: (nodeId: string | number, interval: IntervalRange) => void
}) {
  const livePositionsRef = useRef<Map<string, THREE.Vector3>>(new Map())
  const snapshot = stage?.snapshot ?? null
  const layout = useMemo(() => computeTreeLayouts(snapshot), [snapshot])

  const visitedSet = useMemo(
    () => new Set((stage?.searchVisitedIds ?? []).map(String)),
    [stage],
  )
  const activeSet = useMemo(
    () => new Set((stage?.activeNodeIds ?? []).map(String)),
    [stage],
  )

  const edges = useMemo(() => {
    if (!snapshot) return [] as Array<{ parentId: string; childId: string; key: string }>
    const list: Array<{ parentId: string; childId: string; key: string }> = []
    for (const n of snapshot.nodes) {
      const pid = String(n.id)
      if (n.leftId !== null && n.leftId !== undefined) {
        const cid = String(n.leftId)
        if (layout.has(cid)) list.push({ parentId: pid, childId: cid, key: `${pid}-${cid}` })
      }
      if (n.rightId !== null && n.rightId !== undefined) {
        const cid = String(n.rightId)
        if (layout.has(cid)) list.push({ parentId: pid, childId: cid, key: `${pid}-${cid}` })
      }
    }
    return list
  }, [snapshot, layout])

  return (
    <>
      <color attach="background" args={['#05070B']} />
      <fog attach="fog" args={['#05070B', 16, 40]} />

      <ambientLight intensity={0.32} />
      <directionalLight position={[6, 10, 8]} intensity={2.0} color="#E6F0FF" />
      <pointLight position={[-6, 4, 6]} intensity={16} distance={20} color="#2E7BFF" />
      <pointLight position={[6, -3, 5]} intensity={14} distance={18} color="#38E8FF" />

      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.4} color="#DCEBFF" position={[0, 6, -4]} scale={[12, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={3.0} color="#2E7BFF" position={[-8, 1, 3]} scale={[4, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2.4} color="#38E8FF" position={[8, -2, 3]} scale={[4, 8, 1]} target={[0, 0, 0]} />
      </Environment>

      <AvlCameraRig
        preset={cameraPreset}
        presetTrigger={presetTrigger}
        zoomCommand={zoomCommand}
        interactiveZoom={interactiveZoom}
        reducedMotion={reducedMotion}
      />

      <gridHelper args={[32, 32, '#1E3A5F', '#0B1220']} position={[0, -5.2, 0]} />

      {edges.map((edge) => {
        const highlighted =
          (visitedSet.has(edge.parentId) && visitedSet.has(edge.childId)) ||
          (activeSet.has(edge.parentId) && activeSet.has(edge.childId))
        const isImb =
          stage?.imbalancedNodeId != null &&
          (String(stage.imbalancedNodeId) === edge.parentId ||
            String(stage.imbalancedNodeId) === edge.childId)
        return (
          <DynamicEdge
            key={edge.key}
            parentId={edge.parentId}
            childId={edge.childId}
            highlighted={highlighted}
            isImbalancedEdge={isImb}
            livePositionsRef={livePositionsRef}
          />
        )
      })}

      {snapshot?.nodes.map((node) => {
        const entry = layout.get(String(node.id))
        if (!entry) return null
        const idStr = String(node.id)

        let role: 'imbalance' | 'cursor' | 'active' | 'visited' | 'normal' = 'normal'
        if (stage?.imbalancedNodeId != null && String(stage.imbalancedNodeId) === idStr) {
          role = 'imbalance'
        } else if (stage?.searchCursorId != null && String(stage.searchCursorId) === idStr) {
          role = 'cursor'
        } else if (activeSet.has(idStr)) {
          role = 'active'
        } else if (visitedSet.has(idStr)) {
          role = 'visited'
        }

        return (
          <AvlNodeMesh
            key={idStr}
            node={node}
            targetPos={[entry.x, entry.y, entry.z]}
            role={role}
            speedMultiplier={speedMultiplier}
            reducedMotion={reducedMotion}
            isSelected={selectedNodeId != null && String(selectedNodeId) === idStr}
            livePositionsRef={livePositionsRef}
            onSelect={onNodeSelect}
          />
        )
      })}

      {particleCount > 0 && (
        <Sparkles
          count={Math.max(25, Math.floor(particleCount * 0.6))}
          scale={[18, 10, 8]}
          size={1.4}
          speed={0.22}
          opacity={0.35}
          color="#38E8FF"
        />
      )}
    </>
  )
}

export default function AvlTree3DCanvas({
  graphics,
  stage,
  speedMultiplier,
  selectedNodeId,
  cameraPreset,
  presetTrigger,
  zoomCommand,
  interactiveZoom,
  onNodeSelect,
}: {
  graphics: GraphicsCapabilities
  stage: AvlTimelineStage | null
  speedMultiplier: number
  selectedNodeId: string | number | null
  cameraPreset: AvlCameraPreset
  presetTrigger: number
  zoomCommand: { dir: 'in' | 'out'; seq: number }
  interactiveZoom: boolean
  onNodeSelect?: (nodeId: string | number, interval: IntervalRange) => void
}) {
  return (
    <Canvas
      dpr={graphics.dpr}
      camera={{ position: CAMERA_PRESETS.front.pos, fov: 44 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      className="h-full w-full"
    >
      <AvlSceneContent
        stage={stage}
        speedMultiplier={speedMultiplier}
        reducedMotion={graphics.prefersReducedMotion}
        particleCount={graphics.particleCount}
        selectedNodeId={selectedNodeId}
        cameraPreset={cameraPreset}
        presetTrigger={presetTrigger}
        zoomCommand={zoomCommand}
        interactiveZoom={interactiveZoom}
        onNodeSelect={onNodeSelect}
      />
    </Canvas>
  )
}
