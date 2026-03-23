'use client'
import { useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useCanvasStore } from '@/lib/store'
import { useAutoSave } from '@/lib/hooks/useAutoSave'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { CanvasRenderer }  from '@/components/canvas/CanvasRenderer'
import { FloatingActionBar } from '@/components/canvas/FloatingActionBar'
import { AiSidebar }       from '@/components/sidebar/AiSidebar'
import { FiLoader } from 'react-icons/fi'
import { useState } from 'react'

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { setWorkspace, setBoxes, setConnections, boxes } = useCanvasStore()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useAutoSave(id)

  const loadData = useCallback(async () => {
    // Auth check
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) { router.push('/login'); return }
    setUser(authData.user)

    // Load workspace
    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single()
    if (wsError || !ws) { router.push('/dashboard'); return }
    setWorkspace(ws)

    // Load boxes
    const { data: boxData } = await supabase
      .from('boxes')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at')
    setBoxes(boxData || [])

    // Load connections
    const { data: connData } = await supabase
      .from('connections')
      .select('*')
      .eq('workspace_id', id)
    setConnections(connData || [])

    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()

    // Realtime subscription for collaboration
    const channel = supabase
      .channel(`workspace:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'boxes',
        filter: `workspace_id=eq.${id}`,
      }, payload => {
        setBoxes([...boxes, payload.new as any])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'boxes',
        filter: `workspace_id=eq.${id}`,
      }, payload => {
        useCanvasStore.getState().updateBox(payload.new.id, payload.new as any)
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'boxes',
        filter: `workspace_id=eq.${id}`,
      }, payload => {
        useCanvasStore.getState().removeBox(payload.old.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0f0f11]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-orange-500 flex items-center justify-center animate-pulse-slow">
            <FiLoader className="text-black animate-spin" size={20} />
          </div>
          <p className="text-white/30 text-sm">Loading workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f11] overflow-hidden">
      <WorkspaceHeader workspaceId={id} />
      <div className="flex flex-1 overflow-hidden relative">
        <CanvasRenderer workspaceId={id} />
        <AiSidebar />
      </div>
      {user && <FloatingActionBar workspaceId={id} userId={user.id} />}
    </div>
  )
}
