export type Condition = 'ADHD' | 'Control' | 'Unsure'

export type SessionMeta = {
  participantId: string
  age: number
  condition: Condition
}

export type WsClientMsg =
  | { type: 'hello'; t_ms?: number; meta: SessionMeta }
  | { type: 'gaze'; t_ms: number; x: number; y: number; valid: boolean; raw?: any }
  | { type: 'event'; t_ms: number; name: string; payload?: any }
  | { type: 'calib'; t_ms: number; screen_x: number; screen_y: number; gaze_x: number; gaze_y: number; valid: boolean }
  | { type: 'done'; t_ms?: number }

export type WsServerMsg =
  | { type: 'ack'; sessionId: string }
  | { type: 'error'; message: string }
