'use client'
import { useRef, useState, ReactNode } from 'react'
import Draggable from 'react-draggable'
import { motion } from 'framer-motion'
import { useCanvasStore } from '@/lib/store'
import { Box, BoxColor } from '@/lib/database.types'
import { FiLink, FiUnlink, FiTrash2, FiMoreHorizontal, FiSliders } from 'react-icons/fi'
import { createClient } from '@/lib/supabase'
import { toast } from 'sonner'

const COLOR_MAP: Record<BoxColor, string> = {
  default: 'border-white/[0.12]',
  blue:    'border-blue-500/50',
  green:   'border-emerald-500/50',
  amber:   'border-brand-500/60',
  rose:    'border-rose-500/50',
  violet:  'border-violet-500/50',
}

const COLOR_ACCENT: Record<BoxColor, string> = {
  default: 'from-white/5 to-white/[0.02]',
  blue:    'from-blue-500/10 to-blue-500/[0.03]',
  green:   'from-emerald-500/10 to-emerald-500/[0.03]',
  amber:   'from-brand-500/10 to-brand-500/[0.03]',
  rose:    'from-rose-500/10 to-rose-500/[0.03]',
  violet:  'from-violet-500/10 to-violet-500/[0.03]',
}

interface NodeBaseProps {
  box: Box
  children: ReactNode
  headerLabel?: string
  headerColor?: string
  minWidth?: number
  disableResize?: boolean
}

export function NodeBase({ box, children, headerLabel, headerColor = 'text-white/40', minWidth = 240, disableResize = false }: NodeBaseProps) {
  const { selectedBoxId, setSelectedBoxId, updateBox, removeBox, connectMode, setConnectMode, connectSourceId, setConnectSourceId, addConnection } = useCanvasStore()
  const supabase = createClient()
  const nodeRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [width, setWidth] = useState(box.width || minWidth)
  const isSelected = selectedBoxId === box.id

  async function handleDelete() {
    removeBox(box.id)
    await supabase.from('boxes').delete().eq('id', box.id)
    if (box.cloudinary_id) {
      await fetch('/api/upload', { method: 'DELETE', body: JSON.stringify({ publicId: box.cloudinary_id }) })
    }
    toast.success('Deleted')
    setMenuOpen(false)
  }

  function handleConnectClick() {
    if (connectMode && connectSourceId && connectSourceId !== box.id) {
      // Complete the connection
      addConnectionToCanvas(connectSourceId, box.id)
      setConnectMode(false)
      setConnectSourceId(null)
    } else {
      setConnectSourceId(box.id)
      setConnectMode(true)
      toast('Click another box to connect', { icon: '🔗' })
    }
    setMenuOpen(false)
  }

  async function addConnectionToCanvas(fromId: string, toId: string) {
    const supabase = createClient()
    const { data } = await supabase.from('connections').insert({
      workspace_id: box.workspace_id,
      from_box_id: fromId,
      to_box_id: toId,
    }).select().single()
    if (data) addConnection(data)
  }

  async function setColor(color: BoxColor) {
    updateBox(box.id, { color })
    await supabase.from('boxes').update({ color }).eq('id', box.id)
    setMenuOpen(false)
  }

  const COLORS: BoxColor[] = ['default', 'blue', 'green', 'amber', 'rose', 'violet']

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={{ x: box.pos_x, y: box.pos_y }}
      onStop={async (_e, d) => {
        updateBox(box.id, { pos_x: d.x, pos_y: d.y })
        await supabase.from('boxes').update({ pos_x: d.x, pos_y: d.y }).eq('id', box.id)
      }}
      cancel=".no-drag"
      handle=".drag-handle"
    >
      <div
        ref={nodeRef}
        style={{ position: 'absolute', width }}
        onClick={(e) => { e.stopPropagation(); setSelectedBoxId(box.id) }}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`
            relative rounded-2xl border bg-gradient-to-b backdrop-blur-sm shadow-node
            ${COLOR_MAP[box.color as BoxColor] || COLOR_MAP.default}
            ${COLOR_ACCENT[box.color as BoxColor] || COLOR_ACCENT.default}
            ${isSelected ? 'node-selected ring-2 ring-brand-500/60' : ''}
            ${connectMode && connectSourceId !== box.id ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/50' : ''}
            transition-all duration-150
          `}
        >
          {/* Drag handle */}
          <div className="drag-handle absolute top-0 left-0 right-0 h-8 cursor-grab active:cursor-grabbing rounded-t-2xl" />

          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className={`text-[9px] font-display font-black uppercase tracking-[0.14em] ${headerColor}`}>
              {headerLabel || box.type}
            </span>
            <div className="flex items-center gap-1 no-drag">
              <button
                onClick={handleConnectClick}
                className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${connectMode && connectSourceId === box.id ? 'bg-blue-500/30 text-blue-400' : 'text-white/30 hover:text-blue-400 hover:bg-blue-500/10'}`}
                title="Connect"
              >
                <FiLink size={11} />
              </button>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <FiMoreHorizontal size={13} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="no-drag px-3 pb-3">{children}</div>

          {/* Resize handle */}
          {!disableResize && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize no-drag opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => {
                e.preventDefault()
                const startX = e.clientX, startW = width
                const onMove = (ev: MouseEvent) => {
                  const newW = Math.max(minWidth, startW + ev.clientX - startX)
                  setWidth(newW)
                  updateBox(box.id, { width: newW })
                }
                const onUp = () => {
                  supabase.from('boxes').update({ width }).eq('id', box.id)
                  document.removeEventListener('mousemove', onMove)
                  document.removeEventListener('mouseup', onUp)
                }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-1 right-1 text-white/20">
                <path d="M10 3L3 10M10 7L7 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          )}

          {/* Context menu */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 w-44 bg-[#1e1e22] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden no-drag">
                {/* Colors */}
                <div className="px-3 py-2 border-b border-white/[0.07]">
                  <p className="text-[10px] text-white/30 mb-2 font-display uppercase tracking-widest">Color</p>
                  <div className="flex gap-1.5">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                          c === 'default' ? 'bg-white/20 border-white/40' :
                          c === 'blue'    ? 'bg-blue-500 border-blue-400' :
                          c === 'green'   ? 'bg-emerald-500 border-emerald-400' :
                          c === 'amber'   ? 'bg-brand-500 border-brand-400' :
                          c === 'rose'    ? 'bg-rose-500 border-rose-400' :
                                            'bg-violet-500 border-violet-400'
                        } ${box.color === c ? 'scale-110' : ''}`}
                      />
                    ))}
                  </div>
                </div>
                <button onClick={handleConnectClick} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                  <FiLink size={12} /> Connect
                </button>
                <button onClick={handleDelete} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  <FiTrash2 size={12} /> Delete
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </Draggable>
  )
}
