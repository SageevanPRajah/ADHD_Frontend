import React from 'react'

type Props = {
  open: boolean
  title: string
  image?: string
  en: string
  si: string
  ta: string
  onOk: () => void
}

export default function InstructionModal({ open, title, image, en, si, ta, onOk }: Props){
  if (!open) return null
  return (
    <div className="modalOverlay">
      <div className="modal card">
        <h2 style={{marginTop:0}}>{title}</h2>
        <div className="grid2">
          <div>
            {image && <img src={image} alt="" style={{width:'100%', borderRadius:12, border:'1px solid #1e2a46'}} />}
            <div style={{marginTop:10, fontSize:13, opacity:.85}}>
              Tip: Keep the face centered and avoid bright backlight.
            </div>
          </div>
          <div>
            <div className="card" style={{background:'#0b132b'}}>
              <div style={{fontWeight:800}}>English</div>
              <div style={{marginTop:6}}>{en}</div>
              <div style={{marginTop:12, fontWeight:800}}>සිංහල</div>
              <div style={{marginTop:6}}>{si}</div>
              <div style={{marginTop:12, fontWeight:800}}>தமிழ்</div>
              <div style={{marginTop:6}}>{ta}</div>
            </div>
            <button className="btn primary" style={{width:'100%', marginTop:10}} onClick={onOk}>OK, Play</button>
          </div>
        </div>
      </div>
    </div>
  )
}
