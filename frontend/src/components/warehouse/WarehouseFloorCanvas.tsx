import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls, Sparkles } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { IntervalMutationType, IntervalRange } from '../../contracts/api'
import type { GraphicsCapabilities } from '../../hooks/useGraphicsCapabilities'
import type { ActivePackageAnimation } from '../../state/useRangeX'

export type WarehouseCameraPreset = 'overview' | 'scanner' | 'racks' | 'intake'

interface BayCoordinate {
  code: string
  position: [number, number, number]
  shelfY: number
}

const BAY_COORDINATES: BayCoordinate[] = [
  { code: 'BAY-A1', position: [-4.6, 0, -2.5], shelfY: 1.35 },
  { code: 'BAY-A2', position: [0.0, 0, -2.5], shelfY: 1.35 },
  { code: 'BAY-A3', position: [4.6, 0, -2.5], shelfY: 1.35 },
  { code: 'BAY-B1', position: [-4.6, 0, -5.6], shelfY: 2.35 },
  { code: 'BAY-B2', position: [0.0, 0, -5.6], shelfY: 2.35 },
  { code: 'BAY-B3', position: [4.6, 0, -5.6], shelfY: 2.35 },
]

const CAMERA_PRESETS: Record<
  WarehouseCameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  overview: { pos: [7.8, 5.4, 8.6], target: [0.0, 1.1, -1.2] },
  scanner: { pos: [-1.4, 2.7, 5.2], target: [-1.35, 1.3, 1.35] },
  racks: { pos: [0.2, 4.3, 3.6], target: [0.0, 1.6, -3.8] },
  intake: { pos: [-8.2, 3.1, 4.9], target: [-4.4, 1.0, 1.35] },
}

function getMutationColor(type: IntervalMutationType | undefined): string {
  switch (type) {
    case 'CREATED':
      return '#38E8FF'
    case 'EXTENDED':
      return '#2E7BFF'
    case 'MERGED':
      return '#7CF9FF'
    case 'DUPLICATE':
      return '#F59E0B'
    default:
      return '#38E8FF'
  }
}

function createEpoxyFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#070A10'
  ctx.fillRect(0, 0, 1024, 1024)

  // Subtle concrete micro-grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
  ctx.lineWidth = 2
  const step = 64
  for (let i = 0; i <= 1024; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, 1024)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(1024, i)
    ctx.stroke()
  }

  // Precision calibration crosshairs
  ctx.strokeStyle = 'rgba(56, 232, 255, 0.22)'
  ctx.lineWidth = 2
  for (let x = 128; x < 1024; x += 256) {
    for (let y = 128; y < 1024; y += 256) {
      ctx.beginPath()
      ctx.moveTo(x - 10, y)
      ctx.lineTo(x + 10, y)
      ctx.moveTo(x, y - 10)
      ctx.lineTo(x, y + 10)
      ctx.stroke()
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  texture.anisotropy = 4
  return texture
}

function createBeltChevronTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0B0F17'
  ctx.fillRect(0, 0, 256, 128)

  // Raised rubber chevrons
  ctx.strokeStyle = '#1E293B'
  ctx.lineWidth = 10
  for (let x = -64; x < 320; x += 42) {
    ctx.beginPath()
    ctx.moveTo(x, 12)
    ctx.lineTo(x + 28, 64)
    ctx.lineTo(x, 116)
    ctx.stroke()
  }

  // Cyan guide edge lines
  ctx.fillStyle = 'rgba(56, 232, 255, 0.38)'
  ctx.fillRect(0, 4, 256, 3)
  ctx.fillRect(0, 121, 256, 3)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(14, 1)
  return texture
}

