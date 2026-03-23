'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useCanvasStore } from '@/lib/store'
import { ShareModal } from '../sidebar/ShareModal'
import { AnimatePresence } from 'framer-motion'
import {
  FiZap, FiGrid, FiShare2, FiDownload, FiZoomIn, FiZoomOut,
  FiUndo, FiRedo, FiCpu, FiSave, FiCheck
} from 'react-icons/fi'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

interface WorkspaceHeaderProps {
  workspaceId: string
}

export function WorkspaceHeader({ workspaceId }: WorkspaceHeaderProps) {
  const { workspace, setWorkspace, boxes, connections, zoom, setZoom, aiSidebarOpen, setAiSidebarOpen, isDirty, lastSaved } = useCanvasStore()
  const [shareOpen, setShareOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const supabase = createClient()

  async function handleRename() {
    const name = prompt('Rename workspace:', workspace?.name)
    if (!name?.trim() || !workspace) return
    await supabase.from('workspaces').update({ name: name.trim() }).eq('id', workspace.id)
    setWorkspace({ ...workspace, name: name.trim() })
    toast.success('Renamed')
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/export?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kexo-${(workspace?.name || 'project').replace(/\s+/g, '-')}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported!')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <header className="h-12 border-b border-white/[0.07] flex items-center px-4 gap-3 flex-shrink-0 bg-[#0f0f11]/95 backdrop-blur-xl z-30 sticky top-0">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity mr-1">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center">
            <FiZap className="text-black" size={12} strokeWidth={2.5} />
          </div>
        </Link>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm">
          <Link href="/dashboard" className="text-white/30 hover:text-white/60 transition-colors">Workspaces</Link>
          <span className="text-white/20">/</span>
          <button
            onClick={handleRename}
            className="text-white/80 hover:text-white font-medium transition-colors truncate max-w-[200px]"
            title="Click to rename"
          >
            {workspace?.name || 'Untitled'}
          </button>
        </div>

        {/* Autosave status */}
        <div className="flex items-center gap-1.5 ml-2">
          {isDirty ? (
            <span className="text-[10px] text-white/30 flex items-center gap-1"><FiSave size={9} /> Saving…</span>
          ) : lastSaved ? (
            <span className="text-[10px] text-white/30 flex items-center gap-1"><FiCheck size={9} className="text-green-400" /> Saved</span>
          ) : null}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom */}
        <div className="hidden sm:flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-2 py-1.5">
          <button onClick={() => setZoom(Math.max(0.25, zoom - 0.1))} className="text-white/40 hover:text-white transition-colors px-1"><FiZoomOut size={13} /></button>
          <span className="text-white/50 text-xs font-mono min-w-[38px] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="text-white/40 hover:text-white transition-colors px-1"><FiZoomIn size={13} /></button>
        </div>

        {/* Actions */}
        <button
          onClick={() => setAiSidebarOpen(!aiSidebarOpen)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-all ${
            aiSidebarOpen
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
              : 'bg-white/[0.04] border-white/[0.07] text-white/50 hover:text-white'
          }`}
        >
          <FiCpu size={13} />
          <span className="hidden sm:inline">AI</span>
        </button>

        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/60 hover:text-white transition-all"
        >
          <FiShare2 size={13} />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-400 hover:bg-brand-500/30 transition-all disabled:opacity-50"
        >
          <FiDownload size={13} />
          <span className="hidden sm:inline">{exporting ? '…' : 'Export'}</span>
        </button>
      </header>

      <AnimatePresence>
        {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
