import { Environment, Float, Lightformer, Sparkles } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GraphicsCapabilities } from '../../hooks/useGraphicsCapabilities'

interface HeroSceneContentProps {
  reducedMotion: boolean
  particleCount: number
}

const NODE_OFFSETS: Array<[number, number, number, number]> = [
  [-2.35, 0.95, 0.4, 0.42],
  [2.3, 1.1, -0.35, 0.36],
  [-2.1, -1.05, -0.45, 0.38],
  [2.45, -0.9, 0.5, 0.44],
  [0.0, 1.95, -0.9, 0.32],
  [0.0, -1.9, 0.65, 0.34],
]

function WarehouseMonolith({ reducedMotion }: { reducedMotion: boolean }) {
  const monolithRef = useRef<THREE.Group | null>(null)
  const outerRingRef = useRef<THREE.Mesh | null>(null)
  const innerRingRef = useRef<THREE.Mesh | null>(null)
  const scanBeamRef = useRef<THREE.Mesh | null>(null)
  const coreCubesRef = useRef<THREE.Group | null>(null)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const pointerX = state.pointer.x
    const pointerY = state.pointer.y

    if (monolithRef.current) {
      const targetRotY = pointerX * 0.35 + (reducedMotion ? 0 : t * 0.12)
      const targetRotX = -pointerY * 0.22 + (reducedMotion ? 0 : Math.sin(t * 0.35) * 0.05)
      monolithRef.current.rotation.y = THREE.MathUtils.lerp(
        monolithRef.current.rotation.y,
        targetRotY,
        Math.min(1, delta * 3.5),
      )
      monolithRef.current.rotation.x = THREE.MathUtils.lerp(
        monolithRef.current.rotation.x,
        targetRotX,
        Math.min(1, delta * 3.5),
      )
    }

    if (!reducedMotion) {
      if (outerRingRef.current) {
        outerRingRef.current.rotation.z += delta * 0.18
      }
      if (innerRingRef.current) {
        innerRingRef.current.rotation.z -= delta * 0.28
        innerRingRef.current.rotation.x = Math.sin(t * 0.4) * 0.35
      }
      if (scanBeamRef.current) {
        scanBeamRef.current.position.y = Math.sin(t * 1.15) * 1.15
      }
      if (coreCubesRef.current) {
        coreCubesRef.current.rotation.y -= delta * 0.22
      }
    }

    // Subtle studio camera breathing
    const targetCamX = pointerX * 0.45
    const targetCamY = pointerY * 0.28 + 0.2
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetCamX, 0.04)
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetCamY, 0.04)
    state.camera.lookAt(0, 0, 0)
  })

  const frameStruts = useMemo(
    () => [
      [-1.15, 0, -0.75],
      [1.15, 0, -0.75],
      [-1.15, 0, 0.75],
      [1.15, 0, 0.75],
    ] as Array<[number, number, number]>,
    [],
  )

  return (
    <group ref={monolithRef} position={[0, 0.05, 0]}>
      {/* Central Dark Anodized Monolith Chassis */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.1, 2.75, 1.35]} />
        <meshStandardMaterial
          color="#0B1018"
          metalness={0.86}
          roughness={0.26}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Recessed Inner Chamber */}
      <mesh>
        <boxGeometry args={[1.76, 2.38, 1.4]} />
        <meshStandardMaterial color="#05070B" metalness={0.95} roughness={0.18} />
      </mesh>

      {/* Brushed Metallic Silver Structural Corner Pillars */}
      {frameStruts.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <boxGeometry args={[0.1, 2.95, 0.1]} />
          <meshStandardMaterial color="#C8D3E3" metalness={0.95} roughness={0.16} />
        </mesh>
      ))}

      {/* Horizontal Cantilevered Interval Rack Tiers inside Core */}
      {[-0.8, -0.25, 0.3, 0.85].map((yPos, idx) => (
        <group key={idx} position={[0, yPos, 0]}>
          <mesh>
            <boxGeometry args={[2.32, 0.055, 1.52]} />
            <meshStandardMaterial color="#1F2937" metalness={0.9} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0, 0.77]}>
            <boxGeometry args={[1.9, 0.018, 0.02]} />
            <meshBasicMaterial color={idx % 2 === 0 ? '#38E8FF' : '#2E7BFF'} />
          </mesh>
        </group>
      ))}

      {/* Kinetic Core Modules */}
      <group ref={coreCubesRef}>
        {[-0.52, 0.02, 0.58].map((y, idx) => (
          <mesh key={idx} position={[(idx - 1) * 0.42, y, 0.25]}>
            <boxGeometry args={[0.42, 0.32, 0.42]} />
            <meshStandardMaterial
              color={idx === 1 ? '#2E7BFF' : '#8FA4C4'}
              metalness={0.88}
              roughness={0.2}
              emissive={idx === 1 ? '#1C5BFF' : '#0D1C36'}
              emissiveIntensity={idx === 1 ? 0.65 : 0.2}
            />
          </mesh>
        ))}
      </group>

      {/* Sweeping Optical Index Scan Plane */}
      <mesh ref={scanBeamRef} position={[0, 0, 0]}>
        <boxGeometry args={[2.65, 0.025, 1.75]} />
        <meshBasicMaterial color="#38E8FF" transparent opacity={0.78} />
      </mesh>

      {/* Precision Telemetry Gyro Rings */}
      <mesh ref={outerRingRef} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[2.25, 0.016, 16, 120]} />
        <meshStandardMaterial
          color="#C8D3E3"
          metalness={0.95}
          roughness={0.15}
          emissive="#2E7BFF"
          emissiveIntensity={0.35}
        />
      </mesh>
      <mesh ref={innerRingRef} rotation={[Math.PI / 3.1, -0.45, 0]}>
        <torusGeometry args={[1.82, 0.012, 16, 96]} />
        <meshBasicMaterial color="#38E8FF" transparent opacity={0.6} />
      </mesh>

      {/* Orbiting Floating Package Nodes */}
      {NODE_OFFSETS.map(([x, y, z, size], index) => (
        <Float
          key={index}
          speed={reducedMotion ? 0 : 1.3 + index * 0.15}
          rotationIntensity={reducedMotion ? 0 : 0.4}
          floatIntensity={reducedMotion ? 0 : 0.45}
        >
          <group position={[x, y, z]}>
            <mesh>
              <boxGeometry args={[size, size, size]} />
              <meshStandardMaterial
                color="#141C2B"
                metalness={0.88}
                roughness={0.22}
                envMapIntensity={1.5}
              />
            </mesh>
            <mesh position={[0, size * 0.52, 0]}>
              <boxGeometry args={[size * 0.65, 0.02, size * 0.65]} />
              <meshBasicMaterial color={index % 2 === 0 ? '#38E8FF' : '#2E7BFF'} />
            </mesh>
          </group>
        </Float>
      ))}
    </group>
  )
}

