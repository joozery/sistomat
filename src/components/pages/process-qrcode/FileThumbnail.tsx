'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FileText, Box, Loader2, AlertCircle } from 'lucide-react'

interface FileThumbnailProps {
  fileUrl: string
  fileName: string
  onClick?: () => void
  size?: number
}

const SIZE = 80

function getExt(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

// Render Three.js scene → return base64 png
function renderSnapshot(scene: THREE.Scene): string {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setSize(SIZE, SIZE)
  renderer.setPixelRatio(1)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100000)
  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const dir = new THREE.DirectionalLight(0xffffff, 1.2)
  dir.position.set(5, 8, 5)
  scene.add(dir)

  const box = new THREE.Box3().setFromObject(scene)
  if (!box.isEmpty()) {
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.8
    camera.position.set(center.x + dist * 0.5, center.y + dist * 0.4, center.z + dist)
    camera.lookAt(center)
    camera.near = dist / 200
    camera.far = dist * 20
    camera.updateProjectionMatrix()
  }

  renderer.render(scene, camera)
  const dataUrl = renderer.domElement.toDataURL('image/png')
  renderer.dispose()
  return dataUrl
}

async function loadSTL(url: string): Promise<string> {
  const loader = new STLLoader()
  const geo = await new Promise<THREE.BufferGeometry>((res, rej) => loader.load(url, res, undefined, rej))
  const scene = new THREE.Scene()
  const mat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.35, roughness: 0.55 })
  scene.add(new THREE.Mesh(geo, mat))
  return renderSnapshot(scene)
}

async function loadOBJ(url: string): Promise<string> {
  const loader = new OBJLoader()
  const obj = await new Promise<THREE.Group>((res, rej) => loader.load(url, res, undefined, rej))
  const scene = new THREE.Scene()
  scene.add(obj)
  return renderSnapshot(scene)
}

async function loadGLTF(url: string): Promise<string> {
  const loader = new GLTFLoader()
  const gltf = await new Promise<{ scene: THREE.Group }>((res, rej) => loader.load(url, res as never, undefined, rej))
  const scene = new THREE.Scene()
  scene.add(gltf.scene)
  return renderSnapshot(scene)
}

async function loadSTEP(fileUrl: string): Promise<string> {
  const token = localStorage.getItem('token')
  const res = await fetch('/api/convert-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileUrl }),
  })
  let data: { meshes?: { position: number[]; normal: number[] | null; index: number[] | null }[]; message?: string }
  try { data = await res.json() } catch { throw new Error(`Server error ${res.status}`) }
  if (!res.ok) throw new Error(data.message || 'แปลงไม่สำเร็จ')

  const scene = new THREE.Scene()
  for (const m of data.meshes ?? []) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3))
    if (m.normal) geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3))
    if (m.index) geo.setIndex(new THREE.Uint32BufferAttribute(m.index, 1))
    if (!m.normal) geo.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.35, roughness: 0.55, side: THREE.DoubleSide })
    scene.add(new THREE.Mesh(geo, mat))
  }
  return renderSnapshot(scene)
}

export function FileThumbnail({ fileUrl, fileName, onClick, size = 80 }: FileThumbnailProps) {
  const ext = getExt(fileName)
  const isPdf = ext === 'pdf'
  const is3d = ['stl', 'obj', 'glb', 'gltf', 'step', 'stp'].includes(ext)

  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const containerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!is3d) return
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && status === 'idle') {
          setStatus('loading')
          observer.disconnect()

          const load = async () => {
            try {
              let src: string
              if (ext === 'stl') src = await loadSTL(fileUrl)
              else if (ext === 'obj') src = await loadOBJ(fileUrl)
              else if (ext === 'glb' || ext === 'gltf') src = await loadGLTF(fileUrl)
              else src = await loadSTEP(fileUrl)
              setImgSrc(src)
              setStatus('done')
            } catch {
              setStatus('error')
            }
          }
          load()
        }
      },
      { rootMargin: '100px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [fileUrl, ext, is3d, status])

  const sizeStyle = { width: size, height: size }
  const baseClass = 'rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center transition-all shrink-0'
  const clickable = onClick ? 'cursor-pointer hover:ring-2 hover:ring-[#7B1A1A]/40 hover:border-[#7B1A1A]/40' : ''

  if (isPdf) {
    return (
      <button ref={containerRef as never} style={sizeStyle} onClick={onClick}
        className={`${baseClass} ${clickable} bg-red-50 flex-col gap-1`}>
        <FileText className="h-7 w-7 text-red-400" />
        <span className="text-[9px] font-bold text-red-400 uppercase tracking-wide">PDF</span>
      </button>
    )
  }

  if (!is3d) return null

  return (
    <button ref={containerRef} style={sizeStyle} onClick={onClick}
      className={`${baseClass} ${clickable} bg-gray-100`}>
      {status === 'idle' && <Box className="h-6 w-6 text-gray-300" />}
      {status === 'loading' && (
        <div className="flex flex-col items-center gap-1">
          <Loader2 className="h-5 w-5 animate-spin text-[#7B1A1A]" />
          {(ext === 'step' || ext === 'stp') && (
            <span className="text-[8px] text-gray-400 text-center leading-tight px-1">แปลง<br/>STEP...</span>
          )}
        </div>
      )}
      {status === 'error' && <AlertCircle className="h-6 w-6 text-red-300" />}
      {status === 'done' && imgSrc && (
        <img src={imgSrc} alt={fileName} className="w-full h-full object-cover" />
      )}
    </button>
  )
}
