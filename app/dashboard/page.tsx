'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Workspace } from '@/lib/database.types'
import { formatDistanceToNow } from 'date-fns'
import {
  FiZap, FiPlus, FiGrid, FiLogOut, FiTrash2, FiEdit2,
  FiUpload, FiDownload, FiSun, FiMoon, FiSearch,
  FiLayers, FiArrowRight, FiMoreHorizontal, FiX
} from 'react-icons/fi'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [dark, setDark] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      loadWorkspaces(data.user.id)
    })
  }, [])

  async function loadWorkspaces(userId: string) {
    const { data } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
    setWorkspaces(data || [])
    setLoading(false)
  }

  async function createWorkspace() {
    if (!newName.trim()) { toast.error('Please enter a name'); return }
    setCreating(true)
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: newName.trim(), owner_id: user.id })
      .select()
      .single()
    if (error) { toast.error('Failed to create workspace'); setCreating(false); return }
    toast.success('Workspace created!')
    setShowCreate(false)
    setNewName('')
    setCreating(false)
    router.push(`/workspace/${data.id}`)
  }

  async function deleteWorkspace(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from('workspaces').delete().eq('id', id)
    setWorkspaces(ws => ws.filter(w => w.id !== id))
    toast.success('Workspace deleted')
    setMenuOpen(null)
  }

  async function renameWorkspace(id: string, currentName: string) {
    const name = prompt('Rename workspace:', currentName)
    if (!name?.trim()) return
    await supabase.from('workspaces').update({ name: name.trim() }).eq('id', id)
    setWorkspaces(ws => ws.map(w => w.id === id ? { ...w, name: name.trim() } : w))
    toast.success('Renamed')
    setMenuOpen(null)
  }

  async function importWorkspace() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const res = await fetch('/api/workspaces/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        })
        if (!res.ok) throw new Error('Import failed')
        const { workspaceId } = await res.json()
        toast.success('Workspace imported!')
        router.push(`/workspace/${workspaceId}`)
      } catch {
        toast.error('Invalid file — must be a Kexo export')
      }
    }
    input.click()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filtered = workspaces.filter(w => w.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-white/[0.07] flex items-center px-6 gap-4 sticky top-0 z-50 bg-[#0f0f11]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center">
            <FiZap className="text-black" size={14} strokeWidth={2.5} />
          </div>
          <span className="font-display font-black text-lg tracking-tight">
            kexo <em className="not-italic text-brand-400">AI</em>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden sm:flex items-center">
            <FiSearch className="absolute left-3 text-white/30" size={13} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workspaces…"
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl pl-8 pr-4 py-2 text-sm text-white/80 placeholder-white/30 outline-none focus:border-brand-500/50 w-52 transition-colors"
            />
          </div>
          <button
            onClick={importWorkspace}
            className="flex items-center gap-2 text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] rounded-xl px-3 py-2 text-sm transition-all"
          >
            <FiUpload size={13} /> <span className="hidden sm:inline">Import</span>
          </button>
          {/* Avatar */}
          <div className="relative group">
            <button className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center text-black font-bold text-sm">
              {(user?.email?.[0] || 'U').toUpperCase()}
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e1e22] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
              <div className="px-3 py-2.5 border-b border-white/[0.07]">
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
              <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                <FiLogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        {/* Top bar */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-black text-3xl text-white tracking-tight mb-1">My Workspaces</h1>
            <p className="text-white/40 text-sm">Build visual mind maps, take notes, and learn smarter.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-orange-500 hover:opacity-90 text-black font-display font-bold rounded-xl px-5 py-2.5 text-sm shadow-brand transition-all"
          >
            <FiPlus size={16} /> New Workspace
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Workspaces', value: workspaces.length },
            { label: 'Total Boxes', value: workspaces.length * 3 }, // placeholder
            { label: 'Connections', value: workspaces.length * 2 },
          ].map(s => (
            <div key={s.label} className="bg-[#17171a] border border-white/[0.07] rounded-xl p-5">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">{s.label}</p>
              <p className="font-display font-black text-3xl text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#17171a] border border-white/[0.07] rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 border border-dashed border-white/10 rounded-2xl">
            <div className="w-16 h-16 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FiLayers size={28} className="text-white/20" />
            </div>
            <h3 className="font-display font-bold text-lg text-white/60 mb-2">
              {search ? 'No workspaces found' : 'No workspaces yet'}
            </h3>
            <p className="text-white/30 text-sm mb-6">
              {search ? 'Try a different search.' : 'Create your first canvas to get started.'}
            </p>
            {!search && (
              <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:bg-brand-500/30">
                <FiPlus size={14} /> Create workspace
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((ws, i) => (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className="group relative bg-[#17171a] hover:bg-[#1e1e22] border border-white/[0.07] hover:border-white/[0.13] rounded-2xl p-5 cursor-pointer transition-all"
                  onClick={() => router.push(`/workspace/${ws.id}`)}
                >
                  {/* Top accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-brand-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500/20 to-orange-500/10 border border-brand-500/20 flex items-center justify-center font-display font-black text-brand-400 text-lg">
                      {ws.name[0]?.toUpperCase()}
                    </div>
                    {/* Menu */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuOpen(menuOpen === ws.id ? null : ws.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white transition-all"
                      >
                        <FiMoreHorizontal size={15} />
                      </button>
                      {menuOpen === ws.id && (
                        <div className="absolute right-3 top-14 w-40 bg-[#22222a] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl z-50">
                          <button onClick={() => renameWorkspace(ws.id, ws.name)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors">
                            <FiEdit2 size={12} /> Rename
                          </button>
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/export?workspaceId=${ws.id}`)
                              const blob = await res.blob()
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `kexo-${ws.name.replace(/\s+/g, '-')}.json`
                              a.click()
                              toast.success('Exported!')
                              setMenuOpen(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                          >
                            <FiDownload size={12} /> Export JSON
                          </button>
                          <div className="h-px bg-white/[0.06] my-1" />
                          <button onClick={() => deleteWorkspace(ws.id, ws.name)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                            <FiTrash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-display font-bold text-base text-white mb-1 truncate">{ws.name}</h3>
                  <p className="text-white/30 text-xs mb-4">Updated {formatDistanceToNow(new Date(ws.updated_at), { addSuffix: true })}</p>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${ws.is_public ? 'bg-green-500/10 text-green-400' : 'bg-white/[0.05] text-white/30'}`}>
                      {ws.is_public ? 'Public' : 'Private'}
                    </span>
                    <span className="flex items-center gap-1 text-white/40 text-xs group-hover:text-brand-400 transition-colors font-medium">
                      Open <FiArrowRight size={11} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1e1e22] border border-white/[0.1] rounded-2xl p-7 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-xl text-white">New Workspace</h2>
                <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white transition-colors"><FiX size={18} /></button>
              </div>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createWorkspace()}
                placeholder="e.g. Machine Learning Notes, Q4 Strategy…"
                className="w-full bg-white/[0.05] border border-white/[0.08] focus:border-brand-500/60 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors mb-5"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl border border-white/[0.08] text-white/50 hover:text-white text-sm transition-colors">
                  Cancel
                </button>
                <button
                  onClick={createWorkspace}
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-orange-500 text-black font-display font-bold rounded-xl py-3 text-sm disabled:opacity-60 transition-all"
                >
                  {creating ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Create →'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close menu on outside click */}
      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />}
    </div>
  )
}
