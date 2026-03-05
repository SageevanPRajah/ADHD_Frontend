import { useEffect, useRef } from 'react'

export function useStage() {
  const canvasRef = useRef<HTMLCanvasElement|null>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const fit = () => {
      c.width = Math.floor(c.clientWidth * (window.devicePixelRatio || 1))
      c.height = Math.floor(c.clientHeight * (window.devicePixelRatio || 1))
      const ctx = c.getContext('2d')!
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return canvasRef
}
