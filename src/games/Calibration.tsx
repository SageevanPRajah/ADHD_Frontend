import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStage } from '../lib/useStage'
import type { CalibSample, AffineModel } from '../lib/calibration'
import { fitAffine } from '../lib/calibration'

type Props = {
  onEvent: (name: string, payload?: any) => void
  onCalibSample: (s: {screen_x:number; screen_y:number; gaze_x:number; gaze_y:number; valid:boolean}) => void
  getLatestGaze: () => { xNorm?: number; yNorm?: number; valid: boolean }  // gaze in 0..1 from EyeTracker raw
  onModel: (m: AffineModel | null) => void
}

function points9(w:number,h:number){
  const xs=[0.15,0.5,0.85], ys=[0.2,0.5,0.8]
  const pts=[] as {x:number;y:number}[]
  for(const y of ys) for(const x of xs) pts.push({x: Math.round(x*w), y: Math.round(y*h)})
  return pts
}
function points3(w:number,h:number){
  const xs=[0.2,0.5,0.8], y=0.5
  return xs.map(x=>({x: Math.round(x*w), y: Math.round(y*h)}))
}

/**
 * Calibration records screen coordinates in **viewport space** (clientX/clientY).
 * This makes the fitted affine usable everywhere (games, UI overlays), regardless of layout.
 */
export default function Calibration({ onEvent, onCalibSample, getLatestGaze, onModel }: Props){
  const canvasRef = useStage()
  const [mode, setMode] = useState<'idle'|'calib9'|'recal3'>('idle')
  const [idx, setIdx] = useState(0)
  const idxRef = useRef(0)
  const [samples, setSamples] = useState<CalibSample[]>([])

  const img = useMemo(() => {
    const i = new Image()
    i.src = '/assets/targetRed.png'
    return i
  }, [])

  useEffect(() => { idxRef.current = idx }, [idx])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!

    let raf = 0
    const DOT_MS = 1400
    const HOLD_MS = 450

    const getPts = (w:number,h:number) => (mode==='calib9' ? points9(w,h) : points3(w,h))

    const draw = () => {
      const w = c.width = c.clientWidth
      const h = c.height = c.clientHeight

      ctx.clearRect(0,0,w,h)
      ctx.fillStyle = '#0b132b'
      ctx.fillRect(0,0,w,h)

      ctx.fillStyle = '#e5e7eb'
      ctx.font = '700 20px system-ui'
      ctx.fillText('Calibration', 18, 32)
      ctx.font = '14px system-ui'
      ctx.fillStyle = '#a7b2d9'
      ctx.fillText(mode==='calib9' ? 'Follow the red target (9 points)' : mode==='recal3' ? 'Recalibration (3 points)' : 'Press Start', 18, 54)

      if (mode !== 'idle'){
        const pts = getPts(w,h)
        const p = pts[idxRef.current]
        if (p){
          const s = 54
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.drawImage(img, -s/2, -s/2, s, s)
          ctx.restore()

          // subtle ring
          ctx.beginPath()
          ctx.arc(p.x, p.y, 40, 0, Math.PI*2)
          ctx.strokeStyle = 'rgba(255,255,255,.12)'
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [canvasRef, img, mode])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return

    if (mode === 'idle') return

    const DOT_MS = 1400
    const HOLD_MS = 450

    const tick = () => {
      const w = c.clientWidth
      const h = c.clientHeight
      const pts = mode==='calib9' ? points9(w,h) : points3(w,h)
      const i = idxRef.current
      const p = pts[i]
      if (!p) return

      const rect = c.getBoundingClientRect()
      const screen_x = rect.left + p.x
      const screen_y = rect.top + p.y

      const g = getLatestGaze()
      const gaze_x = g.xNorm ?? 0
      const gaze_y = g.yNorm ?? 0
      const valid = g.valid

      onCalibSample({ screen_x, screen_y, gaze_x, gaze_y, valid })
      setSamples(prev => [...prev, { screen_x, screen_y, gaze_x, gaze_y, valid }])
      onEvent('calib_point_sample', { idx: i, screen_x, screen_y, gaze_x, gaze_y, valid, mode })

      // advance
      setIdx(v => v + 1)
    }

    const timer = setInterval(tick, DOT_MS + HOLD_MS)
    return () => clearInterval(timer)
  }, [canvasRef, mode, onCalibSample, onEvent, getLatestGaze])

  useEffect(() => {
    if (mode === 'idle') return
    const c = canvasRef.current
    if (!c) return

    const pts = mode==='calib9' ? points9(c.clientWidth,c.clientHeight) : points3(c.clientWidth,c.clientHeight)
    if (idx >= pts.length){
      onEvent('calib_done', { mode, n: samples.length })
      const m = fitAffine(samples)
      onModel(m)
      setMode('idle')
      setIdx(0)
    }
  }, [idx, mode, samples, canvasRef, onEvent, onModel])

  return (
    <div style={{height:'100%'}}>
      <div className="row" style={{gap:8, padding:12}}>
        <button
          className="btn secondary"
          onClick={() => {
            setSamples([])
            setIdx(0)
            setMode('calib9')
            onEvent('calib_start',{mode:'calib9'})
          }}
        >
          Start 9-Point
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setSamples([])
            setIdx(0)
            setMode('recal3')
            onEvent('calib_start',{mode:'recal3'})
          }}
        >
          Recalibrate 3-Point
        </button>
        <span className="pill" style={{marginLeft:'auto'}}>
          {mode==='idle' ? 'idle' : `${idxRef.current+1}/${mode==='calib9' ? 9 : 3}`}
        </span>
      </div>
      <canvas ref={canvasRef} className="stage" />
    </div>
  )
}
