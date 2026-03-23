import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { v4 as uuid } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await req.json()
    if (!data?.boxes) return NextResponse.json({ error: 'Invalid export file' }, { status: 400 })

    // Create new workspace
    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        owner_id: user.id,
        name: (data.workspaceName || 'Imported Workspace') + ' (imported)',
        description: data.description,
        settings: data.workspace?.settings || {},
      })
      .select()
      .single()
    if (wsError || !ws) throw wsError || new Error('Failed to create workspace')

    // Map old IDs → new IDs
    const idMap: Record<string, string> = {}

    // Insert boxes
    if (data.boxes?.length) {
      const newBoxes = data.boxes.map((b: any) => {
        const newId = uuid()
        idMap[b.id] = newId
        return {
          id: newId,
          workspace_id: ws.id,
          user_id: user.id,
          type: b.type || 'concept',
          title: b.title,
          content: b.content,   // YouTube URLs preserved
          url: b.url,           // Cloudinary URLs preserved
          cloudinary_id: b.cloudinary_id,
          thumbnail_url: b.thumbnail_url,
          duration: b.duration,
          metadata: b.metadata, // videoId etc.
          pos_x: b.position?.x ?? 200,
          pos_y: b.position?.y ?? 200,
          width: b.size?.width ?? 280,
          height: b.size?.height ?? null,
          color: b.color || 'default',
          z_index: b.z_index || 0,
        }
      })
      await supabase.from('boxes').insert(newBoxes)
    }

    // Insert connections (remap IDs)
    if (data.connections?.length) {
      const newConns = data.connections
        .filter((c: any) => idMap[c.from] && idMap[c.to])
        .map((c: any) => ({
          workspace_id: ws.id,
          from_box_id: idMap[c.from],
          to_box_id: idMap[c.to],
          label: c.label,
          style: c.style || 'solid',
        }))
      if (newConns.length) await supabase.from('connections').insert(newConns)
    }

    // Import notes
    if (data.notes) {
      await supabase.from('notes').insert({
        workspace_id: ws.id,
        user_id: user.id,
        content: data.notes,
      })
    }

    return NextResponse.json({ workspaceId: ws.id })
  } catch (err: any) {
    console.error('Import error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
