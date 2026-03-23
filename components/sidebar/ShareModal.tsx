'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { useCanvasStore } from '@/lib/store'
import { toast } from 'sonner'
import { FiX, FiShare2, FiMail, FiLink, FiCheck, FiGlobe, FiUsers } from 'react-icons/fi'

interface ShareModalProps { onClose: () => void }

export function ShareModal({ onClose }: ShareModalProps) {
  const { workspace, setWorkspace } = useCanvasStore()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [togglingPublic, setTogglingPublic] = useState(false)

  const shareUrl = workspace?.share_token
    ? `${window.location.origin}/share/${workspace.share_token}`
    : ''

  async function inviteByEmail() {
    if (!email.trim() || !workspace) return
    setInviting(true)
    try {
      // Look up user by email
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('email', email.trim()).single()

      await supabase.from('workspace_members').upsert({
        workspace_id: workspace.id,
        user_id: profile?.id || null,
        email: email.trim(),
        role,
        invited_by: (await supabase.auth.getUser()).data.user?.id,
      }, { onConflict: 'workspace_id,user_id' })

      toast.success(`Invite sent to ${email}`)
      setEmail('')
    } catch {
      toast.error('Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Link copied!')
  }

  async function togglePublic() {
    if (!workspace) return
    setTogglingPublic(true)
    const newVal = !workspace.is_public
    await supabase.from('workspaces').update({ is_public: newVal }).eq('id', workspace.id)
    setWorkspace({ ...workspace, is_public: newVal })
    setTogglingPublic(false)
    toast.success(newVal ? 'Workspace is now public' : 'Workspace is now private')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#1a1a1e] border border-white/[0.1] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <FiShare2 size={16} className="text-brand-400" />
            <h2 className="font-display font-bold text-lg text-white">Share Workspace</h2>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><FiX size={18} /></button>
        </div>

        {/* Invite collaborator */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FiUsers size={13} className="text-white/40" />
            <h3 className="text-sm font-medium text-white/70">Add collaborator</h3>
          </div>
          <div className="flex gap-2 mb-2">
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && inviteByEmail()}
              placeholder="colleague@example.com"
              className="flex-1 bg-white/[0.05] border border-white/[0.08] focus:border-brand-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'editor' | 'viewer')}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-2 py-2 text-sm text-white/70 outline-none"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            onClick={inviteByEmail}
            disabled={inviting || !email.trim()}
            className="w-full flex items-center justify-center gap-2 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30 text-brand-400 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-50"
          >
            <FiMail size={13} />
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
        </div>

        <div className="h-px bg-white/[0.06] mb-6" />

        {/* Public link */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FiGlobe size={13} className="text-white/40" />
            <h3 className="text-sm font-medium text-white/70">Public view link</h3>
          </div>

          <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 mb-3">
            <span className="text-sm text-white/50">Anyone with the link</span>
            <button
              onClick={togglePublic}
              disabled={togglingPublic}
              className={`relative w-10 h-5 rounded-full transition-colors ${workspace?.is_public ? 'bg-brand-500' : 'bg-white/20'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${workspace?.is_public ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {workspace?.is_public && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="flex gap-2"
            >
              <div className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2.5 text-xs text-white/40 truncate font-mono">
                {shareUrl}
              </div>
              <button
                onClick={copyShareLink}
                className="flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70 rounded-xl px-3 py-2 text-sm font-medium transition-all"
              >
                {copied ? <FiCheck size={13} className="text-green-400" /> : <FiLink size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </motion.div>
          )}

          {workspace?.is_public && (
            <p className="text-white/30 text-xs mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Public — anyone can view, no editing
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
