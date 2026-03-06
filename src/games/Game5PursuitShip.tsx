import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStage } from '../lib/useStage'

type Props = { durationMs: number; onEvent: (name: string, payload?: any)=>void; onDone: () => void }

export default function Game5PursuitShip({ durationMs, onEvent, onDone }: Props){
  const canvasRef = useStage()
  const bg = useMemo(() => { const i=new Image(); i.src='/assets/plainSpace.png'; return i }, [])
  const ship = useMemo(() => { const i=new Image(); i.src='/assets/spaceShip.png'; return i }, [])
  const [done, setDone] = useState(false)
  const onEventRef = useRef(onEvent)
  const onDoneRef = useRef(onDone)

  useEffect(() => { onEventRef.current = onEvent }, [onEvent])
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const start = performance.now()
    let finished = false
    let rafId = 0
    let lastLogBucket = -1

    onEventRef.current('game_start', { game: 5 })

    const finishGame = () => {
      if (finished) return
      finished = true
      onEventRef.current('game_end', { game: 5 })
      setDone(true)
      onDoneRef.current()
    }

    const FREQ = 0.35
    const AMP = 0.35

    const draw = () => {
      if (finished) return

      const now = performance.now()
      const elapsed = now - start
      const w = c.clientWidth, h=c.clientHeight
      ctx.clearRect(0,0,w,h)
      if (bg.complete) ctx.drawImage(bg,0,0,w,h)
      else { ctx.fillStyle='#0b132b'; ctx.fillRect(0,0,w,h) }

      const t = elapsed/1000
      const x = w/2 + Math.sin(2*Math.PI*FREQ*t) * (w*AMP)
      const y = h*0.55
      const sw = 160, sh = 120
      if (ship.complete) ctx.drawImage(ship, x-sw/2, y-sh/2, sw, sh)

      const bucket = Math.floor(elapsed / 60)
      if (bucket !== lastLogBucket){
        lastLogBucket = bucket
        onEventRef.current('pursuit_target_pos', { x, y, t_ms: Math.round(elapsed) })
      }

      const left = Math.max(0, Math.ceil((durationMs - elapsed)/1000))
      ctx.fillStyle='#e5e7eb'; ctx.font='700 20px system-ui'; ctx.textAlign='left'
      ctx.fillText(`Time: ${left}s`, 18, 30)

      if (elapsed >= durationMs){
        finishGame()
        return
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => {
      finished = true
      cancelAnimationFrame(rafId)
    }
  }, [canvasRef, bg, ship, durationMs])

  return (
    <div style={{height:'100%'}}>
      <canvas ref={canvasRef} className="stage" />
      {done && <div className="card" style={{position:'absolute', top:16, left:'50%', transform:'translateX(-50%)'}}>Game 5 finished ✅</div>}
    </div>
  )
}
