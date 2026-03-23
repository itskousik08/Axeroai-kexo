'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Box } from '@/lib/database.types'
import { FiZap, FiLock } from 'react-icons/fi'

export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [workspace, setWorkspace] = useState<any>(null)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('share_token', token)
        .eq('is_public', true)
        .single()

      if (!ws) { setError(true); setLoading(false); return }
      setWorkspace(ws)

      const { data: boxData } = await supabase
        .from('boxes').select('*').eq('workspace_id', ws.id)
      setBoxes(boxData || [])
      setLoading(false)
    }
    load()
  }, [token])

  if (loading) return (
    <div className="h-screen bg-[#0f0f11] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="h-screen bg-[#0f0f11] flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-14 h-14 bg-white/[0.04] border border-white/[0.08] rounded-2xl flex items-center justify-center">
        <FiLock size={24} className="text-white/30" />
      </div>
      <h1 className="font-display font-bold text-xl text-white">Workspace not found</h1>
      <p className="text-white/40 text-sm">This link may be invalid or the workspace is no longer public.</p>
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-[#0f0f11] overflow-hidden">
      {/* Read-only header */}
      <header className="h-12 border-b border-white/[0.07] flex items-center px-4 gap-3 bg-[#0f0f11]/95 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center">
            <FiZap className="text-black" size={12} strokeWidth={2.5} />
          </div>
          <span className="font-display font-black text-base">kexo <em className="not-italic text-brand-400">AI</em></span>
        </div>
        <span className="text-white/20 text-sm">/</span>
        <span className="text-white/70 text-sm font-medium truncate">{workspace.name}</span>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-white/30 bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 rounded-full">
          View only
        </span>
      </header>

      {/* Canvas - read-only, no drag/edit */}
      <div className="flex-1 overflow-auto canvas-scroll">
        <div
          style={{
            width: 4000, height: 3000, position: 'relative',
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)`,
            backgroundSize: '30px 30px', backgroundColor: '#0f0f11',
          }}
        >
          {boxes.map(box => (
            <div
              key={box.id}
              style={{ position: 'absolute', left: box.pos_x, top: box.pos_y, width: box.width || 280 }}
              className="bg-[#17171a] border border-white/[0.1] rounded-2xl p-4 shadow-node"
            >
              <div className="text-[9px] font-display font-black uppercase tracking-widest text-white/30 mb-2">{box.type}</div>
              {box.title && <div className="text-white font-display font-bold text-sm mb-1">{box.title}</div>}
              {box.content && <div className="text-white/50 text-xs leading-relaxed">{box.content}</div>}
              {box.url && box.type === 'image' && (
                <img src={box.url} alt={box.title || ''} className="w-full rounded-xl mt-2 object-cover" style={{ maxHeight: 180 }} />
              )}
              {box.url && box.type === 'voice' && (
                <audio src={box.url} controls className="w-full mt-2" />
              )}
              {box.type === 'youtube' && box.metadata && (box.metadata as any).videoId && (
                <div className="mt-2 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${(box.metadata as any).videoId}`}
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
