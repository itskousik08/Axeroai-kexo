'use client'
import { useEffect, useRef, useState } from 'react'
import { NodeBase } from '../ui/NodeBase'
import { Box } from '@/lib/database.types'
import { FiPlay, FiPause, FiMic, FiSquare, FiUpload } from 'react-icons/fi'
import { toast } from 'sonner'
import { useCanvasStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// Mini waveform bars visualization
function MiniWaveform({ playing, barCount = 32 }: { playing: boolean; barCount?: number }) {
  const heights = Array.from({ length: barCount }, (_, i) => {
    const base = Math.sin(i * 0.8) * 0.4 + 0.6
    return Math.max(0.15, base)
  })
  return (
    <div className="flex items-center gap-[2px] h-8 flex-1">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-full transition-all duration-150 ${playing ? 'bg-brand-500' : 'bg-white/20'}`}
          style={{
            height: `${h * 100}%`,
            animationDelay: playing ? `${i * 40}ms` : '0ms',
            animation: playing ? 'wave 1s ease-in-out infinite alternate' : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

export function VoiceNode({ box }: { box: Box }) {
  const { updateBox } = useCanvasStore()
  const supabase = createClient()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(box.duration || 0)
  const [audioUrl, setAudioUrl] = useState(box.url || '')
  const [uploading, setUploading] = useState(false)

  // Playback progress
  useEffect(() => {
    if (!audioRef.current) return
    const audio = audioRef.current
    const onEnd = () => setPlaying(false)
    const onTime = () => setElapsed(audio.currentTime)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('timeupdate', onTime)
    return () => { audio.removeEventListener('ended', onEnd); audio.removeEventListener('timeupdate', onTime) }
  }, [audioUrl])

  function togglePlay() {
    if (!audioUrl || !audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await uploadAudio(blob)
      }
      recorder.start(100)
      setRecording(true)
    } catch {
      toast.error('Microphone permission denied')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    setRecording(false)
  }

  async function uploadAudio(blob: Blob) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', blob, 'voice-note.webm')
      formData.append('type', 'audio')
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { url, publicId, duration: dur } = await res.json()
      setAudioUrl(url)
      setDuration(dur || 0)
      updateBox(box.id, { url, cloudinary_id: publicId, duration: dur })
      await supabase.from('boxes').update({ url, cloudinary_id: publicId, duration: dur }).eq('id', box.id)
      toast.success('Voice note saved')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadAudio(file)
  }

  const progress = duration > 0 ? (elapsed / duration) * 100 : 0

  return (
    <NodeBase box={box} headerLabel="Voice Note" headerColor="text-brand-400" minWidth={260} disableResize>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      {/* Waveform + controls */}
      <div className="bg-white/[0.04] rounded-xl p-3 mb-2">
        {/* Waveform */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={togglePlay}
            disabled={!audioUrl}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              audioUrl
                ? 'bg-brand-500 hover:bg-brand-400 text-black shadow-brand'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {playing ? <FiPause size={13} /> : <FiPlay size={13} className="translate-x-px" />}
          </button>
          <MiniWaveform playing={playing} />
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full bg-brand-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time */}
        <div className="flex justify-between text-[10px] text-white/30 font-mono">
          <span>{formatDuration(elapsed)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Record / Upload */}
      <div className="flex gap-2">
        {recording ? (
          <button
            onClick={stopRecording}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded-xl py-2 text-xs font-medium transition-all"
          >
            <FiSquare size={11} />
            <span className="animate-pulse">Stop</span>
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 rounded-xl py-2 text-xs font-medium transition-all disabled:opacity-40"
          >
            <FiMic size={11} /> Record
          </button>
        )}
        <label className="flex items-center justify-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 rounded-xl py-2 px-3 text-xs font-medium transition-all cursor-pointer">
          {uploading ? <span className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" /> : <FiUpload size={11} />}
          <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      {box.title && <p className="text-white/30 text-[11px] mt-2 truncate">{box.title}</p>}
    </NodeBase>
  )
}
