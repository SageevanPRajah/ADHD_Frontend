import React, { useCallback, useEffect, useRef, useState } from 'react'
const EyeTrackerPanel = React.lazy(() => import('./components/EyeTrackerPanel'));
import InstructionModal from './components/InstructionModal'
import Calibration from './games/Calibration'
import Game1BubbleButterfly from './games/Game1BubbleButterfly'
import Game2FruitCatching from './games/Game2FruitCatching'
import Game3AntiTreasure from './games/Game3AntiTreasure'
import Game4FixationStar from './games/Game4FixationStar'
import Game5PursuitShip from './games/Game5PursuitShip'
import { connectWs } from './lib/ws'
import type { Condition, SessionMeta } from './lib/protocol'
import type { AffineModel } from './lib/calibration'
import { startSession, uploadVideo, downloadZipUrl } from './lib/api'

type Step = 'consent' | 'calibration' | 'g1' | 'g2' | 'g3' | 'g4' | 'g5' | 'finish'

function Header({title}:{title:string}){ return <h2 style={{margin:'0 0 8px 0'}}>{title}</h2> }

export default function App(){
  const [meta, setMeta] = useState<SessionMeta>({ participantId:'', age: 8, condition:'Unsure' })
  const [sessionId, setSessionId] = useState<string>('')
  const [wsStatus, setWsStatus] = useState<'disconnected'|'connecting'|'connected'>('disconnected')
  const [eyeEnabled, setEyeEnabled] = useState(false);
  const [showEyePreview, setShowEyePreview] = useState(false)
  const [affine, setAffine] = useState<AffineModel|null>(null)
  const [calibrationStatus, setCalibrationStatus] = useState<'not_started'|'ready'|'failed'|'skipped'>('not_started')
  const wsRef = useRef<ReturnType<typeof connectWs> | null>(null)

  const [step, setStep] = useState<Step>('consent')

  // latest raw gaze norms (from EyeTracker raw)
  const latestRaw = useRef<{xNorm?:number;yNorm?:number;valid:boolean}>({ valid:false })

  // recorder
  const mediaRecorderRef = useRef<MediaRecorder|null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const [showInstr, setShowInstr] = useState(false)
  const [pendingStep, setPendingStep] = useState<Step>('calibration')
  const [instr, setInstr] = useState({title:'', image:'', en:'', si:'', ta:''})

  const openInstr = useCallback((next: Step, title:string, image:string, en:string, si:string, ta:string) => {
    setPendingStep(next)
    setInstr({title, image, en, si, ta})
    setShowInstr(true)
  }, [])

  const sendEvent = useCallback((name:string, payload?:any) => {
    const t_ms = performance.now()
    wsRef.current?.send({ type:'event', t_ms, name, payload })
  }, [])

  const sendCalib = useCallback((s: any) => {
    const t_ms = performance.now()
    wsRef.current?.send({ type:'calib', t_ms, ...s })
  }, [])

  const startWebcamRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false })
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => { stream.getTracks().forEach(t=>t.stop()) }
    rec.start()
    mediaRecorderRef.current = rec
  }

  const stopWebcamRecording = async () => {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === 'recording') rec.stop()
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    await uploadVideo(sessionId, blob)
  }

  const finalize = async () => {
    sendEvent('session_done', {})
    wsRef.current?.send({ type:'done', t_ms: performance.now() })
    wsRef.current?.close()
    await stopWebcamRecording()
  }

  const connect = async () => {
    setWsStatus('connecting')
    const { sessionId: sid } = await startSession(meta)
    setSessionId(sid)
    setAffine(null)
    setCalibrationStatus('not_started')

    const conn = connectWs(sid, () => {})
    wsRef.current = conn
    conn.ws.onopen = () => {
      setWsStatus('connected')
      conn.send({ type:'hello', t_ms: performance.now(), meta })
    }
    conn.ws.onclose = () => setWsStatus('disconnected')
  }

  // eye tracking callback
  const onGaze = (g: {t_ms:number; x:number; y:number; valid:boolean; raw?:any}) => {
    latestRaw.current = { xNorm: g.raw?.xNorm, yNorm: g.raw?.yNorm, valid: g.valid }
    wsRef.current?.send({ type:'gaze', t_ms: g.t_ms, x: g.x, y: g.y, valid: g.valid, raw: g.raw })
  }

  const startSessionFlow = async () => {
    if (!meta.participantId.trim()) { alert('Enter User_ID (Participant ID)'); return }
    if (!meta.age || meta.age < 3 || meta.age > 18) { alert('Enter age 3..18'); return }
    await connect()
    await startWebcamRecording()
    sendEvent('session_start', meta)
    setStep('calibration')
    alert('Session started. Do calibration first.')
  }

  const gotoWithInstr = useCallback((next: Step) => {
    if (next==='g1'){
      openInstr('g1','Game 1 — Pop the bubbles','/assets/plainSky.png',
        'Pop bubbles to free butterflies. Click the bubble to release the butterfly. Play for 30 seconds.',
        'බබල් එක මත ක්ලික් කර පපයන්න. බටර්ෆ්ලයි එක නිදහස් කරන්න. තත්පර 30ක් ක්‍රීඩා කරන්න.',
        'குமிழிகளை கிளிக் செய்து பட்டாம்பூச்சிகளை விடுவிக்கவும். 30 விநாடிகள் விளையாடுங்கள்.'
      ); return
    }
    if (next==='g2'){
      openInstr('g2','Game 2 — Catch the red fruit','/assets/fruits/redStrawberry.png',
        'Click the red strawberry when it appears. You can click near the fruit (kid-friendly). 45 seconds.',
        'රතු ස්ට්‍රෝබෙරි පෙනෙන විට ක්ලික් කරන්න. ගෙඩිය අසල ක්ලික් කළත් අල්ලාගන්න පුළුවන්. තත්පර 45ක්.',
        'சிகப்பு ஸ்ட்ராபெர்ரி தோன்றும் போது கிளிக் செய்யுங்கள். பழத்தின் அருகே கிளிக் செய்தாலும் சரி. 45 விநாடிகள்.'
      ); return
    }
    if (next==='g3'){
      openInstr('g3','Game 3 — Catch treasure (don’t click alien)','/assets/alien.png',
        'When the alien appears on one side, the treasure appears on the opposite side. Click the treasure. If you click the alien, you lose that trial. 45 seconds.',
        'එක පැත්තක එලියන් පෙනුනොත් අනෙක් පැත්තේ නිධානය පෙනේ. නිධානය ක්ලික් කරන්න. එලියන් ක්ලික් කලොත් වැරදියි. තත්පර 45ක්.',
        'ஒரு பக்கத்தில் அயலன் வந்தால் எதிர்பக்கத்தில் புதையல் வரும். புதையலை கிளிக் செய்யுங்கள். அயலனை கிளிக் செய்தால் தவறு. 45 விநாடிகள்.'
      ); return
    }
    if (next==='g4'){
      openInstr('g4','Game 4 — Fixation (look at the star)','/assets/star/star1.png',
        'Keep your eyes on the star at the center. 20 seconds.',
        'මැද තියෙන තාරකාවට නෙත් තබාගෙන ඉන්න. තත්පර 20ක්.',
        'மையத்தில் இருக்கும் நட்சத்திரத்தை பார்த்துக்கொண்டிருக்கவும். 20 விநாடிகள்.'
      ); return
    }
    if (next==='g5'){
      openInstr('g5','Game 5 — Follow the spaceship','/assets/spaceShip.png',
        'Follow the moving spaceship with your eyes. 20 seconds.',
        'ගමන් කරන නාවිකයාව නෙත් වලින් අනුගමනය කරන්න. තත්පර 20ක්.',
        'நகரும் விண்கலத்தை கண்களால் பின்தொடருங்கள். 20 விநாடிகள்.'
      ); return
    }
    setStep(next)
  }, [openInstr])

  const onInstructionOk = useCallback(() => {
    setShowInstr(false)
    setStep(pendingStep)
    sendEvent('step_start', { step: pendingStep })
  }, [pendingStep, sendEvent])

  const renderStage = () => {
    if (step==='consent'){
      return (
        <div style={{padding:16}}>
          <div className="card" style={{maxWidth:860}}>
            <h2 style={{marginTop:0}}>Consent & Setup</h2>
            <p style={{opacity:.9}}>
              This research task uses the webcam to estimate gaze and records a short webcam video during the tasks.
              Please ensure guardian consent and child assent before starting.
            </p>
            <ul style={{opacity:.9}}>
              <li>Good lighting (no bright backlight)</li>
              <li>Face centered, ~50–70cm from camera</li>
              <li>Try not to move chair during tasks</li>
            </ul>
            <button className="btn primary" onClick={()=>setStep('calibration')}>I Understand</button>
          </div>
        </div>
      )
    }

    if (step==='calibration'){
      return (
        <div style={{height:'100%', position:'relative'}}>
          <Calibration
            onEvent={(n,p)=>sendEvent(n,p)}
            onCalibSample={sendCalib}
            getLatestGaze={() => latestRaw.current}
            onModel={(m) => {
              setAffine(m)
              setCalibrationStatus(m ? 'ready' : 'failed')
              sendEvent('calib_model', { ok: !!m })
            }}
          />
          <div className="card" style={{position:'absolute', bottom: 16, left: 16, maxWidth: 720}}>
            <div style={{fontWeight:800}}>Next</div>
            <div style={{opacity:.85, marginTop:6}}>
              Try <b>9-point calibration</b> first. If it fails, you can still continue to gameplay without changing the existing game logic.
            </div>
            <div style={{marginTop:10, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap'}}>
              <button className="btn secondary" onClick={()=>gotoWithInstr('g1')} disabled={wsStatus!=='connected'}>Start Game 1</button>
              <button
                className="btn ghost"
                onClick={() => {
                  setCalibrationStatus('skipped')
                  sendEvent('calib_skipped', { reason: 'user_continue_without_calibration' })
                  gotoWithInstr('g1')
                }}
                disabled={wsStatus!=='connected'}
              >
                Continue Without Calibration
              </button>
              <span className="pill">Calibration model: {affine ? 'ready' : 'not ready'}</span>
              <span className="pill">Status: {calibrationStatus.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      )
    }

    if (step==='g1') return <Game1BubbleButterfly durationMs={30000} onEvent={sendEvent} onDone={()=>gotoWithInstr('g2')} />
    if (step==='g2') return <Game2FruitCatching durationMs={45000} onEvent={sendEvent} onDone={()=>gotoWithInstr('g3')} />
    if (step==='g3') return <Game3AntiTreasure durationMs={45000} onEvent={sendEvent} onDone={()=>gotoWithInstr('g4')} />
    if (step==='g4') return <Game4FixationStar durationMs={20000} onEvent={sendEvent} onDone={()=>gotoWithInstr('g5')} />
    if (step==='g5') return <Game5PursuitShip durationMs={20000} onEvent={sendEvent} onDone={async ()=>{ setStep('finish'); await finalize(); }} />

    if (step==='finish'){
      return (
        <div style={{padding:16}}>
          <div className="card" style={{maxWidth:760}}>
            <h2 style={{marginTop:0}}>Finished ✅</h2>
            <p style={{opacity:.9}}>
              Download a ZIP containing webcam video + feature CSV files.
            </p>
            <div className="row">
              <a className="btn primary" href={downloadZipUrl(sessionId)} target="_blank" rel="noreferrer">Download ZIP</a>
            </div>
            <div style={{marginTop:10, fontSize:12, opacity:.85}}>
              If download fails, refresh and try again (Railway cold start can delay first request).
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="page">
      <aside className="sidebar">
        <Header title="🎮 ADHD Eye Tasks (Final)" />

        <div className="card">
          <div style={{fontWeight:800, marginBottom:8}}>Participant</div>
          <div className="row" style={{marginBottom:10}}>
            <input placeholder="User_ID / Participant ID" value={meta.participantId}
              onChange={e=>setMeta(m=>({...m, participantId: e.target.value}))} />
          </div>
          <div className="row" style={{marginBottom:10}}>
            <input type="number" min={3} max={18} placeholder="Child age" value={meta.age}
              onChange={e=>setMeta(m=>({...m, age: Number(e.target.value)}))} />
            <select value={meta.condition} onChange={e=>setMeta(m=>({...m, condition: e.target.value as Condition}))}>
              <option value="ADHD">ADHD</option>
              <option value="Control">Control</option>
              <option value="Unsure">Unsure</option>
            </select>
          </div>
          <div className="row">
            <button className="btn primary" onClick={startSessionFlow} disabled={wsStatus==='connected'}>Start Session</button>
            <span className="pill">{wsStatus}</span>
          </div>
          {sessionId && <div style={{marginTop:8, fontSize:12, opacity:.85}}>Session: <span className="pill">{sessionId}</span></div>}
        </div>

        <div className="card" style={{marginTop:10}}>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div><strong>Controls</strong></div>
            <div className="pill">Step: {step}</div>
          </div>
          <div className="row" style={{marginTop:10}}>
            <button className="btn ghost" onClick={()=>setStep('calibration')} disabled={wsStatus!=='connected'}>Calibration</button>
            <button className="btn ghost" onClick={()=>gotoWithInstr('g1')} disabled={wsStatus!=='connected'}>Games</button>
          </div>
          <div className="row" style={{marginTop:10}}>
            <label className="row" style={{gap:8}}>
              <input type="checkbox" checked={eyeEnabled} onChange={e=>setEyeEnabled(e.target.checked)} />
              Eye tracking ON
            </label>
          </div>
          <div className="row" style={{marginTop:8}}>
            <label className="row" style={{gap:8}}>
              <input type="checkbox" checked={showEyePreview} onChange={e=>setShowEyePreview(e.target.checked)} />
              Show preview
            </label>
          </div>
        </div>

        <div style={{marginTop:10}}>
          {eyeEnabled && (
            <EyeTrackerPanel
              enabled={eyeEnabled}
              showPreview={showEyePreview && (import.meta.env.VITE_ENABLE_EYE_PANEL === 'true')}
              affine={affine}
              onGaze={onGaze}
            />
          )}
        </div>

        <div className="card" style={{marginTop:10, fontSize:12, opacity:.85}}>
          Backend: Railway (Docker). Frontend: Vercel. Configure URLs in <b>.env</b>.
        </div>
      </aside>

      <main className="stageWrap">
        {renderStage()}
      </main>

      <InstructionModal
        open={showInstr}
        title={instr.title}
        image={instr.image}
        en={instr.en}
        si={instr.si}
        ta={instr.ta}
        onOk={onInstructionOk}
      />
    </div>
  )
}
