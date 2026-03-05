import React, { useEffect, useMemo, useState } from 'react'
import { useStage } from '../lib/useStage'

type Props = { durationMs: number; onEvent: (name: string, payload?: any)=>void; onDone: () => void }

export default function Game4FixationStar({ durationMs, onEvent, onDone }: Props){
  const canvasRef = useStage()
  const bg = useMemo(() => { const i=new Image(); i.src='/assets/nightSky.png'; return i }, [])
  const s1 = useMemo(() => { const i=new Image(); i.src='/assets/star/star1.png'; return i }, [])
  const s2 = useMemo(() => { const i=new Image(); i.src='/assets/star/star2.png'; return i }, [])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const start = performance.now()
    onEvent('game_start', { game: 4 })

    const draw = () => {
      const w = c.clientWidth, h=c.clientHeight
      ctx.clearRect(0,0,w,h)
      if (bg.complete) ctx.drawImage(bg,0,0,w,h)
      else { ctx.fillStyle='#0b132b'; ctx.fillRect(0,0,w,h) }

      const t = (performance.now()-start)/1000
      const pulse = 1 + 0.08*Math.sin(t*3.2)
      const img = (Math.floor(t*2)%2===0) ? s1 : s2
      const size = 170 * pulse
      if (img.complete){
        ctx.drawImage(img, w/2-size/2, h/2-size/2, size, size)
      } else {
        ctx.fillStyle='#facc15'
        ctx.beginPath(); ctx.arc(w/2,h/2, 50, 0, Math.PI*2); ctx.fill()
      }

      const left = Math.max(0, Math.ceil((durationMs - (performance.now()-start))/1000))
      ctx.fillStyle='#e5e7eb'; ctx.font='700 20px system-ui'; ctx.textAlign='left'
      ctx.fillText(`Time: ${left}s`, 18, 30)

      if (performance.now()-start >= durationMs){
        onEvent('game_end', { game: 4 })
        setDone(true)
        onDone()
        return
      }
      requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)
  }, [canvasRef, bg, s1, s2, durationMs, onEvent])

  return (
    <div style={{height:'100%'}}>
      <canvas ref={canvasRef} className="stage" />
      {done && <div className="card" style={{position:'absolute', top:16, left:'50%', transform:'translateX(-50%)'}}>Game 4 finished ✅</div>}
    </div>
  )
}
