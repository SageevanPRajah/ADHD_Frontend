import React, { useEffect, useMemo, useState } from 'react'
import { useStage } from '../lib/useStage'

type Props = { durationMs: number; onEvent: (name: string, payload?: any)=>void; onDone: () => void }

type Fruit = { id:string; src:string; x:number; y:number; side:'left'|'right'; tOn:number; isTarget:boolean; caught:boolean }

export default function Game2FruitCatching({ durationMs, onEvent, onDone }: Props){
  const canvasRef = useStage()
  const bg = useMemo(() => { const i=new Image(); i.src='/assets/garden.png'; return i }, [])
  const basket = useMemo(() => { const i=new Image(); i.src='/assets/emptyBasket.png'; return i }, [])
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const nonRed = useMemo(() => [
    '/assets/fruits/nonRedBannana.png',
    '/assets/fruits/nonRedGrapes.png',
    '/assets/fruits/nonRedJack.png',
    '/assets/fruits/nonRedMango.png',
    '/assets/fruits/nonRedOrange.png',
    '/assets/fruits/nonRedPine.png',
    '/assets/fruits/nonRedWatermelon.png',
  ], [])
  const target = '/assets/fruits/redStrawberry.png'

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const start = performance.now()
    onEvent('game_start', { game: 2 })

    const fruits: Fruit[] = []
    const imgs = new Map<string, HTMLImageElement>()
    const getImg = (src:string) => {
      if (imgs.has(src)) return imgs.get(src)!
      const i=new Image(); i.src=src; imgs.set(src,i); return i
    }
    const basketPos = { x: c.clientWidth/2, y: c.clientHeight*0.72 }

    const spawn = () => {
      const isTarget = Math.random() < 0.28
      const side = Math.random() < 0.5 ? 'left' : 'right'
      const src = isTarget ? target : nonRed[Math.floor(Math.random()*nonRed.length)]
      const id = `f_${Date.now()}_${Math.random().toString(16).slice(2)}`
      const x = side==='left' ? c.clientWidth*0.22 : c.clientWidth*0.78
      const y = c.clientHeight*0.30 + Math.random()*c.clientHeight*0.25
      fruits.push({ id, src, x, y, side, tOn: performance.now(), isTarget, caught:false })
      onEvent('target_on', { game:2, trial_id:id, side, isTarget, x, y })
    }

    let nextSpawn = performance.now() + 600
    const draw = () => {
      const w = c.clientWidth, h=c.clientHeight
      ctx.clearRect(0,0,w,h)
      if (bg.complete) ctx.drawImage(bg,0,0,w,h)
      else { ctx.fillStyle='#0b132b'; ctx.fillRect(0,0,w,h) }

      // basket
      const bImg = basket
      if (bImg.complete){
        const bw = 180, bh = 140
        ctx.drawImage(bImg, basketPos.x-bw/2, basketPos.y-bh/2, bw, bh)
      }

      // fruits
      for (const f of fruits){
        if (f.caught) continue
        const img = getImg(f.src)
        const s = 84
        if (img.complete) ctx.drawImage(img, f.x-s/2, f.y-s/2, s, s)
      }

      // hud
      const t = performance.now()-start
      const left = Math.max(0, Math.ceil((durationMs - t)/1000))
      ctx.fillStyle='#e5e7eb'; ctx.font='700 20px system-ui'
      ctx.fillText(`Time: ${left}s`, 18, 30)
      ctx.fillText(`Score: ${score}`, 18, 55)

      if (performance.now() >= nextSpawn){
        spawn()
        nextSpawn = performance.now() + (380 + Math.random()*650)
      }

      if (t >= durationMs){
        onEvent('game_end', { game: 2, score })
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

      // allow "near fruit" catch
      const HIT_R = 70

      // find closest fruit
      let best: Fruit | null = null
      let bestD = 1e9
      for (const f of fruits){
        if (f.caught) continue
        const d = Math.hypot(mx-f.x, my-f.y)
        if (d < bestD){ bestD=d; best=f }
      }
      if (!best || bestD > HIT_R) return

      const rt = Math.round(performance.now() - best.tOn)
      if (best.isTarget){
        best.caught = true
        setScore(s => s + 1)
        onEvent('response', { game:2, trial_id:best.id, correct:1, rt_ms:rt, x:mx, y:my, hit:true })
        onEvent('fruit_catch', { trial_id:best.id })
      } else {
        onEvent('response', { game:2, trial_id:best.id, correct:0, rt_ms:rt, x:mx, y:my, hit:true })
      }
    }
    c.addEventListener('click', onClick)
    return () => { c.removeEventListener('click', onClick) }
  }, [canvasRef, bg, basket, durationMs, nonRed, score, onEvent])

  return (
    <div style={{height:'100%'}}>
      <canvas ref={canvasRef} className="stage" />
      {done && <div className="card" style={{position:'absolute', top:16, left:'50%', transform:'translateX(-50%)'}}>Game 2 finished ✅</div>}
    </div>
  )
}
