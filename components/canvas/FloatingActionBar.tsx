'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { useCanvasStore } from '@/lib/store'
import { Box } from '@/lib/database.types'
import { toast } from 'sonner'
import { FiPlus, FiX, FiType, FiHelpCircle, FiFileText, FiImage, FiMic, FiYoutube, FiFile } from 'react-icons/fi'
import { v4 as uuid } from 'uuid'

interface FabProps { workspaceId: string; userId: string }

const ACTIONS = [
  { type: 'concept',  label: 'Concept',    icon: FiType,       color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { type: 'question', label: 'Question',   icon: FiHelpCircle, color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  { type: 'note',     label: 'Note',       icon: FiFileText,   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { type: 'voice',    label: 'Voice',      icon: FiMic,        color: 'bg-brand-500/20 text-brand-400 border-brand-500/30' },
  { type: 'youtube',  label: 'YouTube',    icon: FiYoutube,    color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { type: 'image',    label: 'Image',      icon: FiImage,      color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  { type: 'pdf',      label: 'PDF',        icon: FiFile,       color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
]

export function FloatingActionBar({ workspaceId, userId }: FabProps) {
  const { addBox, boxes } = useCanvasStore()
  const [open, setOpen] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function getSpawnPos() {
    const scroll = document.getElementById('canvas-scroll')
    const sx = scroll?.scrollLeft || 0, sy = scroll?.scrollTop || 0
    return { x: 200 + sx + Math.random() * 200, y: 160 + sy + Math.random() * 160 }
  }

  async function createBox(type: string) {
    if (type === 'image') { imgRef.current?.click(); setOpen(false); return }
    if (type === 'pdf')   { pdfRef.current?.click(); setOpen(false); return }

    const pos = getSpawnPos()
    const id = uuid()
    const newBox: Partial<Box> = {
      id, workspace_id: workspaceId, user_id: userId,
      type: type as Box['type'],
      title: type === 'youtube' ? '' : `New ${type}`,
      content: '', color: 'default',
      pos_x: pos.x, pos_y: pos.y, width: 280,
    }
    const { data, error } = await supabase.from('boxes').insert(newBox).select().single()
    if (error) { toast.error('Failed to create box'); return }
    addBox(data)
    setOpen(false)
    toast.success(`${type} added`)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf') {
    const file = e.target.files?.[0]
    if (!file) return
    const toastId = toast.loading(`Uploading ${type}…`)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      const { url, publicId, thumbnailUrl, duration } = await res.json()
      const pos = getSpawnPos()
      const id = uuid()
      const newBox: Partial<Box> = {
        id, workspace_id: workspaceId, user_id: userId,
        type, title: file.name,
        url, cloudinary_id: publicId,
        thumbnail_url: thumbnailUrl,
        duration, color: 'default',
        pos_x: pos.x, pos_y: pos.y, width: type === 'pdf' ? 260 : 300,
      }
      const { data, error } = await supabase.from('boxes').insert(newBox).select().single()
      if (error) throw error
      addBox(data)
      toast.success('Uploaded!', { id: toastId })
    } catch {
      toast.error('Upload failed', { id: toastId })
    }
    e.target.value = ''
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'image')} />
      <input ref={pdfRef} type="file" accept=".pdf"   className="hidden" onChange={e => handleImageUpload(e, 'pdf')} />

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            className="mb-3 flex items-center gap-2 bg-[#1a1a1e]/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl px-3 py-2.5 shadow-2xl"
          >
            {ACTIONS.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => createBox(type)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all hover:scale-105 active:scale-95 ${color}`}
              >
                <Icon size={16} />
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-center">
        <motion.button
          onClick={() => setOpen(v => !v)}
          whileTap={{ scale: 0.92 }}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-black font-bold shadow-brand transition-all ${
            open
              ? 'bg-white/20 text-white rotate-45'
              : 'bg-gradient-to-br from-brand-500 to-orange-500 shadow-brand'
          }`}
        >
          {open ? <FiX size={20} /> : <FiPlus size={22} strokeWidth={2.5} />}
        </motion.button>
      </div>
    </div>
  )
}
