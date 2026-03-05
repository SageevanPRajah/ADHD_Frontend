/**
 * Simple affine calibration:
 *   screen = A * gaze + b
 * Fit using least squares from (gaze_x,gaze_y) -> (screen_x,screen_y)
 * Good enough for research prototype; you can replace with polynomial mapping later.
 */
export type CalibSample = { gaze_x: number; gaze_y: number; screen_x: number; screen_y: number; valid: boolean }

export type AffineModel = {
  a11: number; a12: number; a21: number; a22: number;
  b1: number; b2: number;
}

export function fitAffine(samples: CalibSample[]): AffineModel | null {
  const s = samples.filter(x => x.valid)
  if (s.length < 6) return null

  // Solve for x: [gx gy 1] * [a11 a12 b1]^T = sx
  // and for y: [gx gy 1] * [a21 a22 b2]^T = sy
  const X = s.map(p => [p.gaze_x, p.gaze_y, 1])
  const sx = s.map(p => p.screen_x)
  const sy = s.map(p => p.screen_y)

  const solve = (y: number[]) => {
    // normal eq: (X^T X) w = X^T y  (3x3)
    const XtX = [[0,0,0],[0,0,0],[0,0,0]]
    const Xty = [0,0,0]
    for (let i=0;i<X.length;i++){
      const r=X[i]
      for (let a=0;a<3;a++){
        Xty[a] += r[a]*y[i]
        for (let b=0;b<3;b++){
          XtX[a][b] += r[a]*r[b]
        }
      }
    }
    // invert 3x3 (small, explicit)
    const m = XtX
    const det =
      m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) -
      m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) +
      m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
    if (Math.abs(det) < 1e-9) return null
    const inv = [
      [(m[1][1]*m[2][2]-m[1][2]*m[2][1])/det, (m[0][2]*m[2][1]-m[0][1]*m[2][2])/det, (m[0][1]*m[1][2]-m[0][2]*m[1][1])/det],
      [(m[1][2]*m[2][0]-m[1][0]*m[2][2])/det, (m[0][0]*m[2][2]-m[0][2]*m[2][0])/det, (m[0][2]*m[1][0]-m[0][0]*m[1][2])/det],
      [(m[1][0]*m[2][1]-m[1][1]*m[2][0])/det, (m[0][1]*m[2][0]-m[0][0]*m[2][1])/det, (m[0][0]*m[1][1]-m[0][1]*m[1][0])/det],
    ]
    const w = [
      inv[0][0]*Xty[0] + inv[0][1]*Xty[1] + inv[0][2]*Xty[2],
      inv[1][0]*Xty[0] + inv[1][1]*Xty[1] + inv[1][2]*Xty[2],
      inv[2][0]*Xty[0] + inv[2][1]*Xty[1] + inv[2][2]*Xty[2],
    ]
    return w
  }

  const wx = solve(sx); const wy = solve(sy)
  if (!wx || !wy) return null
  return { a11: wx[0], a12: wx[1], b1: wx[2], a21: wy[0], a22: wy[1], b2: wy[2] }
}

export function applyAffine(m: AffineModel | null, gaze_x: number, gaze_y: number): {x:number;y:number} | null {
  if (!m) return null
  return {
    x: m.a11*gaze_x + m.a12*gaze_y + m.b1,
    y: m.a21*gaze_x + m.a22*gaze_y + m.b2
  }
}
