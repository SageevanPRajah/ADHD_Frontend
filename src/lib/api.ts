const API = import.meta.env.VITE_API_BASE_URL as string

export async function startSession(meta: any) {
  const r = await fetch(`${API}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json() as Promise<{ sessionId: string }>
}

export async function uploadVideo(sessionId: string, blob: Blob) {
  const form = new FormData()
  form.append('file', blob, 'webcam.webm')
  const r = await fetch(`${API}/session/${sessionId}/upload_video`, {
    method: 'POST',
    body: form,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export function downloadZipUrl(sessionId: string) {
  return `${API}/session/${sessionId}/download_zip`
}
