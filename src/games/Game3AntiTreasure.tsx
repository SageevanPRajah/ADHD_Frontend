import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStage } from '../lib/useStage'

type Props = { durationMs: number; onEvent: (name: string, payload?: any)=>void; onDone: () => void }

type Trial = {
  id: string
  cueSide: 'left'|'right'
  tCue: number
  tTarget: number
  clicked: boolean
  correct: boolean
}

export default function Game3AntiTreasure({ durationMs, onEvent, onDone }: Props){
  const canvasRef = useStage()
  const bg = useMemo(() => { const i=new Image(); i.src='/assets/space.png'; return i }, [])
  const rover = useMemo(() => { const i=new Image(); i.src='/assets/spaceRover.png'; return i }, [])
  const alien = useMemo(() => { const i=new Image(); i.src='/assets/alien.png'; return i }, [])
  const treasure = useMemo(() => { const i=new Image(); i.src='/assets/treasure.png'; return i }, [])
  const blast = useMemo(() => { const i=new Image(); i.src='/assets/blast.png'; return i }, [])
  const [done, setDone] = useState(false)
  const [blastOn, setBlastOn] = useState(false)
  const blastOnRef = useRef(false)
  const [coins, setCoins] = useState(0)
  const coinsRef = useRef(0)
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
    let blastTimer: number | null = null

    onEventRef.current('game_start', { game: 3 })

    let current: Trial | null = null
    let phase: 'fix'|'cue'|'resp' = 'fix'
    let nextAt = performance.now() + 700

    const roverPos = { x: c.clientWidth/2, y: c.clientHeight*0.55 }
    const leftPos = { x: c.clientWidth*0.25, y: c.clientHeight*0.55 }
    const rightPos = { x: c.clientWidth*0.75, y: c.clientHeight*0.55 }

    const finishGame = () => {
      if (finished) return
      finished = true
      onEventRef.current('game_end', { game: 3, coins: coinsRef.current })
      setDone(true)
      onDoneRef.current()
    }

    const newTrial = () => {
      const cueSide = Math.random()<0.5 ? 'left' : 'right'
      const id = `anti_${Date.now()}_${Math.random().toString(16).slice(2)}`
      current = { id, cueSide, tCue: 0, tTarget: 0, clicked:false, correct:false }
      phase='fix'
      nextAt = performance.now() + (600 + Math.random()*450)
      onEventRef.current('trial_start', { game:3, trial_id:id, cueSide })
    }

    newTrial()

    const draw = () => {
      if (finished) return

      const w = c.clientWidth, h=c.clientHeight
      ctx.clearRect(0,0,w,h)
      if (bg.complete) ctx.drawImage(bg,0,0,w,h)
      else { ctx.fillStyle='#0b132b'; ctx.fillRect(0,0,w,h) }

      if (rover.complete) ctx.drawImage(rover, roverPos.x-110, roverPos.y-80, 220, 160)
      if (blastOnRef.current && blast.complete) ctx.drawImage(blast, roverPos.x-90, roverPos.y-110, 180, 180)

      ctx.fillStyle='#e5e7eb'; ctx.font='700 44px system-ui'; ctx.textAlign='center'
      ctx.fillText('+', w/2, h*0.35)

      const t = performance.now()
      if (!current) newTrial()

      if (phase==='fix' && t >= nextAt){
        phase='cue'
        current!.tCue = t
        onEventRef.current('cue_on', { game:3, trial_id:current!.id, side: current!.cueSide })
        nextAt = t + 380
      }

      if (phase==='cue'){
        const pos = current!.cueSide==='left' ? leftPos : rightPos
        if (alien.complete) ctx.drawImage(alien, pos.x-70, pos.y-70, 140, 140)
        if (t >= nextAt){
          phase='resp'
          current!.tTarget = t
          const targetSide = current!.cueSide==='left' ? 'right' : 'left'
          const p = targetSide==='left' ? leftPos : rightPos
          onEventRef.current('target_on', { game:3, trial_id:current!.id, side: targetSide, x:p.x, y:p.y })
          nextAt = t + 1200
        }
      }

      if (phase==='resp'){
        const targetSide = current!.cueSide==='left' ? 'right' : 'left'
        const p = targetSide==='left' ? leftPos : rightPos
        if (treasure.complete) ctx.drawImage(treasure, p.x-62, p.y-62, 124, 124)
        if (t >= nextAt){
          onEventRef.current('trial_end', { game:3, trial_id:current!.id, reason:'timeout', correct:0 })
          newTrial()
        }
      }

      const elapsed = t - start
      const left = Math.max(0, Math.ceil((durationMs - elapsed)/1000))
      ctx.fillStyle='#e5e7eb'; ctx.font='700 20px system-ui'; ctx.textAlign='left'
      ctx.fillText(`Time: ${left}s`, 18, 30)
      ctx.fillText(`Coins: ${coinsRef.current}`, 18, 55)

      if (elapsed >= durationMs){
        finishGame()
        return
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)

    const onClick = (e: MouseEvent) => {
      if (finished || !current) return
      const rect = c.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const leftArea = { x: leftPos.x, y: leftPos.y }
      const rightArea = { x: rightPos.x, y: rightPos.y }
      const HIT_R = 80

      const dL = Math.hypot(mx-leftArea.x, my-leftArea.y)
      const dR = Math.hypot(mx-rightArea.x, my-rightArea.y)

      if (phase==='resp'){
        const targetSide = current.cueSide==='left' ? 'right' : 'left'
        const dT = targetSide==='left' ? dL : dR
        const dAlien = current.cueSide==='left' ? dL : dR
        const rt = Math.round(performance.now() - current.tTarget)

        if (dT <= HIT_R){
          coinsRef.current += 1
          setCoins(coinsRef.current)
          onEventRef.current('response', { game:3, trial_id:current.id, correct:1, rt_ms:rt })
          onEventRef.current('trial_end', { game:3, trial_id:current.id, reason:'click', correct:1 })
          newTrial()
        } else if (dAlien <= HIT_R){
          blastOnRef.current = true
          setBlastOn(true)
          if (blastTimer) window.clearTimeout(blastTimer)
          blastTimer = window.setTimeout(()=>{ blastOnRef.current = false; setBlastOn(false) }, 450)
          onEventRef.current('response', { game:3, trial_id:current.id, correct:0, rt_ms:rt, clickedAlien:true })
          onEventRef.current('trial_end', { game:3, trial_id:current.id, reason:'clicked_alien', correct:0 })
          newTrial()
        }
      }
    }
    c.addEventListener('click', onClick)
    return () => {
      finished = true
      cancelAnimationFrame(rafId)
      if (blastTimer) window.clearTimeout(blastTimer)
      c.removeEventListener('click', onClick)
    }
  }, [canvasRef, bg, rover, alien, treasure, blast, durationMs])

  return (
    <div style={{height:'100%'}}>
      <canvas ref={canvasRef} className="stage" />
      {done && <div className="card" style={{position:'absolute', top:16, left:'50%', transform:'translateX(-50%)'}}>Game 3 finished ✅</div>}
    </div>
  )
}
