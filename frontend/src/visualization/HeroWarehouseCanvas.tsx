import { Environment, Lightformer, MeshReflectorMaterial, Sparkles } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { GraphicsCapabilities } from '../hooks/useGraphicsCapabilities'

interface HeroPackageSpec {
  id: number
  label: string
  offset: number
  laneZ: number
  color: string
}

const CONVEYOR_PACKAGES: HeroPackageSpec[] = [
  { id: 101, label: 'PKG #101', offset: 0.0, laneZ: 0.0, color: '#38E8FF' },
  { id: 102, label: 'PKG #102', offset: 0.2, laneZ: 0.04, color: '#2E7BFF' },
  { id: 104, label: 'PKG #104 [MERGE]', offset: 0.42, laneZ: -0.04, color: '#7CF9FF' },
  { id: 208, label: 'PKG #208', offset: 0.65, laneZ: 0.04, color: '#2E7BFF' },
  { id: 512, label: 'PKG #512', offset: 0.84, laneZ: -0.02, color: '#38E8FF' },
]

function createTagTexture(text: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 96
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'rgba(7, 11, 18, 0.94)'
  ctx.fillRect(0, 0, 384, 96)

  ctx.strokeStyle = accent
  ctx.lineWidth = 4
  ctx.strokeRect(4, 4, 376, 88)

  ctx.fillStyle = accent
  ctx.fillRect(14, 18, 8, 60)

  ctx.fillStyle = '#F5F8FC'
  ctx.font = 'bold 28px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 34, 50)

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function createBeltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0A0E17'
  ctx.fillRect(0, 0, 256, 128)

  ctx.strokeStyle = '#1E293B'
  ctx.lineWidth = 10
  for (let x = -64; x < 320; x += 44) {
    ctx.beginPath()
    ctx.moveTo(x, 14)
    ctx.lineTo(x + 26, 64)
    ctx.lineTo(x, 114)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(56, 232, 255, 0.48)'
  ctx.fillRect(0, 4, 256, 3)
  ctx.fillRect(0, 121, 256, 3)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(14, 1)
  return tex
}

function FloatingIdTag({ text, accent, position }: { text: string; accent: string; position: [number, number, number] }) {
  const tex = useMemo(() => createTagTexture(text, accent), [text, accent])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={position}>
      <planeGeometry args={[1.18, 0.3]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function MovingPackage({
  spec,
  reducedMotion,
  selectedId,
  onSelect,
}: {
  spec: HeroPackageSpec
  reducedMotion: boolean
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const isSelected = selectedId === spec.id

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    const progress = reducedMotion ? spec.offset : (spec.offset + t * 0.08) % 1
    const x = -5.8 + progress * 12.6
    const bob = reducedMotion ? 0 : Math.sin(t * 2.4 + spec.id) * 0.025
    groupRef.current.position.set(x, 0.34 + bob, spec.laneZ)

    const nearScanner = Math.abs(x - 1.4) < 0.75
    const s = isSelected ? 1.15 : nearScanner ? 1.07 : 1.0
    groupRef.current.scale.setScalar(s)
  })

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(spec.id)
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.42, 0.48]} />
        <meshStandardMaterial
          color={isSelected ? '#172E52' : '#111826'}
          metalness={0.86}
          roughness={0.22}
          emissive={spec.color}
          emissiveIntensity={isSelected ? 0.55 : 0.14}
        />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.52, 0.025, 0.44]} />
        <meshBasicMaterial color={spec.color} />
      </mesh>
      <FloatingIdTag text={spec.label} accent={spec.color} position={[0, 0.54, 0]} />
    </group>
  )
}