function HeroSceneContent({ reducedMotion, particleCount }: HeroSceneContentProps) {
  return (
    <>
      <color attach="background" args={['#05070B']} />
      <fog attach="fog" args={['#05070B', 6.5, 16]} />

      <ambientLight intensity={0.22} />
      <directionalLight position={[5, 7, 5]} intensity={1.9} color="#E6F0FF" />
      <pointLight position={[-4.5, 2.5, 3]} intensity={18} distance={14} color="#2E7BFF" />
      <pointLight position={[4.2, -2.0, 2.5]} intensity={14} distance={12} color="#38E8FF" />
      <spotLight
        position={[0, 6.5, 2]}
        angle={0.45}
        penumbra={0.75}
        intensity={42}
        color="#DCEBFF"
      />

      {/* Procedural Studio Reflections (zero external HDR downloads) */}
      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={2.6}
          color="#DCEBFF"
          position={[0, 5, -3]}
          scale={[10, 2, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={3.2}
          color="#2E7BFF"
          position={[-6, 1, 2]}
          scale={[4, 8, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#38E8FF"
          position={[6, -1, 2]}
          scale={[3, 6, 1]}
          target={[0, 0, 0]}
        />
      </Environment>

      <WarehouseMonolith reducedMotion={reducedMotion} />

      {particleCount > 0 && (
        <Sparkles
          count={particleCount}
          scale={[11, 7, 7]}
          size={1.6}
          speed={0.25}
          opacity={0.42}
          color="#7CEEFF"
        />
      )}

      {/* Subtle Ground Architectural Grid Disc */}
      <gridHelper
        args={[22, 28, '#2E7BFF', '#111827']}
        position={[0, -2.55, 0]}
        rotation={[0, 0, 0]}
      />
    </>
  )
}

export default function HeroMonolithCanvas({ graphics }: { graphics: GraphicsCapabilities }) {
  return (
    <Canvas
      dpr={graphics.dpr}
      camera={{ position: [0, 0.2, 6.4], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      className="h-full w-full"
    >
      <HeroSceneContent
        reducedMotion={graphics.prefersReducedMotion}
        particleCount={graphics.particleCount}
      />
    </Canvas>
  )
}
