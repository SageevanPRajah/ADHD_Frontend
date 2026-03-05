import React, { useEffect, useMemo, useState } from 'react'
import { useStage } from '../lib/useStage'

type Props = { durationMs: number; onEvent: (name: string, payload?: any)=>void; onDone: () => void }

export default function Game5PursuitShip({ durationMs, onEvent, onDone }: Props){
  const canvasRef = useStage()
  const bg = useMemo(() => { const i=new Image(); i.src='/assets/plainSpace.png'; return i }, [])
  const ship = useMemo(() => { const i=new Image(); i.src='/assets/spaceShip.png'; return i }, [])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const start = performance.now()
    onEvent('game_start', { game: 5 })

    const FREQ = 0.35 // Hz
    const AMP = 0.35  // screen ratio

    const draw = () => {
      const w = c.clientWidth, h=c.clientHeight
      ctx.clearRect(0,0,w,h)
      if (bg.complete) ctx.drawImage(bg,0,0,w,h)
      else { ctx.fillStyle='#0b132b'; ctx.fillRect(0,0,w,h) }

      const t = (performance.now()-start)/1000
      const x = w/2 + Math.sin(2*Math.PI*FREQ*t) * (w*AMP)
      const y = h*0.55
      const sw = 160, sh = 120
      if (ship.complete) ctx.drawImage(ship, x-sw/2, y-sh/2, sw, sh)

      // log target path ~ every 60ms
      if (Math.floor((performance.now()-start)/60) !== Math.floor((performance.now()-start-16)/60)){
        onEvent('pursuit_target_pos', { x, y, t_ms: Math.round(performance.now()-start) })
      }

      const left = Math.max(0, Math.ceil((durationMs - (performance.now()-start))/1000))
      ctx.fillStyle='#e5e7eb'; ctx.font='700 20px system-ui'; ctx.textAlign='left'
      ctx.fillText(`Time: ${left}s`, 18, 30)

      if (performance.now()-start >= durationMs){
        onEvent('game_end', { game: 5 })
        setDone(true)
        onDone()
        return
      }
      requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)
  }, [canvasRef, bg, ship, durationMs, onEvent])

  return (
    <div style={{height:'100%'}}>
      <canvas ref={canvasRef} className="stage" />
      {done && <div className="card" style={{position:'absolute', top:16, left:'50%', transform:'translateX(-50%)'}}>Game 5 finished ✅</div>}
    </div>
  )
}
