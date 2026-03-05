import React, { useEffect, useMemo, useState } from 'react'
import { useStage } from '../lib/useStage'

type Props = { durationMs: number; onEvent: (name: string, payload?: any)=>void; onDone: () => void }

type Bubble = { id:string; x:number; y:number; r:number; vx:number; vy:number; butterflyIdx:number; freed:boolean }

export default function Game1BubbleButterfly({ durationMs, onEvent, onDone }: Props){
  const canvasRef = useStage()
  const butterflies = useMemo(() => (
    [1,2,3,4,5,6].map(i => `/assets/butterflyFlying/butterflyFlying${i}.png`)
  ), [])
  const bg = useMemo(() => { const i=new Image(); i.src='/assets/plainSky.png'; return i }, [])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const start = performance.now()
    onEvent('game_start', { game: 1 })

    const bubbles: Bubble[] = Array.from({length: 10}).map((_,k)=>({
      id: `b${k}_${Date.now()}`,
      x: Math.random()*c.clientWidth*0.8 + c.clientWidth*0.1,
      y: Math.random()*c.clientHeight*0.6 + c.clientHeight*0.2,
      r: 34 + Math.random()*10,
      vx: (Math.random()*1.2 - 0.6),
      vy: (Math.random()*1.0 - 0.5),
      butterflyIdx: k % butterflies.length,
      freed: false
    }))

    const imgs = butterflies.map(src => { const i=new Image(); i.src=src; return i })

    const draw = () => {
      const w = c.clientWidth, h=c.clientHeight
      ctx.clearRect(0,0,w,h)
      if (bg.complete) ctx.drawImage(bg,0,0,w,h)
      else { ctx.fillStyle='#0b132b'; ctx.fillRect(0,0,w,h) }

      // move + draw
      for (const b of bubbles){
        if (!b.freed){
          b.x += b.vx; b.y += b.vy
          if (b.x < b.r || b.x > w-b.r) b.vx *= -1
          if (b.y < b.r || b.y > h-b.r) b.vy *= -1

          // bubble
          const g = ctx.createRadialGradient(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.2, b.x, b.y, b.r)
          g.addColorStop(0, 'rgba(255,255,255,0.35)')
          g.addColorStop(1, 'rgba(59,130,246,0.10)')
          ctx.fillStyle=g
          ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill()
          ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=3; ctx.stroke()

          const bi = imgs[b.butterflyIdx]
          if (bi.complete){
            const s = b.r*1.2
            ctx.drawImage(bi, b.x-s/2, b.y-s/2, s, s)
          }
        } else {
          // freed butterfly flies away
          b.y -= 2.2
          const bi = imgs[b.butterflyIdx]
          if (bi.complete){
            const s = b.r*1.1
            ctx.drawImage(bi, b.x-s/2, b.y-s/2, s, s)
          }
        }
      }

      // timer text
      const t = performance.now()-start
      const left = Math.max(0, Math.ceil((durationMs - t)/1000))
      ctx.fillStyle='#e5e7eb'; ctx.font='700 20px system-ui'
      ctx.fillText(`Time: ${left}s`, 18, 30)

      if (t >= durationMs){
        onEvent('game_end', { game: 1 })
        setDone(true)
        onDone()
        return
      }
      requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)

    const onClick = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      for (const b of bubbles){
        if (b.freed) continue
        const d2 = (mx-b.x)**2 + (my-b.y)**2
        if (d2 <= (b.r+14)**2){
          b.freed = true
          onEvent('bubble_pop', { id:b.id, x:b.x, y:b.y })
          break
        }
      }
    }
    c.addEventListener('click', onClick)
    return () => { c.removeEventListener('click', onClick) }
  }, [canvasRef, butterflies, bg, durationMs, onEvent])

  return (
    <div style={{height:'100%'}}>
      <canvas ref={canvasRef} className="stage" />
      {done && <div className="card" style={{position:'absolute', top:16, left:'50%', transform:'translateX(-50%)'}}>Game 1 finished ✅</div>}
    </div>
  )
}