function createPlateTexture(title: string, subtitle: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#070B12'
  ctx.fillRect(0, 0, 512, 160)

  ctx.strokeStyle = accent
  ctx.lineWidth = 4
  ctx.strokeRect(6, 6, 500, 148)

  ctx.fillStyle = accent
  ctx.fillRect(18, 22, 8, 116)

  ctx.fillStyle = '#F5F8FC'
  ctx.font = 'bold 46px monospace'
  ctx.fillText(title, 44, 72)

  ctx.fillStyle = '#8EA0BA'
  ctx.font = '26px monospace'
  ctx.fillText(subtitle, 44, 120)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function DynamicSignPlate({
  title,
  subtitle,
  accent,
  position,
  scale = [1.5, 0.46, 1],
}: {
  title: string
  subtitle: string
  accent: string
  position: [number, number, number]
  scale?: [number, number, number]
}) {
  const texture = useMemo(
    () => createPlateTexture(title, subtitle, accent),
    [title, subtitle, accent],
  )

  useEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function ConveyorAssembly({
  activeAnimation,
  reducedMotion,
}: {
  activeAnimation: ActivePackageAnimation | null
  reducedMotion: boolean
}) {
  const beltTexture = useMemo(() => createBeltChevronTexture(), [])
  const beltMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const rollersRef = useRef<THREE.InstancedMesh | null>(null)
  const scannerBeamRef = useRef<THREE.Mesh | null>(null)
  const diverterRef = useRef<THREE.Group | null>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const rollerCount = 24
  const rollerSpacing = 0.56
  const beltStartX = -7.2

  useEffect(() => {
    return () => {
      beltTexture.dispose()
    }
  }, [beltTexture])

  useFrame((state, delta) => {
    const isMoving = Boolean(activeAnimation) && !reducedMotion
    const speed = isMoving ? 2.4 : reducedMotion ? 0 : 0.45

    if (beltMatRef.current?.map) {
      beltMatRef.current.map.offset.x -= delta * speed * 0.45
    }

    if (rollersRef.current) {
      const spin = state.clock.elapsedTime * (isMoving ? 6.5 : 1.4)
      for (let i = 0; i < rollerCount; i++) {
        dummy.position.set(beltStartX + i * rollerSpacing, 0.86, 1.35)
        dummy.rotation.set(Math.PI / 2, 0, reducedMotion ? 0 : spin)
        dummy.updateMatrix()
        rollersRef.current.setMatrixAt(i, dummy.matrix)
      }
      rollersRef.current.instanceMatrix.needsUpdate = true
    }

    if (scannerBeamRef.current && !reducedMotion) {
      const t = state.clock.elapsedTime
      scannerBeamRef.current.scale.y = 0.92 + Math.sin(t * 7) * 0.08
    }

    if (diverterRef.current) {
      let targetAngle = 0
      if (activeAnimation) {
        const idx = Math.abs(activeAnimation.targetInterval.start) % BAY_COORDINATES.length
        const bay = BAY_COORDINATES[idx]
        targetAngle = bay.position[0] < 0 ? 0.55 : bay.position[0] > 0 ? -0.45 : 0.12
      }
      diverterRef.current.rotation.y = THREE.MathUtils.lerp(
        diverterRef.current.rotation.y,
        targetAngle,
        Math.min(1, delta * 5),
      )
    }
  })

  const scanColor = getMutationColor(activeAnimation?.mutationType)
  const scanIntensity = activeAnimation ? 0.92 : 0.35

  return (
    <group>
      {/* Main Conveyor Steel Side Rails */}
      {[0.72, 1.98].map((zPos, i) => (
        <mesh key={i} position={[-0.75, 0.92, zPos]} castShadow receiveShadow>
          <boxGeometry args={[13.6, 0.2, 0.08]} />
          <meshStandardMaterial color="#8A99B0" metalness={0.88} roughness={0.25} />
        </mesh>
      ))}

      {/* Support Legs */}
      {[-6.8, -3.8, -0.8, 2.2, 5.2].map((xPos, idx) => (
        <group key={idx} position={[xPos, 0.44, 1.35]}>
          <mesh position={[0, 0, -0.6]}>
            <boxGeometry args={[0.1, 0.88, 0.1]} />
            <meshStandardMaterial color="#1B2434" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.6]}>
            <boxGeometry args={[0.1, 0.88, 0.1]} />
            <meshStandardMaterial color="#1B2434" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.35, 0]}>
            <boxGeometry args={[0.12, 0.06, 1.32]} />
            <meshStandardMaterial color="#273347" metalness={0.82} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Animated Chevron Belt Deck */}
      <mesh position={[-0.75, 0.91, 1.35]} receiveShadow>
        <boxGeometry args={[13.3, 0.04, 1.14]} />
        <meshStandardMaterial ref={beltMatRef} map={beltTexture} roughness={0.55} metalness={0.25} />
      </mesh>

      {/* Instanced Steel Rollers */}
      <instancedMesh ref={rollersRef} args={[undefined, undefined, rollerCount]}>
        <cylinderGeometry args={[0.04, 0.04, 1.16, 12]} />
        <meshStandardMaterial color="#C8D3E3" metalness={0.92} roughness={0.18} />
      </instancedMesh>

      {/* Intake Dock Apron */}
      <mesh position={[-7.65, 0.52, 1.35]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.96, 1.65]} />
        <meshStandardMaterial color="#101723" metalness={0.82} roughness={0.32} />
      </mesh>
      <mesh position={[-7.65, 1.02, 1.35]}>
        <boxGeometry args={[0.75, 0.04, 1.4]} />
        <meshBasicMaterial color="#2E7BFF" transparent opacity={0.45} />
      </mesh>

      {/* Optical Laser Scanner Portal Gate */}
      <group position={[-1.4, 0, 1.35]}>
        <mesh position={[0, 1.45, -0.82]} castShadow>
          <boxGeometry args={[0.38, 2.9, 0.22]} />
          <meshStandardMaterial color="#121925" metalness={0.88} roughness={0.24} />
        </mesh>
        <mesh position={[0, 1.45, 0.82]} castShadow>
          <boxGeometry args={[0.38, 2.9, 0.22]} />
          <meshStandardMaterial color="#121925" metalness={0.88} roughness={0.24} />
        </mesh>
        <mesh position={[0, 2.82, 0]} castShadow>
          <boxGeometry args={[0.48, 0.28, 1.92]} />
          <meshStandardMaterial color="#1D283A" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Top Scanner Sign Plate */}
        <DynamicSignPlate
          title={activeAnimation ? `PKG #${activeAnimation.packageId}` : 'SCAN GATE 01'}
          subtitle={activeAnimation ? activeAnimation.mutationType : 'OPTICAL INDEXING'}
          accent={scanColor}
          position={[0.25, 2.82, 0]}
          scale={[1.45, 0.42, 1]}
        />
        {/* Active Cyan / Blue Laser Curtain */}
        <mesh ref={scannerBeamRef} position={[0, 1.8, 0]}>
          <planeGeometry args={[0.04, 1.75]} />
          <meshBasicMaterial
            color={scanColor}
            transparent
            opacity={scanIntensity}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 1.8, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.42, 1.75]} />
          <meshBasicMaterial
            color={scanColor}
            transparent
            opacity={activeAnimation ? 0.26 : 0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
        <pointLight
          position={[0, 2.45, 0]}
          color={scanColor}
          intensity={activeAnimation ? 18 : 5}
          distance={6}
        />
      </group>

      {/* Automated Diverter Paddle */}
      <group ref={diverterRef} position={[3.8, 1.05, 1.35]}>
        <mesh position={[0.45, 0, 0]}>
          <boxGeometry args={[0.95, 0.14, 0.08]} />
          <meshStandardMaterial
            color="#C8D3E3"
            metalness={0.95}
            roughness={0.18}
            emissive="#2E7BFF"
            emissiveIntensity={activeAnimation ? 0.5 : 0.1}
          />
        </mesh>
      </group>
    </group>
  )
}

