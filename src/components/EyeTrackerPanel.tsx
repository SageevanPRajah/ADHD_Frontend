import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FaceMesh } from '@mediapipe/face_mesh'
import { Camera } from '@mediapipe/camera_utils'
import type { AffineModel } from '../lib/calibration'
import { applyAffine } from '../lib/calibration'

type Props = {
  enabled: boolean
  showPreview: boolean
  onGaze: (g: {t_ms:number; x:number; y:number; valid:boolean; raw?:any}) => void
  affine: AffineModel | null
}

function clamp(v:number, a:number, b:number){ return Math.max(a, Math.min(b, v)) }

/**
 * Lightweight gaze proxy using MediaPipe FaceMesh iris landmarks.
 * Output is always in **viewport coordinates** (clientX/clientY) after calibration.
 */
export default function EyeTrackerPanel({ enabled, showPreview, onGaze, affine }: Props){
  const videoRef = useRef<HTMLVideoElement|null>(null)
  const overlayRef = useRef<HTMLCanvasElement|null>(null)
  const [status, setStatus] = useState<'idle'|'starting'|'running'|'error'>('idle')
  const [err, setErr] = useState<string>('')

  // Throttle gaze sending (keeps WS + backend lighter)
  const lastEmitRef = useRef(0)
  const EMIT_EVERY_MS = 33 // ~30Hz

  const faceMesh = useMemo(() => new FaceMesh({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
  }), [])

  useEffect(() => {
    if (!enabled) return
    let cam: Camera | null = null
    let cancelled = false

    async function start(){
      try{
        setStatus('starting')
        setErr('')

        const video = videoRef.current
        const overlay = overlayRef.current
        if (!video || !overlay) throw new Error('Video/overlay not mounted')
        const ctx = overlay.getContext('2d')!

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        faceMesh.onResults((res: any) => {
          const t_ms = performance.now()

          // Canvas sizing
          const w = overlay.width = overlay.clientWidth
          const h = overlay.height = overlay.clientHeight
          ctx.clearRect(0,0,w,h)

          const lm = res.multiFaceLandmarks?.[0]
          if (!lm){
            onGaze({ t_ms, x: 0, y: 0, valid: false })
            return
          }

          // Iris landmarks (refineLandmarks: true)
          // Left iris center ~ 468, Right iris center ~ 473
          const L = lm[468], R = lm[473]
          // Eye corners (approx): left eye outer 33, inner 133; right eye inner 362, outer 263
          const lOuter = lm[33], lInner = lm[133]
          const rInner = lm[362], rOuter = lm[263]

          const lBoxW = Math.max(1e-6, (lInner.x - lOuter.x))
          const rBoxW = Math.max(1e-6, (rOuter.x - rInner.x))

          const lRatio = (L.x - lOuter.x) / lBoxW     // 0..1 across eye
          const rRatio = (R.x - rInner.x) / rBoxW

          const xNorm = clamp((lRatio + rRatio) / 2, 0, 1)

          // Vertical proxy using upper/lower eyelid points (159/145 left, 386/374 right)
          const lUp = lm[159], lDn = lm[145]
          const rUp = lm[386], rDn = lm[374]
          const lH = Math.max(1e-6, (lDn.y - lUp.y))
          const rH = Math.max(1e-6, (rDn.y - rUp.y))
          const lVR = clamp((L.y - lUp.y)/lH, 0, 1)
          const rVR = clamp((R.y - rUp.y)/rH, 0, 1)
          const yNorm = clamp((lVR + rVR) / 2, 0, 1)

          // Map to viewport coordinates
          const mapped = applyAffine(affine, xNorm, yNorm)
          let x = mapped ? mapped.x : xNorm * window.innerWidth
          let y = mapped ? mapped.y : yNorm * window.innerHeight
          x = clamp(x, 0, window.innerWidth)
          y = clamp(y, 0, window.innerHeight)

          if (showPreview){
            // Preview shows the *raw* normalized point in the preview canvas (privacy-friendly)
            const sx = xNorm * w
            const sy = yNorm * h
            ctx.beginPath()
            ctx.arc(sx, sy, 6, 0, Math.PI*2)
            ctx.fillStyle = '#22d3ee'
            ctx.fill()
          }

          // Throttle emit
          if (t_ms - lastEmitRef.current >= EMIT_EVERY_MS){
            lastEmitRef.current = t_ms
            onGaze({ t_ms, x, y, valid: true, raw: { xNorm, yNorm } })
          }
        })

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
        video.srcObject = stream
        await video.play()

        cam = new Camera(video, {
          onFrame: async () => {
            if (!cancelled) await faceMesh.send({ image: video })
          },
          width: 640,
          height: 480,
        })
        cam.start()

        setStatus('running')
      } catch (e:any){
        setStatus('error')
        setErr(e?.message || String(e))
      }
    }

    start()

    return () => {
      cancelled = true
      try{
        const v = videoRef.current
        const stream = v?.srcObject as MediaStream | null
        stream?.getTracks().forEach(t => t.stop())
      }catch{}
      try{ cam?.stop() }catch{}
    }
  }, [enabled, faceMesh, onGaze, showPreview, affine])

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div><strong>👁️ Eye tracking</strong> <span className="pill">{status}</span></div>
      </div>
      {status==='error' && <div style={{color:'#fca5a5', marginTop:8}}>Camera/Model error: {err}</div>}
      <div style={{marginTop:10}}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width:'100%',
            borderRadius:12,
            display: showPreview ? 'block' : 'none',
            transform:'scaleX(-1)'
          }}
        />
        <canvas
          ref={overlayRef}
          style={{
            width:'100%',
            height: showPreview ? 180 : 1,
            borderRadius:12,
            marginTop: showPreview ? 8 : 0,
            display: showPreview ? 'block' : 'none'
          }}
        />
        {!showPreview && <div style={{opacity:.8, fontSize:13}}>Preview hidden (privacy). You can enable it anytime.</div>}
      </div>
      <div style={{marginTop:10, fontSize:12, opacity:.85}}>
        Webcam + MediaPipe FaceMesh (iris landmarks) → gaze proxy. Calibration maps to viewport coordinates.
      </div>
    </div>
  )
}
