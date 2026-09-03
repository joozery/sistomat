'use client'

import { useEffect, Suspense, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Center, Environment } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as THREE from 'three'
import { Loader2, AlertCircle } from 'lucide-react'

interface Viewer3DProps {
  fileUrl: string
  ext: string
}

// ---- Standard loaders ----

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url)
  return (
    <Center>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#9ca3af" metalness={0.4} roughness={0.5} />
      </mesh>
    </Center>
  )
}

function OBJModel({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url)
  return <Center><primitive object={obj} /></Center>
}

function GLTFModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url)
  return <Center><primitive object={gltf.scene} /></Center>
}

// ---- STEP: server-side conversion → receive mesh JSON ----

interface StepMesh {
  position: number[]
  normal: number[] | null
  index: number[] | null
  color: [number, number, number] | null
}

function useStepMeshes(fileUrl: string) {
  const [meshes, setMeshes] = useState<THREE.BufferGeometry[]>([])
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/convert-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileUrl }),
        })
        let data: { meshes?: unknown[]; message?: string }
        try {
          data = await res.json()
        } catch {
          throw new Error(`Server error (${res.status}) — กรุณาดู console`)
        }
        if (!res.ok) throw new Error(data.message || 'แปลงไม่สำเร็จ')

        const geos = (data.meshes as StepMesh[]).map((m) => {
          const geo = new THREE.BufferGeometry()
          geo.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3))
          if (m.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3))
          if (m.index) geo.setIndex(new THREE.Uint32BufferAttribute(m.index, 1))
          if (!m.normal) geo.computeVertexNormals()
          return { geo, color: m.color }
        })

        if (!cancelled) { setMeshes(geos.map(g => g.geo)); setStatus('done') }
      } catch (e) {
        if (!cancelled) {
          setErrMsg(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ')
          setStatus('error')
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [fileUrl])

  return { meshes, status, errMsg }
}

function STEPMeshes({ meshes }: { meshes: THREE.BufferGeometry[] }) {
  return (
    <Center>
      <group>
        {meshes.map((geo, i) => (
          <mesh key={i} geometry={geo} castShadow receiveShadow>
            <meshStandardMaterial color="#9ca3af" metalness={0.3} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </Center>
  )
}

// ---- Auto-fit camera after scene loads ----

function AutoCamera() {
  const { camera, scene } = useThree()
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8
    camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist)
    camera.lookAt(center)
    ;(camera as THREE.PerspectiveCamera).near = dist / 100
    ;(camera as THREE.PerspectiveCamera).far = dist * 10
    camera.updateProjectionMatrix()
  }, [camera, scene])
  return null
}

// ---- STEP wrapper with overlay ----

function StepViewer({ url }: { url: string }) {
  const { meshes, status, errMsg } = useStepMeshes(url)

  return (
    <>
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-gray-100 to-gray-200 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#7B1A1A]" />
          <p className="text-sm text-gray-600 font-medium">กำลังแปลงไฟล์ STEP...</p>
          <p className="text-xs text-gray-400">อาจใช้เวลา 5–20 วินาที</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-gray-100 to-gray-200 z-10">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-gray-600 font-medium">{errMsg}</p>
        </div>
      )}
      {status === 'done' && meshes.length > 0 && (
        <Canvas shadows camera={{ fov: 45 }} className="absolute inset-0">
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />
          <Environment preset="city" />
          <Suspense fallback={null}>
            <STEPMeshes meshes={meshes} />
            <AutoCamera />
          </Suspense>
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </Canvas>
      )}
    </>
  )
}

// ---- Main export ----

export default function Viewer3D({ fileUrl, ext }: Viewer3DProps) {
  const isStep = ext === 'step' || ext === 'stp'

  return (
    <div className="w-full h-full relative bg-gradient-to-b from-gray-100 to-gray-200">
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-3 text-[10px] text-gray-500 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 pointer-events-none">
        <span>🖱 ลาก: หมุน</span>
        <span>🖱 คลิกขวา: เลื่อน</span>
        <span>🖱 Scroll: ซูม</span>
      </div>

      {isStep ? (
        <StepViewer url={fileUrl} />
      ) : (
        <Canvas shadows camera={{ fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-5, -5, -5]} intensity={0.3} />
          <Environment preset="city" />
          <Suspense fallback={null}>
            {(ext === 'stl') && <STLModel url={fileUrl} />}
            {(ext === 'obj') && <OBJModel url={fileUrl} />}
            {(ext === 'glb' || ext === 'gltf') && <GLTFModel url={fileUrl} />}
            <AutoCamera />
          </Suspense>
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        </Canvas>
      )}
    </div>
  )
}