function StorageRackBay({
  bay,
  interval,
  isSelected,
  isTarget,
  onSelect,
}: {
  bay: BayCoordinate
  interval: IntervalRange | undefined
  isSelected: boolean
  isTarget: boolean
  onSelect: (interval: IntervalRange) => void
}) {
  const [bx, , bz] = bay.position
  const highlightColor = isTarget ? '#38E8FF' : isSelected ? '#2E7BFF' : '#334155'
  const crateCount = interval
    ? Math.min(6, Math.max(1, interval.packageCount ?? interval.end - interval.start + 1))
    : 0

  return (
    <group
      position={[bx, 0, bz]}
      onClick={(e) => {
        if (interval) {
          e.stopPropagation()
          onSelect(interval)
        }
      }}
    >
      {/* 4 Slotted Vertical Steel Uprights */}
      {[
        [-1.45, -0.68],
        [1.45, -0.68],
        [-1.45, 0.68],
        [1.45, 0.68],
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, 1.75, pz]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 3.5, 0.1]} />
          <meshStandardMaterial color="#1A2434" metalness={0.86} roughness={0.28} />
        </mesh>
      ))}

      {/* 3 Horizontal Shelf Decks & Load Beams */}
      {[0.45, 1.55, 2.65].map((yPos, idx) => (
        <group key={idx} position={[0, yPos, 0]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[3.0, 0.07, 1.44]} />
            <meshStandardMaterial color="#0F1521" metalness={0.82} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.73]}>
            <boxGeometry args={[2.95, 0.04, 0.03]} />
            <meshStandardMaterial
              color={idx === 1 && (isSelected || isTarget) ? highlightColor : '#475569'}
              emissive={isSelected || isTarget ? highlightColor : '#000000'}
              emissiveIntensity={isTarget ? 1.4 : isSelected ? 0.8 : 0}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* Bay Header Address Plate */}
      <DynamicSignPlate
        title={interval ? `[${interval.start}, ${interval.end}]` : bay.code}
        subtitle={interval ? `${bay.code} // ${crateCount} UNITS` : 'IDLE BAY'}
        accent={isTarget || isSelected ? '#38E8FF' : '#2E7BFF'}
        position={[0, 3.22, 0.72]}
        scale={[1.85, 0.5, 1]}
      />

      {/* Floor Selection / Arrival Beacon */}
      {(isSelected || isTarget) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.55, 1.72, 32]} />
          <meshBasicMaterial color={highlightColor} transparent opacity={0.75} />
        </mesh>
      )}

      {/* Dynamic Stacked Metallic Interval Crates */}
      {Array.from({ length: crateCount }).map((_, idx) => {
        const col = idx % 3
        const row = Math.floor(idx / 3)
        const cx = (col - 1) * 0.85
        const cy = 0.78 + row * 1.1
        return (
          <group key={idx} position={[cx, cy, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.66, 0.52, 0.92]} />
              <meshStandardMaterial
                color={isTarget ? '#1B3A63' : '#162032'}
                metalness={0.85}
                roughness={0.24}
              />
            </mesh>
            <mesh position={[0, 0.27, 0]}>
              <boxGeometry args={[0.5, 0.025, 0.7]} />
              <meshBasicMaterial color={isTarget ? '#38E8FF' : '#2E7BFF'} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function AnimatedArrivalCrate({
  animation,
  reducedMotion,
  onComplete,
}: {
  animation: ActivePackageAnimation
  reducedMotion: boolean
  onComplete: (eventId: string) => void
}) {
  const crateRef = useRef<THREE.Group | null>(null)
  const mergePulseRef = useRef<THREE.Mesh | null>(null)
  const completedRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)

  const targetBayIdx = Math.abs(animation.targetInterval.start) % BAY_COORDINATES.length
  const targetBay = BAY_COORDINATES[targetBayIdx]
  const accent = getMutationColor(animation.mutationType)

  useEffect(() => {
    completedRef.current = false
    startTimeRef.current = null
  }, [animation.eventId])

  useFrame((state) => {
    if (!crateRef.current) return
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime
    }

    const duration = reducedMotion ? 0.9 : 3.4
    const elapsed = state.clock.elapsedTime - startTimeRef.current
    const progress = Math.min(1, elapsed / duration)

    if (progress < 0.56) {
      // Phase 1 & 2: Travel along main conveyor through Laser Scanner Gate
      const localT = progress / 0.56
      const x = THREE.MathUtils.lerp(-7.1, 3.6, localT)
      crateRef.current.position.set(x, 1.24, 1.35)
      crateRef.current.rotation.y = 0
    } else if (progress < 0.86) {
      // Phase 3: Divert toward target rack bay
      const localT = (progress - 0.56) / 0.3
      const eased = localT * localT * (3 - 2 * localT)
      const x = THREE.MathUtils.lerp(3.6, targetBay.position[0], eased)
      const z = THREE.MathUtils.lerp(1.35, targetBay.position[2] + 0.9, eased)
      const y = THREE.MathUtils.lerp(1.24, targetBay.shelfY + 0.35, eased)
      crateRef.current.position.set(x, y, z)
      crateRef.current.rotation.y = Math.sin(eased * Math.PI) * 0.35
    } else {
      // Phase 4: Seat neatly inside bay
      const localT = (progress - 0.86) / 0.14
      const z = THREE.MathUtils.lerp(targetBay.position[2] + 0.9, targetBay.position[2], localT)
      const y = THREE.MathUtils.lerp(targetBay.shelfY + 0.35, targetBay.shelfY - 0.5, localT)
      crateRef.current.position.set(targetBay.position[0], y, z)
      crateRef.current.rotation.y = 0
    }

    if (mergePulseRef.current && animation.mutationType === 'MERGED') {
      const mergeVisible = progress > 0.52
      mergePulseRef.current.visible = mergeVisible
      if (mergeVisible) {
        const s = 1 + (progress - 0.52) * 8
        mergePulseRef.current.scale.set(s, s, 1)
      }
    }

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true
      onComplete(animation.eventId)
    }
  })

  return (
    <group>
      <group ref={crateRef} position={[-7.1, 1.24, 1.35]}>
        <mesh castShadow>
          <boxGeometry args={[0.78, 0.58, 0.78]} />
          <meshStandardMaterial color="#182438" metalness={0.88} roughness={0.2} />
        </mesh>
        {/* Metallic Edge Frame */}
        <mesh>
          <boxGeometry args={[0.81, 0.12, 0.81]} />
          <meshStandardMaterial color="#C8D3E3" metalness={0.94} roughness={0.15} />
        </mesh>
        {/* Glowing Top Beacon */}
        <mesh position={[0, 0.31, 0]}>
          <boxGeometry args={[0.48, 0.04, 0.48]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        <pointLight position={[0, 0.6, 0]} color={accent} intensity={12} distance={4.5} />
      </group>

      {animation.mutationType === 'MERGED' && (
        <mesh
          ref={mergePulseRef}
          visible={false}
          position={[targetBay.position[0], 0.08, targetBay.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.45, 0.58, 40]} />
          <meshBasicMaterial color="#7CF9FF" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  )
}

function WarehouseSceneContent({
  graphics,
  intervals,
  selectedIntervalId,
  activeAnimation,
  cameraPreset,
  presetTrigger,
  interactiveZoom,
  onSelectInterval,
  onAnimationComplete,
}: {
  graphics: GraphicsCapabilities
  intervals: IntervalRange[]
  selectedIntervalId: string | null
  activeAnimation: ActivePackageAnimation | null
  cameraPreset: WarehouseCameraPreset
  presetTrigger: number
  interactiveZoom: boolean
  onSelectInterval: (interval: IntervalRange) => void
  onAnimationComplete: (eventId: string) => void
}) {
  const floorTexture = useMemo(() => createEpoxyFloorTexture(), [])
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const isAnimatingCameraRef = useRef(false)
  const targetPosRef = useRef(new THREE.Vector3(...CAMERA_PRESETS.overview.pos))
  const targetLookRef = useRef(new THREE.Vector3(...CAMERA_PRESETS.overview.target))

  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraPreset]
    targetPosRef.current.set(...preset.pos)
    targetLookRef.current.set(...preset.target)
    isAnimatingCameraRef.current = true
  }, [cameraPreset, presetTrigger])

  useEffect(() => {
    return () => {
      floorTexture.dispose()
    }
  }, [floorTexture])

  useFrame((state, delta) => {
    if (isAnimatingCameraRef.current && controlsRef.current) {
      const step = Math.min(1, delta * 3.5)
      state.camera.position.lerp(targetPosRef.current, step)
      controlsRef.current.target.lerp(targetLookRef.current, step)
      controlsRef.current.update()

      if (
        state.camera.position.distanceTo(targetPosRef.current) < 0.05 &&
        controlsRef.current.target.distanceTo(targetLookRef.current) < 0.05
      ) {
        isAnimatingCameraRef.current = false
      }
    }
  })

  return (
    <>
      <color attach="background" args={['#05070B']} />
      <fog attach="fog" args={['#05070B', 11, 28]} />

      <ambientLight intensity={0.28} />
      <directionalLight position={[8, 12, 7]} intensity={1.7} color="#E6F0FF" castShadow />
      <pointLight position={[-6, 5.5, 2]} intensity={20} distance={16} color="#2E7BFF" />
      <pointLight position={[6, 5.5, -4]} intensity={18} distance={16} color="#38E8FF" />

      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#DCEBFF"
          position={[0, 8, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[16, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.8}
          color="#2E7BFF"
          position={[-8, 3, 2]}
          scale={[4, 10, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2.0}
          color="#38E8FF"
          position={[8, 3, -3]}
          scale={[4, 10, 1]}
          target={[0, 1, 0]}
        />
      </Environment>

      {/* Industrial Epoxy Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.2]} receiveShadow>
        <planeGeometry args={[28, 22]} />
        {graphics.enableReflections ? (
          <MeshReflectorMaterial
            blur={[260, 80]}
            resolution={512}
            mixBlur={0.9}
            mixStrength={22}
            roughness={0.55}
            depthScale={1.0}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#0A0E17"
            metalness={0.65}
            map={floorTexture}
            mirror={0.35}
          />
        ) : (
          <meshStandardMaterial map={floorTexture} color="#0D121D" metalness={0.6} roughness={0.45} />
        )}
      </mesh>

      {/* Overhead High-Bay Steel Trusses & Industrial Luminaires */}
      {[-5.5, 0, 5.5].map((xPos, idx) => (
        <group key={idx} position={[xPos, 5.4, -1.2]}>
          <mesh>
            <boxGeometry args={[0.18, 0.24, 14.5]} />
            <meshStandardMaterial color="#151D2B" metalness={0.88} roughness={0.28} />
          </mesh>
          <mesh position={[0, -0.15, -1.6]}>
            <boxGeometry args={[0.42, 0.05, 2.2]} />
            <meshBasicMaterial color={idx === 1 ? '#38E8FF' : '#9CC4FF'} />
          </mesh>
        </group>
      ))}

      <ConveyorAssembly
        activeAnimation={activeAnimation}
        reducedMotion={graphics.prefersReducedMotion}
      />

      {/* 6 Dynamic Storage Rack Bays */}
      {BAY_COORDINATES.map((bay, idx) => {
        const interval = intervals[idx]
        const intervalId = interval ? (interval.id ?? `${interval.start}-${interval.end}`) : null
        const isSelected = Boolean(intervalId && selectedIntervalId === intervalId)
        const targetBayIdx = activeAnimation
          ? Math.abs(activeAnimation.targetInterval.start) % BAY_COORDINATES.length
          : -1
        const isTarget = idx === targetBayIdx

        return (
          <StorageRackBay
            key={bay.code}
            bay={bay}
            interval={interval}
            isSelected={isSelected}
            isTarget={isTarget}
            onSelect={onSelectInterval}
          />
        )
      })}

      {/* Confirmed Backend Arrival Cargo Crate */}
      {activeAnimation && (
        <AnimatedArrivalCrate
          animation={activeAnimation}
          reducedMotion={graphics.prefersReducedMotion}
          onComplete={onAnimationComplete}
        />
      )}

      {graphics.particleCount > 0 && (
        <Sparkles
          count={Math.floor(graphics.particleCount * 0.65)}
          scale={[16, 5, 11]}
          position={[0, 2.6, -1.2]}
          size={1.2}
          speed={0.18}
          opacity={0.3}
          color="#38E8FF"
        />
      )}

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.07}
        enableZoom={interactiveZoom}
        minDistance={4.5}
        maxDistance={17}
        maxPolarAngle={Math.PI / 2 - 0.08}
        minPolarAngle={0.25}
        onStart={() => {
          isAnimatingCameraRef.current = false
        }}
      />
    </>
  )
}

export default function WarehouseFloorCanvas({
  graphics,
  intervals,
  selectedIntervalId,
  activeAnimation,
  cameraPreset,
  presetTrigger,
  interactiveZoom,
  onSelectInterval,
  onAnimationComplete,
}: {
  graphics: GraphicsCapabilities
  intervals: IntervalRange[]
  selectedIntervalId: string | null
  activeAnimation: ActivePackageAnimation | null
  cameraPreset: WarehouseCameraPreset
  presetTrigger: number
  interactiveZoom: boolean
  onSelectInterval: (interval: IntervalRange) => void
  onAnimationComplete: (eventId: string) => void
}) {
  const [contextLost, setContextLost] = useState(false)

  if (contextLost) {
    return (
      <div className="flex h-full items-center justify-center bg-[#070A10] p-8 text-center">
        <p className="font-mono-tech text-xs text-[#9BAAC0]">
          WebGL context paused by browser. Switch GPU mode to 2D Safe or refresh to restore 3D floor.
        </p>
      </div>
    )
  }

  return (
    <Canvas
      shadows
      dpr={graphics.dpr}
      camera={{ position: CAMERA_PRESETS.overview.pos, fov: 44 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          setContextLost(true)
        })
      }}
      className="h-full w-full"
    >
      <WarehouseSceneContent
        graphics={graphics}
        intervals={intervals}
        selectedIntervalId={selectedIntervalId}
        activeAnimation={activeAnimation}
        cameraPreset={cameraPreset}
        presetTrigger={presetTrigger}
        interactiveZoom={interactiveZoom}
        onSelectInterval={onSelectInterval}
        onAnimationComplete={onAnimationComplete}
      />
    </Canvas>
  )
}
