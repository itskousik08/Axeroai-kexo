'use client'
import { useState } from 'react'
import { NodeBase } from '../ui/NodeBase'
import { Box } from '@/lib/database.types'
import { useCanvasStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { FiYoutube, FiPlay } from 'react-icons/fi'

function extractVideoId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] || null
}

export function YoutubeNode({ box }: { box: Box }) {
  const { updateBox } = useCanvasStore()
  const supabase = createClient()
  const [url, setUrl] = useState(box.content || '')
  const [editing, setEditing] = useState(!box.content)
  const [playing, setPlaying] = useState(false)

  const videoId = extractVideoId(url)
  const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null

  async function saveUrl(val: string) {
    const vid = extractVideoId(val)
    if (!vid) return
    updateBox(box.id, { content: val, metadata: { videoId: vid } })
    await supabase.from('boxes').update({ content: val, metadata: { videoId: vid } }).eq('id', box.id)
    setEditing(false)
  }

  return (
    <NodeBase box={box} headerLabel="YouTube" headerColor="text-red-400" minWidth={280} disableResize>
      {editing || !videoId ? (
        <div>
          <input
            autoFocus
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-red-400/50 transition-colors mb-2"
            placeholder="Paste YouTube URL…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveUrl(url)}
            onBlur={() => url && saveUrl(url)}
          />
          <p className="text-white/20 text-[10px]">Press Enter to confirm</p>
        </div>
      ) : playing ? (
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div
          className="relative w-full rounded-xl overflow-hidden cursor-pointer group"
          style={{ aspectRatio: '16/9' }}
          onClick={() => setPlaying(true)}
        >
          <img src={thumb!} alt="thumbnail" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <FiPlay className="text-white translate-x-0.5" size={20} />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <FiYoutube size={11} className="text-red-400" />
          <span className="text-white/30 text-[10px] truncate max-w-[160px]">{url}</span>
        </div>
        <button onClick={() => { setEditing(true); setPlaying(false) }} className="text-white/20 hover:text-white/60 text-[10px] transition-colors">change</button>
      </div>
    </NodeBase>
  )
}
