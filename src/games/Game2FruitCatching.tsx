import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStage } from '../lib/useStage'

type Props = { durationMs: number; onEvent: (name: string, payload?: any)=>void; onDone: () => void }

type Fruit = { id:string; src:string; x:number; y:number; side:'left'|'right'; tOn:number; isTarget:boolean; caught:boolean }

export default function Game2FruitCatching({ durationMs, onEvent, onDone }: Props){
  const canvasRef = useStage()
  const bg = useMemo(() => { const i=new Image(); i.src='/assets/garden.png'; return i }, [])
  const basket = useMemo(() => { const i=new Image(); i.src='/assets/emptyBasket.png'; return i }, [])
  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
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
    let finished = false
    let rafId = 0

    onEvent('game_start', { game: 2 })

    const imgs = new Map<string, HTMLImageElement>()
    const getImg = (src:string) => {
      if (imgs.has(src)) return imgs.get(src)!
      const i=new Image(); i.src=src; imgs.set(src,i); return i
    }

    const basketPos = { x: c.clientWidth/2, y: c.clientHeight*0.72 }
    const laneX = { left: c.clientWidth*0.22, right: c.clientWidth*0.78 }
    const laneY = c.clientHeight*0.40
    let activeFruit: Fruit | null = null
    let activeUntil = 0
    let nextSide: 'left' | 'right' = 'left'

    const finishGame = () => {
      if (finished) return
      finished = true
      onEvent('game_end', { game: 2, score: scoreRef.current })
      setDone(true)
      onDone()
    }

    const spawnFruit = () => {
      const isTarget = Math.random() < 0.28
      const side = nextSide
      nextSide = nextSide === 'left' ? 'right' : 'left'
      const src = isTarget ? target : nonRed[Math.floor(Math.random()*nonRed.length)]
      const id = `f_${Date.now()}_${Math.random().toString(16).slice(2)}`
      activeFruit = {
        id,
        src,
        side,
        x: laneX[side],
        y: laneY,
        tOn: performance.now(),
        isTarget,
        caught:false,
      }
      activeUntil = performance.now() + 950
      onEvent('target_on', { game:2, trial_id:id, side, isTarget, x:activeFruit.x, y:activeFruit.y })
    }

    spawnFruit()

    const draw = () => {
      if (finished) return

      const w = c.clientWidth, h=c.clientHeight
      ctx.clearRect(0,0,w,h)
      if (bg.complete) ctx.drawImage(bg,0,0,w,h)
      else { ctx.fillStyle='#0b132b'; ctx.fillRect(0,0,w,h) }

      if (basket.complete){
        const bw = 180, bh = 140
        ctx.drawImage(basket, basketPos.x-bw/2, basketPos.y-bh/2, bw, bh)
      }

      if (activeFruit && !activeFruit.caught){
        const img = getImg(activeFruit.src)
        const s = 84
        if (img.complete) ctx.drawImage(img, activeFruit.x-s/2, activeFruit.y-s/2, s, s)
      }

      const t = performance.now()-start
      const left = Math.max(0, Math.ceil((durationMs - t)/1000))
      ctx.fillStyle='#e5e7eb'; ctx.font='700 20px system-ui'
      ctx.fillText(`Time: ${left}s`, 18, 30)
      ctx.fillText(`Score: ${scoreRef.current}`, 18, 55)

      if ((!activeFruit || activeFruit.caught || performance.now() >= activeUntil) && t < durationMs){
        spawnFruit()
      }

      if (t >= durationMs){
        finishGame()
        return
      }

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    const onClick = (e: MouseEvent) => {
      if (finished || !activeFruit || activeFruit.caught) return

      const rect = c.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const HIT_R = 70
      const d = Math.hypot(mx-activeFruit.x, my-activeFruit.y)
      if (d > HIT_R) return

      const rt = Math.round(performance.now() - activeFruit.tOn)
      if (activeFruit.isTarget){
        activeFruit.caught = true
        scoreRef.current += 1
        setScore(scoreRef.current)
        onEvent('response', { game:2, trial_id:activeFruit.id, correct:1, rt_ms:rt, x:mx, y:my, hit:true })
        onEvent('fruit_catch', { trial_id:activeFruit.id })
      } else {
        activeFruit.caught = true
        onEvent('response', { game:2, trial_id:activeFruit.id, correct:0, rt_ms:rt, x:mx, y:my, hit:true })
      }
    }

    c.addEventListener('click', onClick)
    return () => {
      finished = true
      cancelAnimationFrame(rafId)
      c.removeEventListener('click', onClick)
    }
  }, [canvasRef, bg, basket, durationMs, nonRed, onEvent, onDone, target])

  return (
    <div style={{height:'100%'}}>
      <canvas ref={canvasRef} className="stage" />
      {done && <div className="card" style={{position:'absolute', top:16, left:'50%', transform:'translateX(-50%)'}}>Game 2 finished ✅</div>}
    </div>
  )
}