function KineticWarehouseHeroScene({
  reducedMotion,
  particleCount,
  enableReflections,
}: {
  reducedMotion: boolean
  particleCount: number
  enableReflections: boolean
}) {
  const [selectedId, setSelectedId] = useState<number | null>(104)
  const monolithRef = useRef<THREE.Group | null>(null)
  const outerRingRef = useRef<THREE.Mesh | null>(null)
  const scanBeamRef = useRef<THREE.Mesh | null>(null)
  const beltMatRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const beltTexture = useMemo(() => createBeltTexture(), [])

  useEffect(() => () => beltTexture.dispose(), [beltTexture])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const px = state.pointer.x
    const py = state.pointer.y

    if (beltMatRef.current?.map && !reducedMotion) {
      beltMatRef.current.map.offset.x -= delta * 0.55
    }

    if (monolithRef.current) {
      const targetY = px * 0.22 + (reducedMotion ? 0 : Math.sin(t * 0.35) * 0.1)
      const targetX = -py * 0.1
      monolithRef.current.rotation.y = THREE.MathUtils.lerp(
        monolithRef.current.rotation.y,
        targetY,
        Math.min(1, delta * 3),
      )
      monolithRef.current.rotation.x = THREE.MathUtils.lerp(
        monolithRef.current.rotation.x,
        targetX,
        Math.min(1, delta * 3),
      )
    }

    if (!reducedMotion) {
      if (outerRingRef.current) {
        outerRingRef.current.rotation.z += delta * 0.22
      }
      if (scanBeamRef.current) {
        scanBeamRef.current.position.y = 0.75 + Math.sin(t * 1.45) * 0.55
      }
    }

    // Offset camera leftwards looking rightwards so 3D warehouse composition sits cleanly to the right of left-aligned hero copy
    const targetCamX = -1.6 + px * 0.55
    const targetCamY = 2.35 + py * 0.3
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetCamX, 0.04)
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetCamY, 0.04)
    state.camera.lookAt(1.8, 0.3, -0.3)
  })

  return (
    <>
      <color attach="background" args={['#05070B']} />
      <fog attach="fog" args={['#05070B', 8.5, 22]} />

      <ambientLight intensity={0.28} />
      <directionalLight position={[7, 9, 6]} intensity={2.0} color="#E6F0FF" />
      <pointLight position={[0.5, 2.8, 3.0]} intensity={18} distance={15} color="#2E7BFF" />
      <pointLight position={[5.2, 1.5, 2.8]} intensity={16} distance={14} color="#38E8FF" />
      <spotLight position={[2.6, 6.2, 2.2]} angle={0.5} penumbra={0.8} intensity={45} color="#D8EEFF" />

      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.6} color="#DCEBFF" position={[2, 5, -3]} scale={[12, 2, 1]} target={[2, 0, 0]} />
        <Lightformer form="rect" intensity={3.2} color="#2E7BFF" position={[-4, 1, 2]} scale={[4, 8, 1]} target={[2, 0, 0]} />
        <Lightformer form="rect" intensity={2.5} color="#38E8FF" position={[8, -1, 2]} scale={[3, 6, 1]} target={[2, 0, 0]} />
      </Environment>

      {/* Reflective Dark Epoxy Warehouse Floor */}
      <mesh position={[1.5, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[34, 34]} />
        {enableReflections ? (
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={512}
            mixBlur={0.9}
            mixStrength={22}
            roughness={0.38}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.3}
            color="#060910"
            metalness={0.65}
            mirror={0.42}
          />
        ) : (
          <meshStandardMaterial color="#070A10" roughness={0.5} metalness={0.6} />
        )}
      </mesh>
      <gridHelper args={[30, 34, '#2E7BFF', '#0F172A']} position={[1.5, -0.94, 0]} />

      {/* Main Warehouse Conveyor Line */}
      <group position={[2.1, -0.32, 0.3]}>
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[14.2, 0.08, 1.15]} />
          <meshStandardMaterial ref={beltMatRef} map={beltTexture} roughness={0.5} metalness={0.28} />
        </mesh>
        {[-0.64, 0.64].map((zOff, idx) => (
          <mesh key={idx} position={[0, 0.14, zOff]} castShadow>
            <boxGeometry args={[14.4, 0.16, 0.07]} />
            <meshStandardMaterial color="#8A99B0" metalness={0.9} roughness={0.22} />
          </mesh>
        ))}
        {[-5.5, -2.5, 0.5, 3.5, 6.2].map((xPos, idx) => (
          <mesh key={idx} position={[xPos, -0.32, 0]}>
            <boxGeometry args={[0.14, 0.65, 1.18]} />
            <meshStandardMaterial color="#151E2E" metalness={0.82} roughness={0.32} />
          </mesh>
        ))}

        {CONVEYOR_PACKAGES.map((pkg) => (
          <MovingPackage
            key={pkg.id}
            spec={pkg}
            reducedMotion={reducedMotion}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </group>

      {/* Optical Scanner Gate & Kinetic AVL Index Monolith */}
      <group ref={monolithRef} position={[3.2, 0.45, -0.45]}>
        {[-0.95, 0.95].map((zPos, idx) => (
          <mesh key={idx} position={[0, 0.15, zPos]} castShadow>
            <boxGeometry args={[0.26, 2.7, 0.2]} />
            <meshStandardMaterial color="#0D1422" metalness={0.9} roughness={0.22} />
          </mesh>
        ))}
        <mesh position={[0, 1.48, 0]}>
          <boxGeometry args={[0.42, 0.24, 2.15]} />
          <meshStandardMaterial color="#C8D3E3" metalness={0.94} roughness={0.18} />
        </mesh>
        <mesh ref={scanBeamRef} position={[0, 0.6, 0]}>
          <boxGeometry args={[0.04, 0.025, 1.78]} />
          <meshBasicMaterial color="#38E8FF" transparent opacity={0.88} />
        </mesh>
        <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.65, 1.9]} />
          <meshBasicMaterial color="#38E8FF" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>

        <mesh ref={outerRingRef} rotation={[Math.PI / 2.4, 0.2, 0]} position={[0, 0.55, 0]}>
          <torusGeometry args={[2.1, 0.018, 16, 120]} />
          <meshStandardMaterial color="#C8D3E3" metalness={0.95} roughness={0.15} emissive="#2E7BFF" emissiveIntensity={0.42} />
        </mesh>

        {[-2.2, 0, 2.2].map((rx, idx) => (
          <group key={idx} position={[rx, -0.45, -2.5]}>
            <mesh>
              <boxGeometry args={[1.65, 2.2, 0.72]} />
              <meshStandardMaterial color="#0B111C" metalness={0.85} roughness={0.28} />
            </mesh>
            {[0.4, -0.35].map((sy, sidx) => (
              <mesh key={sidx} position={[0, sy, 0.38]}>
                <boxGeometry args={[1.38, 0.035, 0.02]} />
                <meshBasicMaterial color={(idx + sidx) % 2 === 0 ? '#38E8FF' : '#2E7BFF'} />
              </mesh>
            ))}
          </group>
        ))}

        <FloatingIdTag
          text={selectedId ? `INDEXED // #${selectedId}` : 'AVL CORE // ACTIVE'}
          accent="#38E8FF"
          position={[0, 1.88, 0]}
        />
      </group>

      {particleCount > 0 && (
        <Sparkles
          count={particleCount}
          scale={[14, 6, 8]}
          size={1.8}
          speed={0.28}
          opacity={0.42}
          color="#7CEEFF"
        />
      )}
    </>
  )
}

export default function HeroWarehouseCanvas({ graphics }: { graphics: GraphicsCapabilities }) {
  return (
    <Canvas
      dpr={graphics.dpr}
      camera={{ position: [-1.6, 2.35, 7.6], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      className="h-full w-full"
    >
      <KineticWarehouseHeroScene
        reducedMotion={graphics.prefersReducedMotion}
        particleCount={graphics.particleCount}
        enableReflections={graphics.enableReflections}
      />
    </Canvas>
  )
}
